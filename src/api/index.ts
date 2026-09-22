import { invoke } from "@tauri-apps/api/core";
import {
  EnvCheckItem,
  DoctorReport,
  OtunnelDaemonStatus,
  WorkspaceItem,
  McpCallRecord,
  TunnelSettings,
} from "../types";

// Environment API
export async function checkEnvironment(): Promise<EnvCheckItem[]> {
  return await invoke<EnvCheckItem[]>("check_environment");
}

export async function installComponent(itemId: string): Promise<boolean> {
  const ok = await invoke<boolean>("install_component_v2", { itemId });
  if (!ok) {
    throw new Error(`组件 ${itemId} 安装后未通过可用性验证`);
  }
  return true;
}

export async function uninstallComponent(itemId: string): Promise<boolean> {
  const ok = await invoke<boolean>("uninstall_component", { itemId });
  if (!ok) {
    throw new Error(`组件 ${itemId} 卸载后未通过移除验证`);
  }
  return true;
}

export async function saveTunnelCredentials(
  tunnelId: string,
  apiKey: string,
  healthPort?: number
): Promise<TunnelSettings> {
  return await invoke<TunnelSettings>("save_tunnel_credentials", {
    tunnelId,
    apiKey,
    healthPort,
  });
}

// Otunnel & Health API
export async function getOtunnelStatus(): Promise<OtunnelDaemonStatus> {
  return await invoke<OtunnelDaemonStatus>("get_otunnel_status");
}

export async function startOtunnel(): Promise<number> {
  return await invoke<number>("start_otunnel");
}

export async function stopOtunnel(): Promise<boolean> {
  return await invoke<boolean>("stop_otunnel");
}

export async function restartOtunnel(): Promise<number> {
  return await invoke<number>("restart_otunnel");
}

export async function runOtunnelDoctor(): Promise<DoctorReport> {
  return await invoke<DoctorReport>("run_otunnel_doctor");
}

export async function probeNetworkLatency(): Promise<number> {
  return await invoke<number>("probe_network_latency");
}

// Workspace API
export async function listWorkspaces(): Promise<WorkspaceItem[]> {
  return await invoke<WorkspaceItem[]>("list_workspaces");
}

export async function addWorkspace(
  path: string,
  name?: string
): Promise<WorkspaceItem> {
  return await invoke<WorkspaceItem>("add_workspace", { path, name });
}

export async function removeWorkspace(workspaceId: string): Promise<boolean> {
  return await invoke<boolean>("remove_workspace", { workspaceId });
}

export async function startWorkspaceSession(
  workspaceId: string
): Promise<number> {
  return await invoke<number>("start_workspace_session", { workspaceId });
}

export async function stopWorkspaceSession(
  workspaceId: string
): Promise<boolean> {
  return await invoke<boolean>("stop_workspace_session", { workspaceId });
}

export async function restartWorkspaceSession(
  workspaceId: string
): Promise<number> {
  return await invoke<number>("restart_workspace_session", { workspaceId });
}

export async function generateChatGptPrompt(
  path: string,
  sessionId?: string | null,
  locale?: string | null
): Promise<string> {
  return await invoke<string>("generate_chatgpt_prompt", {
    path,
    sessionId: sessionId || null,
    locale: locale || null,
  });
}

// History API
export async function listHistory(): Promise<McpCallRecord[]> {
  return await invoke<McpCallRecord[]>("list_history");
}

export async function clearHistory(): Promise<boolean> {
  return await invoke<boolean>("clear_history");
}

export async function exportHistoryJson(): Promise<string> {
  return await invoke<string>("export_history_json");
}

// Settings API
export async function getSettings(): Promise<TunnelSettings> {
  return await invoke<TunnelSettings>("get_settings");
}

export async function updateSettings(
  newSettings: TunnelSettings
): Promise<TunnelSettings> {
  return await invoke<TunnelSettings>("update_settings", { newSettings });
}

export async function setLocale(locale: string): Promise<string> {
  return await invoke<string>("set_locale", { locale });
}

export async function refreshProcessEnvironment(): Promise<boolean> {
  return await invoke<boolean>("refresh_process_environment");
}

export async function openPathInExplorer(path: string): Promise<boolean> {
  return await invoke<boolean>("open_path_in_explorer", { path });
}

export async function getAppVersion(): Promise<string> {
  return await invoke<string>("get_app_version");
}

export async function resolveCloseRequest(
  action: "exit" | "hide" | "cancel"
): Promise<void> {
  await invoke("resolve_close_request", { action });
}
