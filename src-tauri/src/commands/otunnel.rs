use crate::models::{DoctorCheckItem, DoctorReport, OtunnelDaemonStatus};
use crate::state::AppState;
use crate::utils::cmd::{execute_cmd, find_process_by_name, is_process_running, kill_process_tree};
use crate::utils::paths::{ensure_chappie_yaml_synced, get_chappie_yaml_path};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::State;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;
const OTUNNEL_STARTUP_TIMEOUT: Duration = Duration::from_secs(10);
const OTUNNEL_STARTUP_POLL_INTERVAL: Duration = Duration::from_millis(100);

fn parse_health_base_url(raw: &str) -> Result<(String, u16), String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("健康检查 URL 文件为空".to_string());
    }

    let mut url =
        reqwest::Url::parse(trimmed).map_err(|e| format!("健康检查 URL 格式无效: {}", e))?;
    if url.scheme() != "http" {
        return Err(format!("健康检查 URL 使用了不支持的协议: {}", url.scheme()));
    }

    let host = url
        .host_str()
        .ok_or_else(|| "健康检查 URL 缺少主机地址".to_string())?;
    if !matches!(host, "127.0.0.1" | "localhost" | "::1") {
        return Err(format!("健康检查 URL 不是本机回环地址: {}", host));
    }

    let port = url
        .port()
        .ok_or_else(|| "健康检查 URL 缺少实际监听端口".to_string())?;
    url.set_path("");
    url.set_query(None);
    url.set_fragment(None);

    Ok((url.as_str().trim_end_matches('/').to_string(), port))
}

fn read_health_base_url(path: &Path) -> Result<(String, u16), String> {
    let content =
        fs::read_to_string(path).map_err(|e| format!("读取健康检查 URL 文件失败: {}", e))?;
    parse_health_base_url(&content)
}

fn create_health_url_file_path(state: &AppState) -> Result<PathBuf, String> {
    let runtime_dir = state.app_data_dir.join("runtime");
    fs::create_dir_all(&runtime_dir).map_err(|e| format!("创建 otunnel 运行目录失败: {}", e))?;
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    Ok(runtime_dir.join(format!(
        "otunnel-health-{}-{}.url",
        std::process::id(),
        nonce
    )))
}

fn tail_log(log: &str, line_count: usize) -> String {
    log.lines()
        .rev()
        .take(line_count)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect::<Vec<_>>()
        .join("\n")
}

fn format_startup_failure(configured_port: u16, exit_detail: &str, log: &str) -> String {
    let combined = format!("{}\n{}", exit_detail, log);
    let lower = combined.to_ascii_lowercase();
    let log_tail = tail_log(log, 10);
    let details = if log_tail.trim().is_empty() {
        exit_detail.to_string()
    } else {
        format!("{}\n{}", exit_detail, log_tail)
    };

    let bind_failed = lower.contains("bind health listener")
        || lower.contains("address already in use")
        || lower.contains("addrinuse")
        || lower.contains("os error 10048")
        || lower.contains("os error 10013");

    if bind_failed {
        if configured_port == 0 {
            return format!(
                "otunnel 无法绑定系统自动分配的健康检查端口。可能是系统网络策略、权限或套接字异常。\n{}",
                details
            );
        }

        return format!(
            "健康检查端口 {} 无法使用，可能已被其他程序占用或被系统保留。请改为自动端口（0）或选择其他端口。\n{}",
            configured_port, details
        );
    }

    format!(
        "otunnel 启动失败。请根据以下信息检查配置、凭据和本地 MCP 命令：\n{}",
        details
    )
}

#[tauri::command]
pub async fn get_otunnel_status(
    state: State<'_, Arc<AppState>>,
) -> Result<OtunnelDaemonStatus, String> {
    let configured_port = {
        let settings = state.settings.lock();
        settings.health_port
    };
    let runtime_health_url = state.otunnel_health_url.lock().clone();

    // Find if otunnel process is running
    let mut pid = *state.otunnel_pid.lock();
    let is_running_tracked = pid.map(|p| is_process_running(p)).unwrap_or(false);

    let mut running = is_running_tracked;
    if !running {
        // Clear stale pid from state
        *state.otunnel_pid.lock() = None;
        pid = None;

        // Look up by process name without PowerShell/ps so this works on all
        // desktop platforms and does not create or block on a shell process.
        if let Some(sys_pid) = find_process_by_name("otunnel") {
            running = true;
            pid = Some(sys_pid);
            *state.otunnel_pid.lock() = Some(sys_pid);
        }
    }

    let health_base_url = runtime_health_url.or_else(|| {
        (configured_port != 0).then(|| format!("http://127.0.0.1:{}", configured_port))
    });

    // Probe healthz & readyz only when the resolved address is known. Port 0 is
    // never probed directly; otunnel writes its actual address to health.url-file.
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(1500))
        .build()
        .map_err(|e| e.to_string())?;
    let mut latency = None;
    let mut healthz_ok = false;
    let mut readyz_ok = false;

    if let Some(base_url) = health_base_url.as_deref() {
        let health_url = format!("{}/healthz", base_url.trim_end_matches('/'));
        let ready_url = format!("{}/readyz", base_url.trim_end_matches('/'));
        let start = Instant::now();
        if let Ok(res) = client.get(&health_url).send().await {
            healthz_ok = res.status().is_success();
            if healthz_ok {
                latency = Some(start.elapsed().as_millis() as u64);
                readyz_ok = client
                    .get(&ready_url)
                    .send()
                    .await
                    .map(|res| res.status().is_success())
                    .unwrap_or(false);
            }
        }
    }

    let tunnel_id = {
        let settings = state.settings.lock();
        if settings.tunnel_id.is_empty() {
            None
        } else {
            Some(settings.tunnel_id.clone())
        }
    };

    if !running && !healthz_ok {
        pid = None;
        state.clear_otunnel_runtime();
    }

    let listen_port = health_base_url
        .as_deref()
        .and_then(|url| parse_health_base_url(url).ok().map(|(_, port)| port));

    Ok(OtunnelDaemonStatus {
        running: running || healthz_ok,
        pid,
        healthz_ok,
        readyz_ok,
        latency_ms: latency,
        listen_port,
        health_base_url,
        tunnel_id,
        uptime_seconds: None,
    })
}

#[tauri::command]
pub async fn start_otunnel(state: State<'_, Arc<AppState>>) -> Result<u32, String> {
    ensure_chappie_yaml_synced();

    // Check if already running
    let cur_status = get_otunnel_status(state.clone()).await?;
    if cur_status.running && cur_status.healthz_ok {
        if let Some(p) = cur_status.pid {
            *state.otunnel_pid.lock() = Some(p);
        }
        return Ok(cur_status.pid.unwrap_or(0));
    }
    if cur_status.running {
        return Err(format!(
            "检测到 otunnel 进程仍在运行（PID: {}），但健康检查地址不可用。请先停止该进程后再启动，以免产生重复实例。",
            cur_status.pid.map(|pid| pid.to_string()).unwrap_or_else(|| "未知".to_string())
        ));
    }

    state.clear_otunnel_runtime();
    let configured_port = state.settings.lock().health_port;
    let health_listen_addr = format!("127.0.0.1:{}", configured_port);
    let health_url_file = create_health_url_file_path(&state)?;

    let mut cmd = Command::new("otunnel");
    cmd.arg("run");
    if let Some(profile_file) = get_chappie_yaml_path() {
        cmd.args(["--profile-file", &profile_file.to_string_lossy()]);
    } else {
        cmd.args(["--profile", "chappie"]);
    }
    cmd.arg("--health.listen-addr")
        .arg(&health_listen_addr)
        .arg("--health.url-file")
        .arg(&health_url_file);

    // Capture logs to ~/.chappie/otunnel.log
    let home = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    let log_dir = home.join(".chappie");
    let _ = fs::create_dir_all(&log_dir);
    let log_file = log_dir.join("otunnel.log");

    let out_file = fs::OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&log_file)
        .map_err(|e| format!("打开日志文件失败: {}", e))?;
    let err_file = out_file
        .try_clone()
        .map_err(|e| format!("复制日志句柄失败: {}", e))?;

    cmd.stdout(Stdio::from(out_file));
    cmd.stderr(Stdio::from(err_file));

    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = match cmd.spawn() {
        Ok(child) => child,
        Err(error) => {
            let _ = fs::remove_file(&health_url_file);
            return if error.kind() == std::io::ErrorKind::NotFound {
                Err("无法启动 otunnel：系统找不到 otunnel 可执行文件。请先完成环境安装，或刷新 PATH 后重试。".to_string())
            } else {
                Err(format!("无法创建 otunnel 进程：{}", error))
            };
        }
    };
    let pid = child.id();

    *state.otunnel_pid.lock() = Some(pid);
    *state.otunnel_health_url_file.lock() = Some(health_url_file.clone());

    let startup_client = match reqwest::Client::builder()
        .timeout(Duration::from_millis(600))
        .build()
    {
        Ok(client) => client,
        Err(error) => {
            let _ = kill_process_tree(pid);
            *state.otunnel_pid.lock() = None;
            state.clear_otunnel_runtime();
            return Err(format!("创建健康检查客户端失败：{}", error));
        }
    };
    let deadline = Instant::now() + OTUNNEL_STARTUP_TIMEOUT;
    let mut resolved_health_url: Option<String> = None;
    let mut url_file_error: Option<String> = None;

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                *state.otunnel_pid.lock() = None;
                state.clear_otunnel_runtime();
                let log = fs::read_to_string(&log_file).unwrap_or_default();
                return Err(format_startup_failure(
                    configured_port,
                    &format!("进程退出码: {}", status),
                    &log,
                ));
            }
            Ok(None) => {}
            Err(error) => {
                let _ = kill_process_tree(pid);
                *state.otunnel_pid.lock() = None;
                state.clear_otunnel_runtime();
                return Err(format!("检查 otunnel 启动状态失败：{}", error));
            }
        }

        if resolved_health_url.is_none() && health_url_file.exists() {
            match read_health_base_url(&health_url_file) {
                Ok((base_url, _)) => resolved_health_url = Some(base_url),
                Err(error) => url_file_error = Some(error),
            }
        }

        if let Some(base_url) = resolved_health_url.as_deref() {
            let health_url = format!("{}/healthz", base_url.trim_end_matches('/'));
            if startup_client
                .get(health_url)
                .send()
                .await
                .map(|response| response.status().is_success())
                .unwrap_or(false)
            {
                *state.otunnel_health_url.lock() = Some(base_url.to_string());
                return Ok(pid);
            }
        }

        if Instant::now() >= deadline {
            let _ = kill_process_tree(pid);
            *state.otunnel_pid.lock() = None;
            state.clear_otunnel_runtime();
            let log = fs::read_to_string(&log_file).unwrap_or_default();
            let detail = url_file_error
                .unwrap_or_else(|| "等待健康检查地址与 /healthz 响应超过 10 秒".to_string());
            return Err(format_startup_failure(configured_port, &detail, &log));
        }

        tokio::time::sleep(OTUNNEL_STARTUP_POLL_INTERVAL).await;
    }
}

#[tauri::command]
pub async fn stop_otunnel(state: State<'_, Arc<AppState>>) -> Result<bool, String> {
    let pid_opt = *state.otunnel_pid.lock();
    let mut killed = false;

    if let Some(pid) = pid_opt {
        if kill_process_tree(pid) {
            killed = true;
        }
        *state.otunnel_pid.lock() = None;
    }

    // If the daemon was started outside the current in-memory state but is still
    // discoverable by name, terminate that single daemon as a fallback. This is
    // platform-neutral and avoids broad `killall`/`taskkill /IM` side effects.
    if !killed {
        if let Some(pid) = find_process_by_name("otunnel") {
            killed = kill_process_tree(pid);
        }
    }

    state.clear_otunnel_runtime();

    Ok(killed)
}

#[tauri::command]
pub async fn restart_otunnel(state: State<'_, Arc<AppState>>) -> Result<u32, String> {
    let _ = stop_otunnel(state.clone()).await;
    tokio::time::sleep(std::time::Duration::from_millis(600)).await;
    start_otunnel(state).await
}

fn normalize_active_chappie_collision(
    items: &mut [DoctorCheckItem],
    overall: &mut String,
    raw_output: &str,
    existing_daemon_ready: bool,
) {
    if !existing_daemon_ready {
        return;
    }

    let lower = raw_output.to_ascii_lowercase();
    let is_chappie_endpoint_collision = lower
        .lines()
        .any(|line| line.contains("eaddrinuse") && line.contains("chappie"))
        && items.iter().any(|item| {
            item.name == "mcp_server_reachable"
                && item.status == "FAIL"
                && item
                    .details
                    .to_ascii_lowercase()
                    .contains("connection closed before the request completed")
        })
        && items
            .iter()
            .any(|item| item.name == "shutdown" && item.status == "FAIL");

    if !is_chappie_endpoint_collision {
        return;
    }

    for item in items.iter_mut() {
        match item.name.as_str() {
            "mcp_server_reachable" => {
                item.status = "PASS".to_string();
                item.details = "现有 otunnel 守护进程的 MCP 通道已就绪；Doctor 启动重复 Chappie 实例时检测到命名端点已被占用".to_string();
                item.suggestion = None;
            }
            "shutdown" => {
                item.status = "SKIP".to_string();
                item.details = "Doctor 的重复 Chappie 子进程因命名端点已由现有守护进程占用而退出，现有实例未受影响".to_string();
                item.suggestion = None;
            }
            _ => {}
        }
    }

    *overall = if items.iter().any(|item| item.status == "FAIL") {
        "FAIL".to_string()
    } else {
        "PASS".to_string()
    };
}

#[tauri::command]
pub async fn run_otunnel_doctor(state: State<'_, Arc<AppState>>) -> Result<DoctorReport, String> {
    ensure_chappie_yaml_synced();
    let configured_port = state.settings.lock().health_port;
    let existing_daemon_ready = get_otunnel_status(state.clone())
        .await
        .map(|status| status.running && status.healthz_ok && status.readyz_ok)
        .unwrap_or(false);

    let mut args = vec!["doctor".to_string()];
    if let Some(profile_file) = get_chappie_yaml_path() {
        args.push("--profile-file".to_string());
        args.push(profile_file.to_string_lossy().to_string());
    } else {
        args.push("--profile".to_string());
        args.push("chappie".to_string());
    }
    args.push("--health.listen-addr".to_string());
    args.push(format!("127.0.0.1:{}", configured_port));

    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let out = execute_cmd("otunnel", &args_ref, None);
    let full_raw = format!("{}\n{}", out.stdout, out.stderr);

    let mut items = Vec::new();
    let mut overall = if out.success {
        "PASS".to_string()
    } else {
        "FAIL".to_string()
    };

    for line in full_raw.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("CHECK ") {
            let parts: Vec<&str> = trimmed.split_whitespace().collect();
            if parts.len() >= 3 {
                let name = parts[1].to_string();
                let status = parts[2].to_string();
                let details = if parts.len() > 3 {
                    parts[3..].join(" ")
                } else {
                    String::new()
                };

                let suggestion = match (name.as_str(), status.as_str()) {
                    ("mcp_server_reachable", "FAIL") => Some(
                        "本地 MCP 进程未能成功启动或响应。请检查系统 Node.js 是否 >= 26，并在终端执行 'pi --chappie' 确认是否存在语法或模块错误。".to_string(),
                    ),
                    ("health_listener", "FAIL") => Some(
                        if configured_port == 0 {
                            "系统自动分配健康检查端口失败。请先停止已有的 otunnel 实例，并检查本机网络权限或安全软件拦截。".to_string()
                        } else {
                            format!(
                                "健康检查端口 {} 无法绑定，可能已被占用或被系统保留。建议在设置中改为自动端口（0）。",
                                configured_port
                            )
                        },
                    ),
                    ("control_plane_connection", "FAIL") => Some(
                        "无法连接 OpenAI 控制面。请检查网络是否能访问 api.openai.com，或检查系统代理设置。".to_string(),
                    ),
                    ("control_plane_api_key", "FAIL") => Some(
                        "API Key 无效。请在 OpenAI Platform 创建只包含 Tunnels: Read/Use 权限的 Key 并填入设置。".to_string(),
                    ),
                    ("tunnel_id", "FAIL") => Some(
                        "Tunnel ID 校验失败。请确认在 OpenAI 平台创建的 Tunnel 状态是否正常。".to_string(),
                    ),
                    _ => None,
                };

                items.push(DoctorCheckItem {
                    name,
                    status,
                    details,
                    suggestion,
                });
            }
        } else if trimmed.starts_with("RESULT ") {
            let res = trimmed.trim_start_matches("RESULT ").trim();
            overall = if res == "ok" {
                "PASS".to_string()
            } else {
                "FAIL".to_string()
            };
        }
    }

    // If items were empty because command failed before CHECK lines, add raw error item
    if items.is_empty() {
        items.push(DoctorCheckItem {
            name: "otunnel_execution".to_string(),
            status: "FAIL".to_string(),
            details: full_raw.clone(),
            suggestion: Some(
                "请检查 otunnel 是否安装，以及 Profile 配置是否正确初始化。".to_string(),
            ),
        });
        overall = "FAIL".to_string();
    }

    normalize_active_chappie_collision(&mut items, &mut overall, &full_raw, existing_daemon_ready);

    Ok(DoctorReport {
        overall,
        items,
        raw_output: full_raw,
    })
}

#[tauri::command]
pub async fn probe_network_latency() -> Result<u64, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(4000))
        .build()
        .map_err(|e| e.to_string())?;

    let start = Instant::now();
    let res = client.get("https://api.openai.com").send().await;
    match res {
        Ok(_) => Ok(start.elapsed().as_millis() as u64),
        Err(err) => Err(format!("网络探测失败: {}", err)),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        format_startup_failure, normalize_active_chappie_collision, parse_health_base_url,
    };
    use crate::models::DoctorCheckItem;

    fn doctor_item(name: &str, status: &str, details: &str) -> DoctorCheckItem {
        DoctorCheckItem {
            name: name.to_string(),
            status: status.to_string(),
            details: details.to_string(),
            suggestion: Some("original suggestion".to_string()),
        }
    }

    #[test]
    fn parses_ephemeral_health_url() {
        let (url, port) = parse_health_base_url("http://127.0.0.1:53147\n")
            .expect("valid loopback URL should parse");

        assert_eq!(url, "http://127.0.0.1:53147");
        assert_eq!(port, 53147);
    }

    #[test]
    fn rejects_non_loopback_health_url() {
        let error = parse_health_base_url("http://example.com:53147")
            .expect_err("remote health URL should be rejected");

        assert!(error.contains("不是本机回环地址"));
    }

    #[test]
    fn explains_fixed_port_bind_failures() {
        let error = format_startup_failure(
            18080,
            "进程退出码: 1",
            "bind health listener 127.0.0.1:18080: os error 10048",
        );

        assert!(error.contains("端口 18080"));
        assert!(error.contains("占用"));
        assert!(error.contains("自动端口（0）"));
    }

    #[test]
    fn keeps_generic_startup_failures_actionable() {
        let error = format_startup_failure(0, "进程退出码: 2", "invalid api key");

        assert!(error.contains("otunnel 启动失败"));
        assert!(error.contains("配置、凭据和本地 MCP 命令"));
    }

    #[test]
    fn treats_duplicate_chappie_child_as_healthy_when_daemon_is_ready() {
        let mut items = vec![
            doctor_item(
                "mcp_server_reachable",
                "FAIL",
                "MCP connection closed before the request completed",
            ),
            doctor_item(
                "control_plane_connection",
                "PASS",
                "tunnel metadata received",
            ),
            doctor_item("shutdown", "FAIL", "child exited: exit code: 1"),
        ];
        let mut overall = "FAIL".to_string();
        let raw = r"listen EADDRINUSE: address already in use \\.\pipe\chappie-abc";

        normalize_active_chappie_collision(&mut items, &mut overall, raw, true);

        assert_eq!(overall, "PASS");
        assert_eq!(items[0].status, "PASS");
        assert_eq!(items[0].suggestion, None);
        assert_eq!(items[2].status, "SKIP");
        assert_eq!(items[2].suggestion, None);
    }

    #[test]
    fn keeps_chappie_collision_failure_when_daemon_is_not_ready() {
        let mut items = vec![
            doctor_item(
                "mcp_server_reachable",
                "FAIL",
                "MCP connection closed before the request completed",
            ),
            doctor_item("shutdown", "FAIL", "child exited: exit code: 1"),
        ];
        let mut overall = "FAIL".to_string();
        let raw = r"listen EADDRINUSE: address already in use \\.\pipe\chappie-abc";

        normalize_active_chappie_collision(&mut items, &mut overall, raw, false);

        assert_eq!(overall, "FAIL");
        assert_eq!(items[0].status, "FAIL");
        assert_eq!(items[1].status, "FAIL");
    }

    #[test]
    fn preserves_other_doctor_failures_during_active_chappie_collision() {
        let mut items = vec![
            doctor_item(
                "mcp_server_reachable",
                "FAIL",
                "MCP connection closed before the request completed",
            ),
            doctor_item("control_plane_connection", "FAIL", "request timed out"),
            doctor_item("shutdown", "FAIL", "child exited: exit code: 1"),
        ];
        let mut overall = "FAIL".to_string();
        let raw = r"listen EADDRINUSE: address already in use \\.\pipe\chappie-abc";

        normalize_active_chappie_collision(&mut items, &mut overall, raw, true);

        assert_eq!(overall, "FAIL");
        assert_eq!(items[0].status, "PASS");
        assert_eq!(items[1].status, "FAIL");
        assert_eq!(items[2].status, "SKIP");
    }

    #[test]
    fn does_not_mistake_an_unrelated_bind_failure_for_chappie_collision() {
        let mut items = vec![
            doctor_item("mcp_target", "PASS", "pi --chappie"),
            doctor_item(
                "mcp_server_reachable",
                "FAIL",
                "MCP connection closed before the request completed",
            ),
            doctor_item("shutdown", "FAIL", "child exited: exit code: 1"),
            doctor_item("health_listener", "FAIL", "listen EADDRINUSE"),
        ];
        let mut overall = "FAIL".to_string();
        let raw = "CHECK mcp_target PASS pi --chappie\nlisten EADDRINUSE: 127.0.0.1:8080";

        normalize_active_chappie_collision(&mut items, &mut overall, raw, true);

        assert_eq!(overall, "FAIL");
        assert_eq!(items[1].status, "FAIL");
        assert_eq!(items[2].status, "FAIL");
    }
}
