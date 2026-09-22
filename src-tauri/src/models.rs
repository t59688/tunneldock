use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvCheckItem {
    pub id: String,
    pub name: String,
    pub category: String, // "runtime", "tools", "mcp", "credentials"
    pub installed: bool,
    pub version: Option<String>,
    pub required_version: Option<String>,
    pub path: Option<String>,
    pub status: String, // "ready", "missing", "outdated", "warning", "config_needed"
    pub message: String,
    pub can_auto_install: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallProgressEvent {
    pub item_id: String,
    pub stage: String, // "starting", "downloading", "installing", "success", "failed"
    pub log_line: String,
    pub is_error: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DoctorCheckItem {
    pub name: String,
    pub status: String, // "PASS", "FAIL", "SKIP"
    pub details: String,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DoctorReport {
    pub overall: String, // "PASS", "FAIL"
    pub items: Vec<DoctorCheckItem>,
    pub raw_output: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OtunnelDaemonStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub healthz_ok: bool,
    pub readyz_ok: bool,
    pub latency_ms: Option<u64>,
    pub listen_port: Option<u16>,
    pub health_base_url: Option<String>,
    pub tunnel_id: Option<String>,
    pub uptime_seconds: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceItem {
    pub id: String,
    pub name: String,
    pub path: String,
    pub status: String, // "stopped", "starting", "ready", "executing", "error"
    pub session_id: Option<String>,
    pub pid: Option<u32>,
    pub binding_count: u32,
    pub git_branch: Option<String>,
    pub git_status: Option<String>,
    pub last_started_at: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpCallRecord {
    pub id: String,
    pub timestamp: String,
    pub session_id: Option<String>,
    #[serde(default)]
    pub workspace_id: Option<String>,
    pub workspace_name: Option<String>,
    pub tool_name: String, // "read", "bash", "edit", "write", "transfer", "sessions", "init", "chat"
    pub args_json: String,
    pub result_summary: String,
    pub status: String, // "success", "executing", "error"
    pub duration_ms: u64,
    #[serde(default)]
    pub input_tokens: u64,
    #[serde(default)]
    pub output_tokens: u64,
    #[serde(default)]
    pub total_tokens: u64,
}

fn default_locale() -> String {
    "zh-CN".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TunnelSettings {
    pub tunnel_id: String,
    pub api_key: String,
    pub key_file_path: String,
    pub health_port: u16,
    pub profile_name: String,
    #[serde(default = "default_locale")]
    pub locale: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandOutput {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub code: Option<i32>,
}

#[cfg(test)]
mod tests {
    use super::{McpCallRecord, TunnelSettings};

    #[test]
    fn old_history_records_default_workspace_identity_and_tokens() {
        let legacy = r#"{
            "id":"legacy-1",
            "timestamp":"2026-09-16 03:14:11",
            "session_id":null,
            "workspace_name":"旧工作区",
            "tool_name":"read",
            "args_json":"{}",
            "result_summary":"ok",
            "status":"success",
            "duration_ms":12
        }"#;

        let record: McpCallRecord =
            serde_json::from_str(legacy).expect("legacy history should still load");

        assert_eq!(record.workspace_id, None);
        assert_eq!(record.input_tokens, 0);
        assert_eq!(record.output_tokens, 0);
        assert_eq!(record.total_tokens, 0);
    }

    #[test]
    fn legacy_settings_without_locale_defaults_to_zh_cn() {
        let legacy = r#"{
            "tunnel_id": "tunnel_123",
            "api_key": "sk-xxx",
            "key_file_path": "/path/key",
            "health_port": 0,
            "profile_name": "chappie"
        }"#;

        let settings: TunnelSettings =
            serde_json::from_str(legacy).expect("legacy settings without locale should still load");
        assert_eq!(settings.locale, "zh-CN");
    }
}
