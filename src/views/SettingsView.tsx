import React, { useState, useEffect } from "react";
import {
  Shield,
  FolderOpen,
  ArrowUpRight,
  Check,
  Save,
  Info,
  Server,
  Tag,
  RefreshCw,
  Download,
  LoaderCircle,
  Sparkles,
  Globe,
} from "lucide-react";
import { TunnelSettings } from "../types";
import { AppUpdateState } from "../hooks/useAppUpdater";
import { openPathInExplorer, saveTunnelCredentials } from "../api";
import { APP_VERSION } from "../version";
import { useTranslation } from "../i18n";

interface SettingsViewProps {
  settings: TunnelSettings | null;
  onRefreshSettings: () => void;
  updateState: AppUpdateState;
  onCheckUpdates: () => void;
  onOpenUpdater: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onRefreshSettings,
  updateState,
  onCheckUpdates,
  onOpenUpdater,
}) => {
  const { t, locale, setLocale } = useTranslation();
  const [tunnelId, setTunnelId] = useState(settings?.tunnel_id || "");
  const [apiKey, setApiKey] = useState(settings?.api_key || "");
  const [healthPort, setHealthPort] = useState<number>(
    settings?.health_port ?? 0
  );
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setTunnelId(settings.tunnel_id);
      setApiKey(settings.api_key);
      setHealthPort(settings.health_port);
    }
  }, [settings]);

  const handleSave = async () => {
    if (!tunnelId.trim() || !apiKey.trim()) {
      setErrorMessage(t("env_view.config_empty_error"));
      return;
    }
    if (!Number.isInteger(healthPort) || healthPort < 0 || healthPort > 65535) {
      setErrorMessage(t("settings_view.health_port_desc"));
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);
      await saveTunnelCredentials(tunnelId.trim(), apiKey.trim(), healthPort);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
      onRefreshSettings();
    } catch (err: any) {
      setErrorMessage(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Top Banner */}
      <div className="p-5 rounded-lg bg-dark-card border border-zinc-800/90 shadow-lg flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-100">
              {t("settings_view.banner_title")}
            </h2>
            <span className="text-xs font-mono text-zinc-500">
              (Profile: {settings?.profile_name || "chappie"})
            </span>
          </div>
          <p className="text-xs text-zinc-400 max-w-xl">
            {t("settings_view.banner_desc")}
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold shadow transition-all disabled:opacity-50"
        >
          {savedSuccess ? (
            <Check className="w-4 h-4 text-zinc-950" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>
            {saving
              ? t("settings_view.saving")
              : savedSuccess
              ? t("settings_view.saved")
              : t("settings_view.save_all")}
          </span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-3 rounded bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300">
          {errorMessage}
        </div>
      )}

      {/* Main Form Cards */}
      <div className="space-y-4">
        {/* Card 0: Language & Display Preferences */}
        <div className="p-5 rounded-lg bg-dark-card border border-zinc-800 space-y-4">
          <div>
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Globe className="w-4 h-4 text-sky-400" />
              <span>{t("settings_view.card_language_title")}</span>
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              {t("settings_view.card_language_desc")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setLocale("zh-CN")}
              className={`p-3.5 rounded-lg border text-left transition-all flex items-center justify-between ${
                locale === "zh-CN"
                  ? "bg-emerald-950/30 border-emerald-500/70 text-emerald-300 ring-1 ring-emerald-500/40"
                  : "bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              }`}
            >
              <div className="space-y-0.5">
                <div className="text-xs font-medium text-zinc-200">
                  {t("settings_view.lang_zh")}
                </div>
                <div className="text-[11px] font-mono text-zinc-500">
                  zh-CN / 简体中文
                </div>
              </div>
              {locale === "zh-CN" && (
                <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setLocale("en-US")}
              className={`p-3.5 rounded-lg border text-left transition-all flex items-center justify-between ${
                locale === "en-US"
                  ? "bg-emerald-950/30 border-emerald-500/70 text-emerald-300 ring-1 ring-emerald-500/40"
                  : "bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              }`}
            >
              <div className="space-y-0.5">
                <div className="text-xs font-medium text-zinc-200">
                  {t("settings_view.lang_en")}
                </div>
                <div className="text-[11px] font-mono text-zinc-500">
                  en-US / English
                </div>
              </div>
              {locale === "en-US" && (
                <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              )}
            </button>
          </div>
        </div>

        {/* Card 1: Credentials */}
        <div className="p-5 rounded-lg bg-dark-card border border-zinc-800 space-y-4">
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>{t("settings_view.card_credentials_title")}</span>
          </h3>

          <div className="space-y-4">
            {/* Tunnel ID */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="text-zinc-300 font-medium">
                  {t("settings_view.tunnel_id_label")}
                </label>
                <a
                  href="https://platform.openai.com/settings/organization/tunnels"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 hover:underline flex items-center gap-1 text-[11px]"
                >
                  <span>{t("settings_view.open_platform_tunnel_link")}</span>
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
              <input
                type="text"
                value={tunnelId}
                onChange={(e) => setTunnelId(e.target.value)}
                placeholder={t("settings_view.tunnel_id_placeholder")}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-zinc-600"
              />
              <p className="text-[11px] text-zinc-500">
                {t("settings_view.tunnel_id_desc")}
              </p>
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="text-zinc-300 font-medium">
                  {t("settings_view.api_key_label")}
                </label>
                <a
                  href="https://platform.openai.com/settings/organization/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 hover:underline flex items-center gap-1 text-[11px]"
                >
                  <span>{t("settings_view.open_platform_key_link")}</span>
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={t("settings_view.api_key_placeholder")}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-zinc-600"
              />
              <p className="text-[11px] text-zinc-500">
                {t("settings_view.api_key_desc")}
              </p>
            </div>
          </div>
        </div>

        {/* Card 2: Local Network & Daemon Settings */}
        <div className="p-5 rounded-lg bg-dark-card border border-zinc-800 space-y-4">
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-400" />
            <span>{t("settings_view.card_network_title")}</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-300 font-medium">
                {t("settings_view.health_port_label")}
              </label>
              <input
                type="number"
                min={0}
                max={65535}
                step={1}
                value={healthPort}
                onChange={(e) => setHealthPort(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-zinc-600"
              />
              <p className="text-[11px] text-zinc-500">
                {t("settings_view.health_port_desc")}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-300 font-medium">
                {t("settings_view.control_plane_label")}
              </label>
              <input
                type="text"
                value="https://api.openai.com"
                disabled
                className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded px-3 py-2 text-xs font-mono text-zinc-400 cursor-not-allowed"
              />
              <p className="text-[11px] text-zinc-500">
                {t("settings_view.control_plane_desc")}
              </p>
            </div>
          </div>
        </div>

        {/* Card 3: Storage Paths */}
        <div className="p-5 rounded-lg bg-dark-card border border-zinc-800 space-y-3">
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-amber-400" />
            <span>{t("settings_view.card_storage_title")}</span>
          </h3>

          <div className="space-y-2 text-xs font-mono">
            <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <div className="space-y-0.5 truncate pr-2">
                <div className="text-zinc-500 text-[10px]">
                  {t("settings_view.key_file_label")}
                </div>
                <div className="text-zinc-300 truncate">
                  {settings?.key_file_path || "C:\\Users\\...\\.chappie\\tunnelkey.txt"}
                </div>
              </div>
              {settings?.key_file_path && (
                <button
                  onClick={() => openPathInExplorer(settings.key_file_path)}
                  className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 flex items-center gap-1 shrink-0"
                >
                  <FolderOpen className="w-3 h-3" />
                  <span>{t("settings_view.locate_btn")}</span>
                </button>
              )}
            </div>

            <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <div className="space-y-0.5 truncate pr-2">
                <div className="text-zinc-500 text-[10px]">
                  {t("settings_view.profile_file_label")}
                </div>
                <div className="text-zinc-300 truncate">
                  %APPDATA%\tunnel-client\chappie.yaml
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Best Practices Guide */}
        <div className="p-5 rounded-lg bg-dark-card border border-zinc-800 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
            <Info className="w-4 h-4 text-emerald-400" />
            <span>{t("settings_view.card_principles_title")}</span>
          </div>

          <ul className="text-xs text-zinc-400 space-y-1.5 list-disc list-inside leading-relaxed">
            <li>{t("settings_view.principle_1")}</li>
            <li>{t("settings_view.principle_2")}</li>
            <li>{t("settings_view.principle_3")}</li>
          </ul>
        </div>

        {/* Card 5: Version & In-app Update Center */}
        <div className="p-5 rounded-lg bg-dark-card border border-zinc-800 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-400" />
                <span>{t("settings_view.card_updates_title")}</span>
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                {t("settings_view.card_updates_desc")}
              </p>
            </div>

            <button
              type="button"
              onClick={
                updateState.stage === "available" ||
                updateState.stage === "downloading" ||
                updateState.stage === "installing"
                  ? onOpenUpdater
                  : onCheckUpdates
              }
              disabled={updateState.stage === "checking"}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors disabled:opacity-50 ${
                updateState.stage === "available"
                  ? "bg-emerald-950/50 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/50"
                  : "bg-zinc-900 text-zinc-300 border-zinc-700 hover:bg-zinc-800"
              }`}
            >
              {updateState.stage === "checking" ? (
                <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
              ) : updateState.stage === "available" ? (
                <Sparkles className="w-3.5 h-3.5" />
              ) : updateState.stage === "downloading" ? (
                <Download className="w-3.5 h-3.5" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>
                {updateState.stage === "checking"
                  ? t("settings_view.checking_btn")
                  : updateState.stage === "available"
                  ? t("settings_view.view_version_btn", {
                      version: updateState.latestVersion || "",
                    })
                  : updateState.stage === "downloading"
                  ? updateState.totalBytes
                    ? t("settings_view.downloading_percent_btn", {
                        percent: updateState.progressPercent || 0,
                      })
                    : t("settings_view.downloading_plain_btn")
                  : updateState.stage === "installing"
                  ? t("settings_view.installing_btn")
                  : t("settings_view.check_updates_btn")}
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] font-mono">
            <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1">
              <div className="text-zinc-600">
                {t("settings_view.version_current_label")}
              </div>
              <div className="text-emerald-400 font-medium">v{APP_VERSION}</div>
            </div>
            <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1">
              <div className="text-zinc-600">
                {t("settings_view.update_status_label")}
              </div>
              <div
                className={
                  updateState.stage === "error"
                    ? "text-rose-400"
                    : updateState.stage === "available"
                    ? "text-amber-300"
                    : "text-zinc-300"
                }
              >
                {updateState.stage === "available"
                  ? t("settings_view.status_discovered", {
                      version: updateState.latestVersion || "",
                    })
                  : updateState.stage === "downloading"
                  ? t("settings_view.status_downloading_bg")
                  : updateState.stage === "installing"
                  ? t("settings_view.status_installing")
                  : updateState.stage === "installed"
                  ? t("settings_view.status_installed_reboot")
                  : updateState.stage === "error"
                  ? t("settings_view.status_failed")
                  : updateState.stage === "checking"
                  ? t("settings_view.status_checking")
                  : t("settings_view.status_auto_enabled")}
              </div>
            </div>
            <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1">
              <div className="text-zinc-600">
                {t("settings_view.release_source_label")}
              </div>
              <div className="text-zinc-300 truncate">
                github.com/t59688/tunneldock
              </div>
            </div>
          </div>

          <div className="text-[11px] text-zinc-600 leading-relaxed">
            {t("settings_view.version_single_source_desc")}
          </div>
        </div>
      </div>
    </div>
  );
};
