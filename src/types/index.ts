export type EnvStatus = "ready" | "missing" | "outdated" | "warning" | "config_needed";

export interface EnvCheckItem {
  id: string;
  name: string;
  category: "runtime" | "tools" | "mcp" | "credentials";
  installed: boolean;
  version: string | null;
  required_version: string | null;
  path: string | null;
  status: EnvStatus;
  message: string;
  can_auto_install: boolean;
}

export interface InstallProgressEvent {
  item_id: string;
  stage: string;
  log_line: string;
  is_error: boolean;
}

export interface DoctorCheckItem {
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  details: string;
  suggestion: string | null;
}

export interface DoctorReport {
  overall: "PASS" | "FAIL";
  items: DoctorCheckItem[];
  raw_output: string;
}

export interface OtunnelDaemonStatus {
  running: boolean;
  pid: number | null;
  healthz_ok: boolean;
  readyz_ok: boolean;
  latency_ms: number | null;
  listen_port: number | null;
  health_base_url: string | null;
  tunnel_id: string | null;
  uptime_seconds: number | null;
}

export type WorkspaceStatus = "stopped" | "starting" | "ready" | "executing" | "error";

export interface WorkspaceItem {
  id: string;
  name: string;
  path: string;
  status: WorkspaceStatus;
  session_id: string | null;
  pid: number | null;
  binding_count: number;
  git_branch: string | null;
  git_status: string | null;
  last_started_at: string | null;
  error_message: string | null;
}

export interface McpCallRecord {
  id: string;
  timestamp: string;
  session_id: string | null;
  workspace_id: string | null;
  workspace_name: string | null;
  tool_name: string;
  args_json: string;
  result_summary: string;
  status: "success" | "executing" | "error";
  duration_ms: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export type Locale = "zh-CN" | "en-US";

export interface TunnelSettings {
  tunnel_id: string;
  api_key: string;
  key_file_path: string;
  health_port: number;
  profile_name: string;
  locale: string;
}
