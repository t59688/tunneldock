import React from "react";
import { Download, LoaderCircle, RefreshCw, Power, Radio, Sparkles, Globe } from "lucide-react";
import { OtunnelDaemonStatus } from "../types";
import { AppUpdateState } from "../hooks/useAppUpdater";
import { useTranslation } from "../i18n";
import { APP_VERSION } from "../version";

interface HeaderProps {
  otunnelStatus: OtunnelDaemonStatus | null;
  activeSessionsCount: number;
  onToggleOtunnel: () => void;
  isTogglingOtunnel: boolean;
  onRefresh: () => void;
  updateState: AppUpdateState;
  onOpenUpdater: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  otunnelStatus,
  activeSessionsCount,
  onToggleOtunnel,
  isTogglingOtunnel,
  onRefresh,
  updateState,
  onOpenUpdater,
}) => {
  const { t, locale, setLocale } = useTranslation();
  const isRunning = Boolean(otunnelStatus?.running);
  const isOnline = Boolean(isRunning && otunnelStatus?.healthz_ok);
  const latencyMs = otunnelStatus?.latency_ms;

  const handleToggleLang = () => {
    void setLocale(locale === "zh-CN" ? "en-US" : "zh-CN");
  };

  return (
    <header className="h-14 border-b border-zinc-800/80 bg-dark-card/90 backdrop-blur px-6 flex items-center justify-between select-none">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <img
          src="/app-icon.svg"
          alt="TunnelDock"
          className="w-8 h-8 rounded-lg shadow-md border border-zinc-800/80"
        />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold tracking-wide text-zinc-100">
              {t("header.brand_title")}
            </h1>
            <button
              type="button"
              onClick={onOpenUpdater}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 font-medium hover:bg-emerald-900/60 transition-colors"
              title={t("header.open_updater")}
            >
              v{APP_VERSION}
            </button>
            {updateState.stage === "available" && (
              <button
                type="button"
                onClick={onOpenUpdater}
                className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-950/50 text-amber-300 border border-amber-800/60 hover:bg-amber-900/50 transition-colors"
                title={t("header.version_new", { version: updateState.latestVersion || "" })}
              >
                <Sparkles className="w-3 h-3" />
                <span>v{updateState.latestVersion}</span>
              </button>
            )}
            {updateState.stage === "downloading" && (
              <button
                type="button"
                onClick={onOpenUpdater}
                className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950/50 text-sky-300 border border-sky-800/60 hover:bg-sky-900/50 transition-colors"
                title={t("header.downloading_plain")}
              >
                <Download className="w-3 h-3" />
                <span>
                  {updateState.totalBytes
                    ? t("header.downloading_percent", { percent: updateState.progressPercent })
                    : t("header.downloading_plain")}
                </span>
              </button>
            )}
            {updateState.stage === "installing" && (
              <button
                type="button"
                onClick={onOpenUpdater}
                className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/50 text-emerald-300 border border-emerald-800/60"
                title={t("header.installing")}
              >
                <LoaderCircle className="w-3 h-3 animate-spin" />
                <span>{t("header.installing")}</span>
              </button>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 font-mono">
            {t("header.brand_subtitle")}
          </p>
        </div>
      </div>

      {/* Center Status Indicators */}
      <div className="flex items-center gap-4">
        {/* Otunnel Status Badge */}
        <div className="flex items-center gap-2 px-3 py-1 rounded bg-zinc-900/90 border border-zinc-800 text-xs font-mono">
          <span
            className={`w-2 h-2 rounded-full ${
              isOnline
                ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse"
                : "bg-zinc-600"
            }`}
          />
          <span className="text-zinc-400">{t("header.tunnel_label")}</span>
          <span
            className={
              isOnline
                ? "text-emerald-400 font-medium"
                : isRunning
                ? "text-amber-400 font-medium"
                : "text-zinc-500"
            }
          >
            {isOnline
              ? t("header.tunnel_connected")
              : isRunning
              ? t("header.tunnel_abnormal")
              : t("header.tunnel_disconnected")}
          </span>
          {isOnline && latencyMs != null && (
            <span className="text-zinc-500 text-[11px]">
              ({latencyMs}ms)
            </span>
          )}
        </div>

        {/* Workspace Sessions Count */}
        <div className="flex items-center gap-2 px-3 py-1 rounded bg-zinc-900/90 border border-zinc-800 text-xs font-mono">
          <Radio className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-zinc-400">{t("header.sessions_label")}</span>
          <span
            className={
              activeSessionsCount > 0
                ? "text-emerald-400 font-medium"
                : "text-zinc-500"
            }
          >
            {t("header.sessions_online", { count: activeSessionsCount })}
          </span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {/* Language Switch Button */}
        <button
          type="button"
          onClick={handleToggleLang}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border border-zinc-700/80 text-xs font-mono transition-colors"
          title={t("header.lang_switch")}
        >
          <Globe className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-semibold text-[11px]">{locale === "zh-CN" ? "EN" : "中"}</span>
        </button>

        <button
          type="button"
          onClick={onRefresh}
          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors border border-transparent hover:border-zinc-700"
          title={t("header.refresh_tooltip")}
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToggleOtunnel}
          disabled={isTogglingOtunnel}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-all ${
            isRunning
              ? "bg-rose-950/30 text-rose-300 border-rose-800/60 hover:bg-rose-900/40"
              : "bg-emerald-950/30 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/40"
          } disabled:opacity-50`}
        >
          <Power className="w-3.5 h-3.5" />
          <span>{isRunning ? t("header.stop_tunnel") : t("header.start_tunnel")}</span>
        </button>
      </div>
    </header>
  );
};
