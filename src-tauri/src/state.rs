use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use parking_lot::Mutex;

use crate::models::{McpCallRecord, TunnelSettings, WorkspaceItem};
use crate::utils::cmd::kill_process_tree;
use crate::utils::paths::{ensure_chappie_yaml_synced, get_chappie_yaml_path};
use crate::utils::time::normalize_timestamp_to_local;

const APP_DATA_DIR_NAME: &str = "TunnelDock";
const LEGACY_APP_DATA_DIR_NAMES: [&str; 2] = ["local-mcp-console", "chappie-desktop"];
const PERSISTED_FILES: [&str; 3] = ["settings.json", "workspaces.json", "history.json"];

pub struct AppState {
    pub workspaces: Arc<Mutex<Vec<WorkspaceItem>>>,
    pub running_workspace_pids: Arc<Mutex<HashMap<String, u32>>>,
    pub running_workspace_stdins: Arc<Mutex<HashMap<String, std::process::ChildStdin>>>,
    pub otunnel_pid: Arc<Mutex<Option<u32>>>,
    pub otunnel_health_url: Arc<Mutex<Option<String>>>,
    pub otunnel_health_url_file: Arc<Mutex<Option<PathBuf>>>,
    pub history: Arc<Mutex<Vec<McpCallRecord>>>,
    pub settings: Arc<Mutex<TunnelSettings>>,
    pub app_data_dir: PathBuf,
    cleanup_started: AtomicBool,
}

impl AppState {
    pub fn new() -> Self {
        let app_data_dir = Self::resolve_app_data_dir();

        let settings = Self::load_settings(&app_data_dir);
        let workspaces = Self::load_workspaces(&app_data_dir);
        let history = Self::load_history(&app_data_dir);

        Self {
            workspaces: Arc::new(Mutex::new(workspaces)),
            running_workspace_pids: Arc::new(Mutex::new(HashMap::new())),
            running_workspace_stdins: Arc::new(Mutex::new(HashMap::new())),
            otunnel_pid: Arc::new(Mutex::new(None)),
            otunnel_health_url: Arc::new(Mutex::new(None)),
            otunnel_health_url_file: Arc::new(Mutex::new(None)),
            history: Arc::new(Mutex::new(history)),
            settings: Arc::new(Mutex::new(settings)),
            app_data_dir,
            cleanup_started: AtomicBool::new(false),
        }
    }

    fn resolve_app_data_dir() -> PathBuf {
        let base_dir = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
        Self::resolve_app_data_dir_in(&base_dir)
    }

    fn resolve_app_data_dir_in(base_dir: &Path) -> PathBuf {
        let app_data_dir = base_dir.join(APP_DATA_DIR_NAME);

        if !app_data_dir.exists() {
            for legacy_name in LEGACY_APP_DATA_DIR_NAMES {
                let legacy_app_data_dir = base_dir.join(legacy_name);
                if legacy_app_data_dir.exists() {
                    if fs::rename(&legacy_app_data_dir, &app_data_dir).is_err() {
                        let _ = fs::create_dir_all(&app_data_dir);
                        Self::copy_legacy_data(&legacy_app_data_dir, &app_data_dir);
                    }
                    break;
                }
            }
        }

        let _ = fs::create_dir_all(&app_data_dir);
        app_data_dir
    }

    fn copy_legacy_data(source_dir: &Path, target_dir: &Path) {
        for file_name in PERSISTED_FILES {
            let source = source_dir.join(file_name);
            let target = target_dir.join(file_name);
            if source.exists() && !target.exists() {
                let _ = fs::copy(source, target);
            }
        }
    }

    pub fn cleanup_all_processes(&self) {
        // Shutdown can be observed through ExitRequested, Exit and Drop. Only the
        // first caller performs cleanup so we never wait on the same children more
        // than once during application teardown.
        if self.cleanup_started.swap(true, Ordering::AcqRel) {
            return;
        }

        // 1. Close RPC stdin first so well-behaved Pi children can observe EOF.
        self.running_workspace_stdins.lock().clear();

        // 2. Terminate only processes owned/tracked by this application. The
        // platform-neutral sysinfo implementation avoids blocking shell commands.
        if let Some(pid) = self.otunnel_pid.lock().take() {
            let _ = kill_process_tree(pid);
        }
        self.clear_otunnel_runtime();

        let pids: Vec<u32> = self.running_workspace_pids.lock().values().copied().collect();
        self.running_workspace_pids.lock().clear();
        for pid in pids {
            let _ = kill_process_tree(pid);
        }

        // 3. Persist a clean stopped state for the next launch.
        let mut list = self.workspaces.lock();
        for w in list.iter_mut() {
            w.status = "stopped".to_string();
            w.pid = None;
        }
        drop(list);
        self.save_workspaces();
    }

    fn load_settings(data_dir: &PathBuf) -> TunnelSettings {
        let file = data_dir.join("settings.json");
        if let Ok(content) = fs::read_to_string(&file) {
            if let Ok(mut settings) = serde_json::from_str::<TunnelSettings>(&content) {
                // 8080 was TunnelDock's legacy hard-coded default. Migrate it to
                // automatic allocation so upgrades do not retain the collision-prone
                // behavior. Users can still choose any explicit non-zero port later.
                if settings.health_port == 8080 {
                    settings.health_port = 0;
                    if let Ok(json) = serde_json::to_string_pretty(&settings) {
                        let _ = fs::write(&file, json);
                    }
                }
                return settings;
            }
        }

        // Try reading existing from ~/.chappie/tunnelkey.txt or chappie.yaml if present.
        // These names belong to the Chappie/otunnel integration and are intentionally
        // retained independently from the TunnelDock product brand.
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        let key_file = home.join(".chappie").join("tunnelkey.txt");
        let key = if key_file.exists() {
            fs::read_to_string(&key_file).unwrap_or_default().trim().to_string()
        } else {
            String::new()
        };

        ensure_chappie_yaml_synced();

        // Try reading tunnel_id from chappie.yaml across all standard locations.
        let mut tunnel_id = String::new();
        if let Some(yaml_file) = get_chappie_yaml_path() {
            if let Ok(yaml_content) = fs::read_to_string(yaml_file) {
                for line in yaml_content.lines() {
                    if line.trim().starts_with("tunnel_id:") {
                        tunnel_id = line
                            .trim()
                            .trim_start_matches("tunnel_id:")
                            .trim()
                            .to_string();
                        break;
                    }
                }
            }
        }

        TunnelSettings {
            tunnel_id,
            api_key: key,
            key_file_path: key_file.to_string_lossy().to_string(),
            health_port: 0,
            profile_name: "chappie".to_string(),
            locale: "zh-CN".to_string(),
        }
    }

    pub fn clear_otunnel_runtime(&self) {
        self.otunnel_health_url.lock().take();
        if let Some(path) = self.otunnel_health_url_file.lock().take() {
            let _ = fs::remove_file(path);
        }
    }

    pub fn save_settings(&self) {
        let settings = self.settings.lock().clone();
        let file = self.app_data_dir.join("settings.json");
        if let Ok(json) = serde_json::to_string_pretty(&settings) {
            let _ = fs::write(file, json);
        }
    }

    fn load_workspaces(data_dir: &PathBuf) -> Vec<WorkspaceItem> {
        let file = data_dir.join("workspaces.json");
        if let Ok(content) = fs::read_to_string(&file) {
            if let Ok(list) = serde_json::from_str::<Vec<WorkspaceItem>>(&content) {
                // When app starts, reset running state to stopped.
                return list
                    .into_iter()
                    .map(|mut w| {
                        w.status = "stopped".to_string();
                        w.pid = None;
                        w
                    })
                    .collect();
            }
        }
        Vec::new()
    }

    pub fn save_workspaces(&self) {
        let list = self.workspaces.lock().clone();
        let file = self.app_data_dir.join("workspaces.json");
        if let Ok(json) = serde_json::to_string_pretty(&list) {
            let _ = fs::write(file, json);
        }
    }

    fn load_history(data_dir: &PathBuf) -> Vec<McpCallRecord> {
        let file = data_dir.join("history.json");
        if let Ok(content) = fs::read_to_string(&file) {
            if let Ok(list) = serde_json::from_str::<Vec<McpCallRecord>>(&content) {
                let history = Self::sanitize_history(list);
                if let Ok(json) = serde_json::to_string_pretty(&history) {
                    let _ = fs::write(&file, json);
                }
                return history;
            }
        }
        Vec::new()
    }

    fn sanitize_history(history: Vec<McpCallRecord>) -> Vec<McpCallRecord> {
        history
            .into_iter()
            .filter(|record| record.id != "init_sample_1" && record.id != "sessions_sample_2")
            .map(|mut record| {
                record.timestamp = normalize_timestamp_to_local(&record.timestamp);
                record
            })
            .collect()
    }

    pub fn save_history(&self) {
        let list = self.history.lock().clone();
        let file = self.app_data_dir.join("history.json");
        if let Ok(json) = serde_json::to_string_pretty(&list) {
            let _ = fs::write(file, json);
        }
    }
}

impl Drop for AppState {
    fn drop(&mut self) {
        self.cleanup_all_processes();
    }
}

#[cfg(test)]
mod tests {
    use super::AppState;
    use crate::models::McpCallRecord;
    use crate::utils::time::normalize_timestamp_to_local;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temporary_data_root(case: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock must be after Unix epoch")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "tunneldock-state-test-{}-{}-{}",
            std::process::id(),
            nonce,
            case
        ))
    }

    #[test]
    fn migrates_data_from_all_pre_tunneldock_directories() {
        for legacy_name in ["local-mcp-console", "chappie-desktop"] {
            let base_dir = temporary_data_root(legacy_name);
            let legacy_dir = base_dir.join(legacy_name);
            fs::create_dir_all(&legacy_dir).expect("legacy directory should be created");
            fs::write(legacy_dir.join("settings.json"), legacy_name)
                .expect("legacy settings should be written");

            let resolved = AppState::resolve_app_data_dir_in(&base_dir);

            assert_eq!(resolved, base_dir.join("TunnelDock"));
            assert_eq!(
                fs::read_to_string(resolved.join("settings.json"))
                    .expect("migrated settings should exist"),
                legacy_name
            );
            fs::remove_dir_all(base_dir).expect("test data should be removed");
        }
    }

    #[test]
    fn removes_only_the_two_legacy_demo_history_records() {
        let records: Vec<McpCallRecord> = serde_json::from_str(
            r#"[
                {"id":"init_sample_1","timestamp":"x","session_id":null,"workspace_name":"系统初始化","tool_name":"init","args_json":"{}","result_summary":"demo","status":"success","duration_ms":45},
                {"id":"sessions_sample_2","timestamp":"x","session_id":null,"workspace_name":"MCP Broker","tool_name":"sessions","args_json":"{}","result_summary":"demo","status":"success","duration_ms":18},
                {"id":"real-call","timestamp":"x","session_id":"s1","workspace_name":"hola","tool_name":"read","args_json":"{}","result_summary":"ok","status":"success","duration_ms":3}
            ]"#,
        )
        .expect("fixture should deserialize");

        let sanitized = AppState::sanitize_history(records);

        assert_eq!(sanitized.len(), 1);
        assert_eq!(sanitized[0].id, "real-call");
    }

    #[test]
    fn migrates_legacy_history_timestamps_and_persists_the_local_offset() {
        let data_dir = temporary_data_root("history-timezone");
        fs::create_dir_all(&data_dir).expect("test data directory should be created");
        fs::write(
            data_dir.join("history.json"),
            r#"[{
                "id":"legacy-call",
                "timestamp":"2026-09-18 03:04:04",
                "session_id":null,
                "workspace_name":"hola",
                "tool_name":"read",
                "args_json":"{}",
                "result_summary":"ok",
                "status":"success",
                "duration_ms":10
            }]"#,
        )
        .expect("legacy history should be written");

        let history = AppState::load_history(&data_dir);
        let expected = normalize_timestamp_to_local("2026-09-18 03:04:04");
        let persisted: Vec<McpCallRecord> = serde_json::from_str(
            &fs::read_to_string(data_dir.join("history.json"))
                .expect("migrated history should be readable"),
        )
        .expect("migrated history should remain valid JSON");

        assert_eq!(history[0].timestamp, expected);
        assert_eq!(persisted[0].timestamp, expected);
        fs::remove_dir_all(data_dir).expect("test data should be removed");
    }
}
