import React, { useEffect } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { AppUpdateState } from "../hooks/useAppUpdater";
import { useTranslation } from "../i18n";

interface UpdateDialogProps {
  open: boolean;
  state: AppUpdateState;
  onClose: () => void;
  onCheck: () => void;
  onInstall: () => void;
}

function formatBytes(bytes: number | null, unknownText: string): string {
  if (bytes === null || !Number.isFinite(bytes)) return unknownText;
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let i = 1; i < units.length && value >= 1024; i += 1) {
    value /= 1024;
    unit = units[i];
  }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${unit}`;
}

function formatDate(value: string | null, unknownText: string, locale: string): string {
  if (!value) return unknownText;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const UpdateDialog: React.FC<UpdateDialogProps> = ({
  open,
  state,
  onClose,
  onCheck,
  onInstall,
}) => {
  const { t, locale } = useTranslation();
  const locked = state.stage === "installing";

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !locked) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [locked, onClose, open]);

  if (!open) return null;

  const isBusy = state.stage === "checking" || state.stage === "downloading" || state.stage === "installing";
  const hasUpdate = Boolean(state.latestVersion);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-black/65 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-700/80 bg-[#111114] shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <div className="relative px-6 py-5 border-b border-zinc-800 bg-gradient-to-br from-emerald-950/25 via-zinc-950/30 to-zinc-950/80">
          <button
            type="button"
            onClick={onClose}
            disabled={locked}
            className="absolute right-4 top-4 p-1.5 rounded-md text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors disabled:opacity-30"
            aria-label={t("update_dialog.aria_close")}
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-4 pr-10">
            <div className="w-11 h-11 rounded-xl border border-emerald-800/60 bg-emerald-950/50 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.08)]">
              {state.stage === "installed" ? (
                <PackageCheck className="w-5 h-5 text-emerald-400" />
              ) : state.stage === "error" ? (
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              ) : (
                <Sparkles className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-zinc-100">TunnelDock</h2>
                {hasUpdate && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-emerald-800/70 bg-emerald-950/50 text-emerald-300">
                    v{state.latestVersion}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                GitHub Releases · t59688/tunneldock
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {state.stage === "checking" && (
            <div className="py-10 flex flex-col items-center justify-center gap-3 text-center">
              <LoaderCircle className="w-7 h-7 text-emerald-400 animate-spin" />
              <div>
                <div className="text-sm font-medium text-zinc-200">{t("update_dialog.status_checking")}</div>
              </div>
            </div>
          )}

          {state.stage === "up_to_date" && (
            <div className="py-8 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-950/50 border border-emerald-800/60 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-zinc-100">{t("update_dialog.badge_uptodate")}</div>
                <div className="text-xs text-zinc-500 mt-1 font-mono">v{state.currentVersion}</div>
              </div>
            </div>
          )}

          {state.stage === "error" && (
            <div className="rounded-lg border border-rose-900/70 bg-rose-950/25 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-rose-300">{t("update_dialog.badge_error")}</div>
                  <div className="text-xs text-rose-200/75 mt-1 break-words leading-relaxed">
                    {state.errorMessage || t("common.unknown")}
                  </div>
                </div>
              </div>
            </div>
          )}

          {(state.stage === "available" || state.stage === "downloading" || state.stage === "installing" || state.stage === "installed") && (
            <>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">{t("update_dialog.current_label")}</div>
                  <div className="text-sm font-mono text-zinc-300 mt-0.5">v{state.currentVersion}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-600" />
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-600 font-mono">{t("update_dialog.latest_tag")}</div>
                  <div className="text-sm font-mono text-emerald-400 mt-0.5">v{state.latestVersion}</div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-[11px] text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>{formatDate(state.releaseDate, t("update_dialog.unknown_date"), locale)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{t("update_dialog.checksum_verified")}</span>
                </div>
              </div>

              {state.stage === "available" && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-zinc-300">{t("update_dialog.notes_title")}</div>
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 text-xs leading-6 text-zinc-400 whitespace-pre-wrap select-text">
                    {state.releaseNotes || t("update_dialog.notes_empty")}
                  </div>
                </div>
              )}

              {state.stage === "downloading" && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-zinc-300">
                      <Download className="w-4 h-4 text-emerald-400" />
                      <span>{t("update_dialog.status_downloading")}</span>
                    </div>
                    <span className="font-mono text-xs text-emerald-400">
                      {state.totalBytes ? `${state.progressPercent}%` : t("header.downloading_plain")}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-emerald-500 transition-[width] duration-200 ${state.totalBytes ? "" : "w-1/3 animate-pulse"}`}
                      style={state.totalBytes ? { width: `${state.progressPercent}%` } : undefined}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                    <span>{formatBytes(state.downloadedBytes, t("update_dialog.unknown_size"))}</span>
                    <span>{state.totalBytes ? formatBytes(state.totalBytes, t("update_dialog.unknown_size")) : ""}</span>
                  </div>
                </div>
              )}

              {state.stage === "installing" && (
                <div className="py-7 rounded-lg border border-emerald-900/50 bg-emerald-950/20 flex flex-col items-center text-center gap-3">
                  <LoaderCircle className="w-7 h-7 text-emerald-400 animate-spin" />
                  <div>
                    <div className="text-sm font-semibold text-zinc-100">{t("update_dialog.status_installing")}</div>
                  </div>
                </div>
              )}

              {state.stage === "installed" && (
                <div className="py-7 rounded-lg border border-emerald-900/50 bg-emerald-950/20 flex flex-col items-center text-center gap-3">
                  <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                  <div>
                    <div className="text-sm font-semibold text-zinc-100">{t("update_dialog.status_installed")}</div>
                  </div>
                </div>
              )}
            </>
          )}

          {state.stage === "idle" && (
            <div className="py-7 flex flex-col items-center text-center gap-3">
              <Clock3 className="w-6 h-6 text-zinc-500" />
              <div>
                <div className="text-sm font-medium text-zinc-200">v{state.currentVersion}</div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/50 flex items-center justify-between gap-3">
          <div className="text-[11px] text-zinc-600 min-w-0">
            {state.lastCheckedAt ? `${new Date(state.lastCheckedAt).toLocaleTimeString()}` : ""}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!locked && (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-md text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-zinc-800 transition-colors"
              >
                {t("update_dialog.btn_close")}
              </button>
            )}

            {(state.stage === "idle" || state.stage === "up_to_date" || state.stage === "error") && (
              <button
                type="button"
                onClick={onCheck}
                disabled={isBusy}
                className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-zinc-100 text-zinc-950 hover:bg-white disabled:opacity-50 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t("update_dialog.btn_recheck")}</span>
              </button>
            )}

            {state.stage === "available" && (
              <button
                type="button"
                onClick={onInstall}
                className="px-4 py-1.5 rounded-md text-xs font-semibold bg-emerald-500 text-emerald-950 hover:bg-emerald-400 transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t("update_dialog.btn_install")}</span>
              </button>
            )}

            {state.stage === "installed" && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-md text-xs font-semibold bg-emerald-500 text-emerald-950 hover:bg-emerald-400 transition-colors"
              >
                {t("common.confirm")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
