use crate::audit::{parse_rpc_audit_event, RpcAuditEvent};
use crate::models::{McpCallRecord, WorkspaceItem};
use crate::state::AppState;
use crate::utils::cmd::{execute_cmd, is_process_running, kill_process_tree};
use crate::utils::time::local_now_rfc3339;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Arc;
use std::time::Instant;
use tauri::{AppHandle, Emitter, State};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

struct PendingToolCall {
    record_id: String,
    started_at: Instant,
}

fn insert_running_call(
    state: &AppState,
    workspace_id: &str,
    workspace_name: &str,
    call_id: &str,
    tool_name: String,
    args_json: String,
    input_tokens: u64,
) -> String {
    let now = chrono::Local::now();
    let record_id = format!(
        "{}:{}:{}",
        workspace_id,
        call_id,
        now.timestamp_nanos_opt().unwrap_or_default()
    );
    let session_id = state
        .workspaces
        .lock()
        .iter()
        .find(|workspace| workspace.id == workspace_id)
        .and_then(|workspace| workspace.session_id.clone());
    let record = McpCallRecord {
        id: record_id.clone(),
        timestamp: now.to_rfc3339_opts(chrono::SecondsFormat::Secs, false),
        session_id,
        workspace_id: Some(workspace_id.to_string()),
        workspace_name: Some(workspace_name.to_string()),
        tool_name,
        args_json,
        result_summary: String::new(),
        status: "executing".to_string(),
        duration_ms: 0,
        input_tokens,
        output_tokens: 0,
        total_tokens: input_tokens,
    };

    state.history.lock().insert(0, record);
    state.save_history();
    record_id
}

fn finish_running_call(
    state: &AppState,
    pending: PendingToolCall,
    result_summary: String,
    is_error: bool,
    output_tokens: u64,
) {
    {
        let mut history = state.history.lock();
        let Some(record) = history
            .iter_mut()
            .find(|record| record.id == pending.record_id)
        else {
            return;
        };
        record.result_summary = result_summary;
        record.status = if is_error { "error" } else { "success" }.to_string();
        record.duration_ms = pending.started_at.elapsed().as_millis() as u64;
        record.output_tokens = output_tokens;
        record.total_tokens = record.input_tokens.saturating_add(output_tokens);
    }
    state.save_history();
}

#[tauri::command]
pub async fn list_workspaces(state: State<'_, Arc<AppState>>) -> Result<Vec<WorkspaceItem>, String> {
    let mut list = state.workspaces.lock().clone();
    let pids = state.running_workspace_pids.lock().clone();

    for item in &mut list {
        let is_running = if let Some(pid) = pids.get(&item.id) {
            is_process_running(*pid)
        } else {
            false
        };

        if is_running {
            item.status = "ready".to_string();
            item.pid = pids.get(&item.id).copied();
        } else {
            item.status = "stopped".to_string();
            item.pid = None;
        }

        // Check git details
        let path = Path::new(&item.path);
        if path.exists() {
            let branch_out = execute_cmd("git", &["branch", "--show-current"], Some(path));
            if branch_out.success && !branch_out.stdout.trim().is_empty() {
                item.git_branch = Some(branch_out.stdout.trim().to_string());
            }

            let status_out = execute_cmd("git", &["status", "--porcelain"], Some(path));
            if status_out.success {
                let changes = status_out.stdout.lines().count();
                let locale = state.settings.lock().locale.clone();
                item.git_status = if changes == 0 {
                    Some(crate::i18n::t(&locale, "workspace.git_clean").to_string())
                } else if locale.starts_with("en") {
                    Some(format!("{} uncommitted changes", changes))
                } else {
                    Some(format!("{} 个文件未提交变更", changes))
                };
            }
        }
    }

    *state.workspaces.lock() = list.clone();
    Ok(list)
}

#[tauri::command]
pub async fn add_workspace(
    state: State<'_, Arc<AppState>>,
    path: String,
    name: Option<String>,
) -> Result<WorkspaceItem, String> {
    let locale = state.settings.lock().locale.clone();
    let p = PathBuf::from(&path);
    if !p.exists() || !p.is_dir() {
        return Err(crate::i18n::t(&locale, "error.workspace_path_invalid").to_string());
    }

    let default_name = p
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "Workspace".to_string());

    let final_name = name.unwrap_or(default_name);
    let id = format!("ws_{}", chrono::Local::now().timestamp_millis());

    let mut item = WorkspaceItem {
        id: id.clone(),
        name: final_name,
        path: p.to_string_lossy().to_string(),
        status: "stopped".to_string(),
        session_id: None,
        pid: None,
        binding_count: 0,
        git_branch: None,
        git_status: None,
        last_started_at: None,
        error_message: None,
    };

    // Probe Git
    let branch_out = execute_cmd("git", &["branch", "--show-current"], Some(&p));
    if branch_out.success && !branch_out.stdout.trim().is_empty() {
        item.git_branch = Some(branch_out.stdout.trim().to_string());
    }

    {
        let mut workspaces = state.workspaces.lock();
        // Prevent duplicate path
        if workspaces.iter().any(|w| w.path == item.path) {
            return Err(crate::i18n::t(&locale, "error.workspace_path_exists").to_string());
        }
        workspaces.push(item.clone());
    }

    state.save_workspaces();
    Ok(item)
}

#[tauri::command]
pub async fn remove_workspace(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    workspace_id: String,
) -> Result<bool, String> {
    // Stop if running
    let _ = stop_workspace_session(app, state.clone(), workspace_id.clone()).await;

    let mut workspaces = state.workspaces.lock();
    workspaces.retain(|w| w.id != workspace_id);
    drop(workspaces);

    state.save_workspaces();
    Ok(true)
}

#[tauri::command]
pub async fn start_workspace_session(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    workspace_id: String,
) -> Result<u32, String> {
    let (path_str, ws_name, locale) = {
        let workspaces = state.workspaces.lock();
        let ws = workspaces
            .iter()
            .find(|w| w.id == workspace_id)
            .ok_or_else(|| "工作区未找到".to_string())?;
        let loc = state.settings.lock().locale.clone();
        (ws.path.clone(), ws.name.clone(), loc)
    };

    let dir = PathBuf::from(&path_str);
    if !dir.exists() {
        return Err("工作区目录不存在".to_string());
    }

    // Stop existing process if any
    let _ = stop_workspace_session(app.clone(), state.clone(), workspace_id.clone()).await;

    let start_msg = if locale.starts_with("en") {
        format!(">>> Starting workspace Pi session: {} ({})", ws_name, path_str)
    } else {
        format!(">>> 正在启动工作区 Pi Session: {} ({})", ws_name, path_str)
    };

    // Emit startup feedback into terminal drawer
    let _ = app.emit(
        "workspace-log",
        serde_json::json!({
            "workspace_id": &workspace_id,
            "line": start_msg,
            "is_error": false,
        }),
    );
    let _ = app.emit(
        "workspace-log",
        serde_json::json!({
            "workspace_id": &workspace_id,
            "line": crate::i18n::t(&locale, "workspace.log.rpc_mode"),
            "is_error": false,
        }),
    );

    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = Command::new("cmd.exe");
        c.args(["/d", "/s", "/c", "pi", "--mode", "rpc", "--provider", "chappie", "--model", "chatgpt"]);
        c.current_dir(&dir);
        c.stdin(Stdio::piped());
        c.stdout(Stdio::piped());
        c.stderr(Stdio::piped());
        c.creation_flags(CREATE_NO_WINDOW);
        c
    };
    #[cfg(not(target_os = "windows"))]
    let mut cmd = {
        let mut c = Command::new("pi");
        c.args(["--mode", "rpc", "--provider", "chappie", "--model", "chatgpt"]);
        c.current_dir(&dir);
        c.stdin(Stdio::piped());
        c.stdout(Stdio::piped());
        c.stderr(Stdio::piped());
        c
    };

    let mut child = cmd.spawn().map_err(|e| format!("无法启动 Pi Session: {}", e))?;
    let pid = child.id();

    // Track PID
    state.running_workspace_pids.lock().insert(workspace_id.clone(), pid);

    // Write initial command to Pi RPC stdin to query session state & obtain sessionId
    let mut stdin = child.stdin.take();
    if let Some(ref mut sin) = stdin {
        use std::io::Write;
        let _ = sin.write_all(b"{\"id\":\"init\",\"type\":\"get_state\"}\n");
        let _ = sin.flush();
    }
    if let Some(sin) = stdin {
        state.running_workspace_stdins.lock().insert(workspace_id.clone(), sin);
    }

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Stream stdout to terminal drawer & parse session_id
    if let Some(out) = stdout {
        let app_handle = app.clone();
        let ws_id = workspace_id.clone();
        let workspace_name = ws_name.clone();
        let state_clone = state.inner().clone();
        std::thread::spawn(move || {
            use std::io::{BufRead, BufReader};
            let reader = BufReader::new(out);
            let mut pending_tools: HashMap<String, PendingToolCall> = HashMap::new();
            for line_res in reader.lines() {
                if let Ok(line) = line_res {
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }

                    if let Some(event) = parse_rpc_audit_event(trimmed) {
                        match event {
                            RpcAuditEvent::ToolStarted {
                                call_id,
                                tool_name,
                                args_json,
                                input_tokens,
                            } => {
                                let record_id = insert_running_call(
                                    &state_clone,
                                    &ws_id,
                                    &workspace_name,
                                    &call_id,
                                    tool_name,
                                    args_json,
                                    input_tokens,
                                );
                                pending_tools.insert(
                                    call_id,
                                    PendingToolCall {
                                        record_id,
                                        started_at: Instant::now(),
                                    },
                                );
                                let _ = app_handle.emit(
                                    "audit-updated",
                                    serde_json::json!({ "workspace_id": &ws_id }),
                                );
                            }
                            RpcAuditEvent::ToolFinished {
                                call_id,
                                result_summary,
                                is_error,
                                output_tokens,
                            } => {
                                if let Some(pending) = pending_tools.remove(&call_id) {
                                    finish_running_call(
                                        &state_clone,
                                        pending,
                                        result_summary,
                                        is_error,
                                        output_tokens,
                                    );
                                    let _ = app_handle.emit(
                                        "audit-updated",
                                        serde_json::json!({ "workspace_id": &ws_id }),
                                    );
                                }
                            }
                        }
                    }

                    // Look for JSON RPC response containing sessionId
                    if trimmed.contains("\"sessionId\"") {
                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(trimmed) {
                            let sid = val["data"]["sessionId"]
                                .as_str()
                                .or_else(|| val["sessionId"].as_str());
                            if let Some(session_id) = sid {
                                let mut list = state_clone.workspaces.lock();
                                if let Some(w) = list.iter_mut().find(|w| w.id == ws_id) {
                                    w.session_id = Some(session_id.to_string());
                                }
                                drop(list);
                                state_clone.save_workspaces();

                                let _ = app_handle.emit(
                                    "workspace-log",
                                    serde_json::json!({
                                        "workspace_id": &ws_id,
                                        "line": format!(">>> Pi 会话已激活并注册至 Broker | Session ID: {}", session_id),
                                        "is_error": false,
                                    }),
                                );
                            }
                        }
                    }

                    let _ = app_handle.emit(
                        "workspace-log",
                        serde_json::json!({
                            "workspace_id": &ws_id,
                            "line": trimmed,
                            "is_error": false,
                        }),
                    );
                }
            }
        });
    }

    // Stream stderr to terminal drawer
    if let Some(err) = stderr {
        let app_handle = app.clone();
        let ws_id = workspace_id.clone();
        std::thread::spawn(move || {
            use std::io::{BufRead, BufReader};
            let reader = BufReader::new(err);
            for line_res in reader.lines() {
                if let Ok(line) = line_res {
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }
                    let lower = trimmed.to_lowercase();
                    let is_err = lower.contains("error:") || lower.contains("fatal:") || lower.contains("exception");
                    let _ = app_handle.emit(
                        "workspace-log",
                        serde_json::json!({
                            "workspace_id": &ws_id,
                            "line": trimmed,
                            "is_error": is_err,
                        }),
                    );
                }
            }
        });
    }

    // Monitor child process exit
    {
        let app_handle = app.clone();
        let ws_id = workspace_id.clone();
        let state_clone = state.inner().clone();
        std::thread::spawn(move || {
            let _ = child.wait();
            state_clone.running_workspace_pids.lock().remove(&ws_id);
            state_clone.running_workspace_stdins.lock().remove(&ws_id);

            let mut list = state_clone.workspaces.lock();
            if let Some(w) = list.iter_mut().find(|w| w.id == ws_id) {
                w.status = "stopped".to_string();
                w.pid = None;
            }
            drop(list);
            state_clone.save_workspaces();

            let locale = state_clone.settings.lock().locale.clone();
            let _ = app_handle.emit(
                "workspace-log",
                serde_json::json!({
                    "workspace_id": &ws_id,
                    "line": crate::i18n::t(&locale, "workspace.log.session_exited"),
                    "is_error": false,
                }),
            );
        });
    }

    {
        let mut list = state.workspaces.lock();
        if let Some(w) = list.iter_mut().find(|w| w.id == workspace_id) {
            w.status = "ready".to_string();
            w.pid = Some(pid);
            w.last_started_at = Some(local_now_rfc3339());
        }
    }

    state.save_workspaces();
    Ok(pid)
}

#[tauri::command]
pub async fn stop_workspace_session(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    workspace_id: String,
) -> Result<bool, String> {
    // 1. Close stdin to signal EOF to Pi process
    state.running_workspace_stdins.lock().remove(&workspace_id);

    // 2. Terminate PID process tree
    let pid_opt = state.running_workspace_pids.lock().remove(&workspace_id);
    let mut stopped = false;

    if let Some(pid) = pid_opt {
        stopped = kill_process_tree(pid);
    }

    {
        let mut list = state.workspaces.lock();
        if let Some(w) = list.iter_mut().find(|w| w.id == workspace_id) {
            w.status = "stopped".to_string();
            w.pid = None;
        }
    }

    let locale = state.settings.lock().locale.clone();
    state.save_workspaces();

    let _ = app.emit(
        "workspace-log",
        serde_json::json!({
            "workspace_id": &workspace_id,
            "line": crate::i18n::t(&locale, "workspace.log.session_stopped"),
            "is_error": false,
        }),
    );

    Ok(stopped)
}

#[tauri::command]
pub async fn restart_workspace_session(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    workspace_id: String,
) -> Result<u32, String> {
    let _ = stop_workspace_session(app.clone(), state.clone(), workspace_id.clone()).await;
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    start_workspace_session(app, state, workspace_id).await
}

#[tauri::command]
pub fn generate_chatgpt_prompt(
    path: String,
    session_id: Option<String>,
    locale: Option<String>,
) -> String {
    let is_en = locale.as_deref().unwrap_or("").starts_with("en");
    if let Some(sid) = session_id {
        if !sid.trim().is_empty() {
            return if is_en {
                format!(
r#"@Chappie

I want to work on project:
{}

Call init with the specified sessionId:
init({{ sessionId: "{}" }})

Then output current cwd, Git branch, and status."#,
                    path, sid
                )
            } else {
                format!(
r#"@Chappie

我要操作项目：
{}

使用指定的 sessionId 调用 init：
init({{ sessionId: "{}" }})

随后输出当前 cwd、Git 分支及状态。"#,
                    path, sid
                )
            };
        }
    }

    if is_en {
        format!(
r#"@Chappie

I want to work on project:
{}

Follow these steps:
1. Call sessions.
2. Find the exact Pi session corresponding to this project based on cwd.
3. Confirm there is only one match.
4. Call init using the matching sessionId.
5. Output current cwd, Git branch, and git status.
6. Do not modify any files.

If the project does not exist, has multiple matches, or Pi is not online, stop and report the current sessions status."#,
            path
        )
    } else {
        format!(
r#"@Chappie

我要操作项目：
{}

执行以下步骤：
1. 调用 sessions。
2. 根据 cwd 精确找到该项目对应的 Pi Session。
3. 必须确认只有一个匹配。
4. 使用对应 sessionId 调用 init。
5. 输出当前 cwd、Git branch 和 git status。
6. 不要修改任何文件。

如果项目不存在、存在多个匹配、Pi 未在线，停止操作并告诉我当前 sessions 状态。"#,
            path
        )
    }
}
