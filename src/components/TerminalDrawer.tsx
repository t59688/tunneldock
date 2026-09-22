import React, { useRef, useEffect } from "react";
import { Terminal, X, Copy, Trash2, Check } from "lucide-react";
import { useTranslation } from "../i18n";

interface TerminalDrawerProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  logs: Array<{ line: string; is_error: boolean; timestamp?: string }>;
  onClear: () => void;
}

export const TerminalDrawer: React.FC<TerminalDrawerProps> = ({
  title,
  isOpen,
  onClose,
  logs,
  onClear,
}) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isOpen) return null;

  const handleCopy = () => {
    const text = logs.map((l) => l.line).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed bottom-0 left-64 right-0 h-72 bg-dark-bg/95 backdrop-blur-md border-t border-zinc-800 flex flex-col z-30 shadow-2xl animate-in slide-in-from-bottom duration-200">
      {/* Header */}
      <div className="h-9 px-4 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between text-xs select-none">
        <div className="flex items-center gap-2 text-zinc-300 font-mono">
          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-semibold">{title}</span>
          <span className="text-[11px] text-zinc-500">
            {t("terminal_drawer.output_count", { count: logs.length })}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="px-2 py-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 flex items-center gap-1 transition-colors"
            title={t("terminal_drawer.copy_all")}
          >
            {copied ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            <span className="text-[11px]">
              {copied ? t("terminal_drawer.copied") : t("terminal_drawer.copy")}
            </span>
          </button>
          <button
            onClick={onClear}
            className="px-2 py-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 flex items-center gap-1 transition-colors"
            title={t("terminal_drawer.clear_logs")}
          >
            <Trash2 className="w-3 h-3" />
            <span className="text-[11px]">{t("terminal_drawer.clear")}</span>
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Content */}
      <div
        ref={scrollRef}
        className="flex-1 p-3 overflow-y-auto font-mono text-xs text-zinc-300 space-y-1 select-text bg-[#09090b]"
      >
        {logs.length === 0 ? (
          <div className="text-zinc-600 italic py-4 text-center">
            {t("terminal_drawer.empty")}
          </div>
        ) : (
          logs.map((item, idx) => (
            <div
              key={idx}
              className={`leading-relaxed whitespace-pre-wrap break-all ${
                item.is_error ? "text-rose-400" : "text-zinc-300"
              }`}
            >
              <span className="text-zinc-600 select-none mr-2">
                {String(idx + 1).padStart(3, "0")}
              </span>
              {item.line}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
