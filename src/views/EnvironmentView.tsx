import React, { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  RefreshCw,
  FolderOpen,
  ArrowUpRight,
  Sliders,
  Terminal as TerminalIcon,
  Trash2,
} from "lucide-react";
import { EnvCheckItem, TunnelSettings } from "../types";
import {
  installComponent,
  uninstallComponent,
  openPathInExplorer,
  saveTunnelCredentials,
} from "../api";
import { useTranslation } from "../i18n";

interface EnvironmentViewProps {
  items: EnvCheckItem[];
  loading: boolean;
  onRefresh: () => void | Promise<void>;
  onOpenTerminal: () => void;
  settings: TunnelSettings | null;
  onSaveSettings: () => void | Promise<void>;
}

export const EnvironmentView: React.FC<EnvironmentViewProps> = ({
  items,
  loading,
  onRefresh,
  onOpenTerminal,
  settings,
  onSaveSettings,
}) => {
  const { t } = useTranslation();
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [uninstallingId, setUninstallingId] = useState<string | null>(null);
  const [pendingUninstall, setPendingUninstall] = useState<EnvCheckItem | null>(
    null
  );
  const [isAutoInstalling, setIsAutoInstalling] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [inputTunnelId, setInputTunnelId] = useState(settings?.tunnel_id || "");
  const [inputApiKey, setInputApiKey] = useState(settings?.api_key || "");
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const formatError = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    try {
      return JSON.stringify(error);
    } catch {
      return t("env_view.unknown_error");
    }
  };

  const getUninstallImpact = (item: EnvCheckItem): string => {
    switch (item.id) {
      case "node":
      case "npm":
        return t("env_view.impact_node");
      case "git":
        return t("env_view.impact_git");
      case "cargo":
        return t("env_view.impact_cargo");
      case "cargo_binstall":
        return t("env_view.impact_cargo_binstall");
      case "otunnel":
        return t("env_view.impact_otunnel");
      case "pi":
        return t("env_view.impact_pi");
      case "chappie":
        return t("env_view.impact_chappie");
      case "tunnel_key":
        return t("env_view.impact_tunnel_key");
      case "tunnel_config":
        return t("env_view.impact_tunnel_config");
      default:
        return t("env_view.impact_default");
    }
  };

  const readyCount = items.filter((i) => i.status === "ready").length;
  const missingItems = items.filter(
    (i) => i.status === "missing" || i.status === "outdated"
  );
  const configNeededItems = items.filter((i) => i.status === "config_needed");
  const isAllReady = readyCount === items.length && items.length > 0;
  const operationBusy =
    isAutoInstalling || installingId !== null || uninstallingId !== null;

  const handleInstallOne = async (id: string) => {
    if (operationBusy) return;
    try {
      setActionError(null);
      setInstallingId(id);
      onOpenTerminal();
      await installComponent(id);
      await onRefresh();
    } catch (error) {
      setActionError(`${t("env_view.install_failed_prefix")}${formatError(error)}`);
      console.error(error);
    } finally {
      setInstallingId(null);
    }
  };

  const handleAutoInstallAll = async () => {
    if (operationBusy) return;
    setActionError(null);
    setIsAutoInstalling(true);
    onOpenTerminal();
    const failures: string[] = [];

    for (const item of missingItems) {
      if (!item.can_auto_install) continue;
      setInstallingId(item.id);
      try {
        await installComponent(item.id);
      } catch (error) {
        failures.push(`${item.name}: ${formatError(error)}`);
        console.error(error);
      }
    }

    setInstallingId(null);
    setIsAutoInstalling(false);
    await onRefresh();
    if (failures.length > 0) {
      setActionError(
        t("env_view.auto_install_partial_failed", { failures: failures.join("; ") })
      );
    }
  };

  const handleConfirmUninstall = async () => {
    if (!pendingUninstall || operationBusy) return;
    const item = pendingUninstall;

    try {
      setActionError(null);
      setUninstallingId(item.id);
      onOpenTerminal();
      await uninstallComponent(item.id);
      setPendingUninstall(null);
      await onRefresh();
      await onSaveSettings();
    } catch (error) {
      setActionError(`${t("env_view.uninstall_failed_prefix")}${formatError(error)}`);
      console.error(error);
    } finally {
      setUninstallingId(null);
    }
  };

  const handleSaveCredentials = async () => {
    if (!inputTunnelId.trim() || !inputApiKey.trim()) {
      setConfigError(t("env_view.config_empty_error"));
      return;
    }
    try {
      setConfigSaving(true);
      setConfigError(null);
      await saveTunnelCredentials(inputTunnelId.trim(), inputApiKey.trim());
      setShowConfigModal(false);
      await onSaveSettings();
      await onRefresh();
    } catch (error) {
      setConfigError(formatError(error));
    } finally {
      setConfigSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/60 shrink-0 whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            {t("env_view.badge_ready")}
          </span>
        );
      case "outdated":
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-800/60 shrink-0 whitespace-nowrap">
            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
            {t("env_view.badge_outdated")}
          </span>
        );
      case "warning":
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-800/60 shrink-0 whitespace-nowrap">
            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
            {t("env_view.badge_warning")}
          </span>
        );
      case "config_needed":
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-800/60 shrink-0 whitespace-nowrap">
            <Sliders className="w-3 h-3 text-amber-400 shrink-0" />
            {t("env_view.badge_config_needed")}
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-rose-950/40 text-rose-400 border border-rose-800/60 shrink-0 whitespace-nowrap">
            <XCircle className="w-3 h-3 text-rose-400 shrink-0" />
            {t("env_view.badge_missing")}
          </span>
        );
    }
  };

  const categories = [
    { key: "runtime", title: t("env_view.cat_runtime") },
    { key: "tools", title: t("env_view.cat_tools") },
    { key: "mcp", title: t("env_view.cat_mcp") },
    { key: "credentials", title: t("env_view.cat_credentials") },
  ];

  const destructiveHighImpact = pendingUninstall
    ? ["node", "npm", "cargo", "pi"].includes(pendingUninstall.id)
    : false;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="p-5 rounded-lg bg-dark-card border border-zinc-800/90 shadow-lg flex items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-100">
              {t("env_view.title")}
            </h2>
            <span className="text-xs font-mono text-zinc-500">
              {t("env_view.ready_summary", {
                ready: readyCount,
                total: items.length,
              })}
            </span>
          </div>
          <p className="text-xs text-zinc-400 max-w-xl">
            {isAllReady
              ? t("env_view.all_ready_desc")
              : t("env_view.issues_desc", {
                  count: missingItems.length + configNeededItems.length,
                })}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenTerminal}
            className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            <span>{t("env_view.view_output_btn")}</span>
          </button>

          <button
            onClick={() => void onRefresh()}
            disabled={loading || operationBusy}
            title={t("env_view.refresh_tooltip")}
            className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            <span>{t("env_view.refresh_tooltip")}</span>
          </button>

          {missingItems.length > 0 && (
            <button
              onClick={() => void handleAutoInstallAll()}
              disabled={operationBusy}
              className="flex items-center gap-2 px-4 py-2 rounded text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold shadow transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>
                {isAutoInstalling
                  ? t("env_view.auto_installing")
                  : t("env_view.auto_install_all")}
              </span>
            </button>
          )}

          {configNeededItems.length > 0 && missingItems.length === 0 && (
            <button
              onClick={() => setShowConfigModal(true)}
              disabled={operationBusy}
              className="flex items-center gap-2 px-4 py-2 rounded text-xs font-medium bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold shadow transition-all disabled:opacity-50"
            >
              <Sliders className="w-4 h-4" />
              <span>{t("env_view.config_btn")}</span>
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/60 text-xs text-rose-300 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="leading-relaxed break-words">{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-rose-300/70 hover:text-rose-200 shrink-0"
            aria-label="close error"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Categories Grouping */}
      <div className="space-y-6">
        {categories.map((cat) => {
          const catItems = items.filter((i) => i.category === cat.key);
          if (catItems.length === 0) return null;

          return (
            <div key={cat.key} className="space-y-3">
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {cat.title}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {catItems.map((item) => {
                  const isCurInstalling = installingId === item.id;
                  const isCurUninstalling = uninstallingId === item.id;

                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-lg bg-dark-card/90 border border-zinc-800 hover:border-zinc-700/80 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <div className="text-sm font-semibold text-zinc-100 flex items-center gap-2 flex-wrap">
                              <span className="truncate">{item.name}</span>
                              {item.version && (
                                <span
                                  className="font-mono text-xs text-zinc-400 truncate max-w-[180px] sm:max-w-[220px]"
                                  title={item.version}
                                >
                                  ({item.version})
                                </span>
                              )}
                            </div>
                            {item.required_version && (
                              <div className="text-[11px] font-mono text-zinc-500">
                                {t("env_view.required_version_label", {
                                  version: item.required_version,
                                })}
                              </div>
                            )}
                          </div>
                          {getStatusBadge(item.status)}
                        </div>

                        <p className="text-xs text-zinc-400 leading-relaxed">
                          {item.message}
                        </p>

                        {item.path && (
                          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 bg-zinc-950/70 px-2 py-1 rounded border border-zinc-800/80">
                            <span className="truncate pr-2">{item.path}</span>
                            <button
                              onClick={() => openPathInExplorer(item.path!)}
                              className="text-zinc-400 hover:text-zinc-200 shrink-0"
                              title={t("env_view.open_folder_tooltip")}
                            >
                              <FolderOpen className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between gap-3">
                        <span className="text-[11px] font-mono text-zinc-500 truncate">
                          ID: {item.id}
                        </span>

                        <div className="flex items-center gap-2 shrink-0">
                          {item.status !== "ready" && item.can_auto_install && (
                            <button
                              onClick={() => void handleInstallOne(item.id)}
                              disabled={operationBusy}
                              className="px-2.5 py-1 rounded text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <Download className="w-3 h-3 text-emerald-400" />
                              <span>
                                {isCurInstalling
                                  ? t("env_view.installing_btn")
                                  : item.status === "outdated"
                                  ? t("env_view.upgrade_btn")
                                  : t("env_view.install_btn")}
                              </span>
                            </button>
                          )}

                          {item.category === "credentials" && (
                            <button
                              onClick={() => {
                                setInputTunnelId(settings?.tunnel_id || "");
                                setInputApiKey(settings?.api_key || "");
                                setShowConfigModal(true);
                              }}
                              disabled={operationBusy}
                              className="px-2.5 py-1 rounded text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <Sliders className="w-3 h-3 text-amber-400" />
                              <span>{t("env_view.config_btn")}</span>
                            </button>
                          )}

                          {item.installed && (
                            <button
                              onClick={() => {
                                setActionError(null);
                                setPendingUninstall(item);
                              }}
                              disabled={operationBusy}
                              className="px-2.5 py-1 rounded text-xs font-medium bg-rose-950/30 hover:bg-rose-950/60 text-rose-300 border border-rose-900/70 hover:border-rose-800 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                              title={
                                item.category === "credentials"
                                  ? t("env_view.clear_btn")
                                  : t("env_view.uninstall_btn")
                              }
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>
                                {isCurUninstalling
                                  ? t("env_view.uninstalling_btn")
                                  : item.category === "credentials"
                                  ? t("env_view.clear_btn")
                                  : t("env_view.uninstall_btn")}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Uninstall confirmation modal */}
      {pendingUninstall && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-dark-card border border-rose-900/60 rounded-lg max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                {pendingUninstall.category === "credentials"
                  ? t("env_view.confirm_clear_btn")
                  : t("env_view.uninstall_dialog_title")}
                : <span className="text-rose-300">{pendingUninstall.name}</span>
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {getUninstallImpact(pendingUninstall)}
              </p>
            </div>

            {destructiveHighImpact && (
              <div className="p-3 rounded bg-amber-950/30 border border-amber-800/60 text-xs text-amber-300 leading-relaxed">
                {t("env_view.high_impact_warning")}
              </div>
            )}

            <div className="p-3 rounded bg-zinc-950/70 border border-zinc-800 text-[11px] font-mono text-zinc-400">
              {t("env_view.component_id_label", { id: pendingUninstall.id })}
              {pendingUninstall.path && (
                <div className="mt-1 break-all">
                  {t("env_view.current_path_label", {
                    path: pendingUninstall.path,
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setPendingUninstall(null)}
                disabled={uninstallingId !== null}
                className="px-3 py-1.5 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                {t("env_view.cancel_btn")}
              </button>
              <button
                onClick={() => void handleConfirmUninstall()}
                disabled={uninstallingId !== null}
                className="px-4 py-1.5 rounded text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {uninstallingId === pendingUninstall.id
                  ? t("env_view.uninstalling_btn")
                  : pendingUninstall.category === "credentials"
                  ? t("env_view.confirm_clear_btn")
                  : t("env_view.confirm_uninstall_btn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-zinc-800 rounded-lg max-w-md w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                {t("env_view.config_modal_title")}
              </h3>
              <p className="text-xs text-zinc-400">
                {t("env_view.config_modal_desc")}
              </p>
            </div>

            {configError && (
              <div className="p-3 rounded bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300">
                {configError}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-zinc-300 font-medium">
                    {t("env_view.tunnel_id_label")}
                  </label>
                  <a
                    href="https://platform.openai.com/settings/organization/tunnels"
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:underline flex items-center gap-1 text-[11px]"
                  >
                    <span>{t("env_view.create_tunnel_link")}</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </a>
                </div>
                <input
                  type="text"
                  placeholder={t("env_view.tunnel_id_placeholder")}
                  value={inputTunnelId}
                  onChange={(e) => setInputTunnelId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-zinc-600"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-zinc-300 font-medium">
                    {t("env_view.api_key_label")}
                  </label>
                  <a
                    href="https://platform.openai.com/settings/organization/api-keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:underline flex items-center gap-1 text-[11px]"
                  >
                    <span>{t("env_view.create_key_link")}</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </a>
                </div>
                <input
                  type="password"
                  placeholder={t("env_view.api_key_placeholder")}
                  value={inputApiKey}
                  onChange={(e) => setInputApiKey(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-zinc-600"
                />
                <p className="text-[11px] text-zinc-500">
                  {t("env_view.key_storage_hint")}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowConfigModal(false)}
                disabled={configSaving}
                className="px-3 py-1.5 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                {t("env_view.cancel_btn")}
              </button>
              <button
                onClick={() => void handleSaveCredentials()}
                disabled={configSaving}
                className="px-4 py-1.5 rounded text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold disabled:opacity-50"
              >
                {configSaving
                  ? t("env_view.saving_btn")
                  : t("env_view.save_btn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
