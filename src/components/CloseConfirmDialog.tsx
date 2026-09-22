import React, { useEffect, useRef } from "react";
import {
  AlertTriangle,
  LoaderCircle,
  LogOut,
  Minimize2,
  X,
} from "lucide-react";
import { useTranslation } from "../i18n";

export type CloseAction = "exit" | "hide" | "cancel";

interface CloseConfirmDialogProps {
  open: boolean;
  busy: boolean;
  error: string | null;
  onResolve: (action: CloseAction) => void;
}

export const CloseConfirmDialog: React.FC<CloseConfirmDialogProps> = ({
  open,
  busy,
  error,
  onResolve,
}) => {
  const { t } = useTranslation();
  const hideButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    hideButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onResolve("cancel");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onResolve, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-5 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-dialog-title"
        aria-describedby="close-dialog-description"
        aria-busy={busy}
        className="relative w-full max-w-[520px] overflow-hidden rounded-2xl border border-zinc-700/80 bg-[#111114] shadow-[0_30px_100px_rgba(0,0,0,0.72),0_0_0_1px_rgba(255,255,255,0.025)]"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_18%_0%,rgba(245,158,11,0.16),transparent_58%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-[-60px] top-[-78px] h-44 w-44 rounded-full border border-amber-500/10"
        />

        <div className="relative flex items-start gap-4 px-6 pb-5 pt-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-700/50 bg-amber-950/45 shadow-[0_0_32px_rgba(245,158,11,0.08)]">
            <AlertTriangle
              className="h-5 w-5 text-amber-400"
              strokeWidth={1.8}
            />
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full border border-zinc-700 bg-zinc-900/80 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-zinc-500">
                {t("close_dialog.tag")}
              </span>
              {busy && (
                <span
                  aria-live="polite"
                  className="inline-flex items-center gap-1.5 text-[10px] text-amber-400/80"
                >
                  <LoaderCircle className="h-3 w-3 animate-spin" />
                  {t("close_dialog.processing")}
                </span>
              )}
            </div>
            <h2
              id="close-dialog-title"
              className="text-[17px] font-semibold tracking-tight text-zinc-100"
            >
              {t("close_dialog.title")}
            </h2>
            <p
              id="close-dialog-description"
              className="mt-2 max-w-md text-xs leading-5 text-zinc-400"
            >
              {t("close_dialog.desc")}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onResolve("cancel")}
            disabled={busy}
            className="rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:pointer-events-none disabled:opacity-30"
            aria-label={t("close_dialog.aria_cancel")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="relative mx-6 mb-4 rounded-lg border border-rose-900/60 bg-rose-950/25 px-3 py-2 text-[11px] leading-5 text-rose-300">
            {t("close_dialog.error_prefix")}{error}
          </div>
        )}

        <div className="relative border-t border-zinc-800/90 bg-zinc-950/55 px-6 py-4">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => onResolve("cancel")}
              disabled={busy}
              className="h-9 rounded-lg border border-zinc-800 px-3.5 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:bg-zinc-800/70 hover:text-zinc-100 disabled:pointer-events-none disabled:opacity-40"
            >
              {t("close_dialog.cancel_btn")}
            </button>

            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => onResolve("exit")}
                disabled={busy}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-rose-900/70 bg-rose-950/25 px-4 text-xs font-semibold text-rose-300 transition-colors hover:border-rose-800 hover:bg-rose-950/55 hover:text-rose-200 disabled:pointer-events-none disabled:opacity-40"
              >
                <LogOut className="h-3.5 w-3.5" />
                {t("close_dialog.exit_btn")}
              </button>
              <button
                ref={hideButtonRef}
                type="button"
                onClick={() => onResolve("hide")}
                disabled={busy}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-amber-400/80 bg-amber-400 px-4 text-xs font-semibold text-amber-950 shadow-[0_8px_24px_rgba(245,158,11,0.14)] transition-colors hover:border-amber-300 hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111114] disabled:pointer-events-none disabled:opacity-60"
              >
                <Minimize2 className="h-3.5 w-3.5" />
                {t("close_dialog.hide_btn")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
