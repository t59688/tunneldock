import React, { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { useTranslation } from "../i18n";

const appWindow = getCurrentWindow();

export const TitleBar: React.FC = () => {
  const { t } = useTranslation();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const syncState = async () => {
      try {
        setMaximized(await appWindow.isMaximized());
      } catch {
        // Browser preview / non-Tauri runtime.
      }
    };

    syncState();
    appWindow
      .onResized(() => {
        syncState();
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => undefined);

    return () => unlisten?.();
  }, []);

  const minimize = async () => {
    try {
      await appWindow.minimize();
    } catch {
      // Ignore when rendered outside Tauri.
    }
  };

  const toggleMaximize = async () => {
    try {
      await appWindow.toggleMaximize();
      setMaximized(await appWindow.isMaximized());
    } catch {
      // Ignore when rendered outside Tauri.
    }
  };

  const close = async () => {
    try {
      await appWindow.close();
    } catch {
      // Ignore when rendered outside Tauri.
    }
  };

  return (
    <div
      data-tauri-drag-region
      onDoubleClick={toggleMaximize}
      className="h-8 shrink-0 border-b border-zinc-800/80 bg-[#0d0d10] flex items-center justify-between select-none"
    >
      <div
        data-tauri-drag-region
        className="h-full flex items-center gap-2 px-3 min-w-0"
      >
        <img
          data-tauri-drag-region
          src="/app-icon.svg"
          alt=""
          className="w-4 h-4 rounded-sm"
        />
        <span
          data-tauri-drag-region
          className="text-[11px] font-medium tracking-wide text-zinc-400 truncate"
        >
          {t("titlebar.title")}
        </span>
      </div>

      <div className="h-full flex items-stretch">
        <button
          type="button"
          onClick={minimize}
          onDoubleClick={(event) => event.stopPropagation()}
          className="w-11 h-full flex items-center justify-center text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
          title={t("titlebar.minimize")}
          aria-label={t("titlebar.minimize")}
        >
          <Minus className="w-3.5 h-3.5" strokeWidth={1.7} />
        </button>

        <button
          type="button"
          onClick={toggleMaximize}
          onDoubleClick={(event) => event.stopPropagation()}
          className="w-11 h-full flex items-center justify-center text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
          title={maximized ? t("titlebar.restore") : t("titlebar.maximize")}
          aria-label={maximized ? t("titlebar.restore") : t("titlebar.maximize")}
        >
          {maximized ? (
            <span className="relative w-3.5 h-3.5" aria-hidden="true">
              <span className="absolute left-0.5 top-1 w-2.5 h-2.5 border border-current rounded-[1px]" />
              <span className="absolute left-1 top-0.5 w-2.5 h-2.5 border border-current rounded-[1px] bg-[#0d0d10]" />
            </span>
          ) : (
            <Square className="w-3 h-3" strokeWidth={1.6} />
          )}
        </button>

        <button
          type="button"
          onClick={close}
          onDoubleClick={(event) => event.stopPropagation()}
          className="w-12 h-full flex items-center justify-center text-zinc-500 hover:text-white hover:bg-rose-600 transition-colors"
          title={t("titlebar.close")}
          aria-label={t("titlebar.close")}
        >
          <X className="w-4 h-4" strokeWidth={1.7} />
        </button>
      </div>
    </div>
  );
};
