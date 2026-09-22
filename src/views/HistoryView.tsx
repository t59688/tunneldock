import React, { useState, useMemo } from "react";
import {
  Search,
  Download,
  Trash2,
  Code2,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { McpCallRecord, WorkspaceItem } from "../types";
import { clearHistory, exportHistoryJson } from "../api";
import { formatLocalTimestamp } from "../utils/time";
import {
  buildHistoryStats,
  formatTokenCount,
  paginateHistory,
} from "./historyStats";
import { useTranslation } from "../i18n";

const PAGE_SIZE = 20;

interface HistoryViewProps {
  history: McpCallRecord[];
  workspaces: WorkspaceItem[];
  onRefresh: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  workspaces,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState("all");
  const [selectedTool, setSelectedTool] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [inspectRecord, setInspectRecord] = useState<McpCallRecord | null>(null);
  const [copiedInspect, setCopiedInspect] = useState(false);

  const { records: workspaceHistory, stats } = useMemo(
    () => buildHistoryStats(history, selectedWorkspace),
    [history, selectedWorkspace]
  );

  const filteredHistory = useMemo(() => {
    return workspaceHistory.filter((item) => {
      const matchSearch =
        searchTerm === "" ||
        item.tool_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.args_json.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.result_summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.workspace_name &&
          item.workspace_name.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchTool =
        selectedTool === "all" || item.tool_name === selectedTool;

      const matchStatus =
        selectedStatus === "all" || item.status === selectedStatus;

      return matchSearch && matchTool && matchStatus;
    });
  }, [workspaceHistory, searchTerm, selectedTool, selectedStatus]);

  const pagination = useMemo(
    () => paginateHistory(filteredHistory, currentPage, PAGE_SIZE),
    [filteredHistory, currentPage]
  );

  const handleClear = async () => {
    if (confirm(t("history_view.clear_confirm"))) {
      await clearHistory();
      onRefresh();
    }
  };

  const handleExport = async () => {
    try {
      const json = await exportHistoryJson();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tunneldock-mcp-history-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  const getToolBadge = (name: string) => {
    switch (name) {
      case "read":
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
            read
          </span>
        );
      case "bash":
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/50 text-amber-400 border border-amber-800/60">
            bash
          </span>
        );
      case "edit":
      case "write":
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/50 text-emerald-400 border border-emerald-800/60">
            {name}
          </span>
        );
      case "init":
      case "sessions":
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700 font-semibold">
            {name}
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
            {name}
          </span>
        );
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="p-5 rounded-lg bg-dark-card border border-zinc-800/90 shadow-lg flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-100">
              {t("history_view.title")}
            </h2>
            <span className="text-xs font-mono text-zinc-500">
              {t("history_view.records_count", {
                count: workspaceHistory.length,
              })}
            </span>
          </div>
          <p className="text-xs text-zinc-400 max-w-xl">
            {t("history_view.banner_desc")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
            title={t("history_view.refresh_tooltip")}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t("history_view.export_btn")}</span>
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-medium bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 border border-rose-800/60 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t("history_view.clear_btn")}</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-9 gap-3">
        <div className="p-3 rounded-lg bg-dark-card border border-zinc-800 space-y-1">
          <div className="text-[11px] font-mono text-zinc-500">
            {t("history_view.stat_total_calls")}
          </div>
          <div className="text-lg font-bold font-mono text-zinc-100">
            {stats.total}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-dark-card border border-zinc-800 space-y-1">
          <div className="text-[11px] font-mono text-zinc-500">
            {t("history_view.stat_read_check")}
          </div>
          <div className="text-lg font-bold font-mono text-zinc-300">
            {stats.readCount}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-dark-card border border-zinc-800 space-y-1">
          <div className="text-[11px] font-mono text-zinc-500">
            {t("history_view.stat_cmd_exec")}
          </div>
          <div className="text-lg font-bold font-mono text-amber-400">
            {stats.bashCount}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-dark-card border border-zinc-800 space-y-1">
          <div className="text-[11px] font-mono text-zinc-500">
            {t("history_view.stat_code_edit")}
          </div>
          <div className="text-lg font-bold font-mono text-emerald-400">
            {stats.writeCount}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-dark-card border border-zinc-800 space-y-1">
          <div className="text-[11px] font-mono text-zinc-500">
            {t("history_view.stat_success_rate")}
          </div>
          <div className="text-lg font-bold font-mono text-emerald-400">
            {stats.successRate === null ? "--" : `${stats.successRate}%`}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-dark-card border border-zinc-800 space-y-1">
          <div className="text-[11px] font-mono text-zinc-500">
            {t("history_view.stat_avg_duration")}
          </div>
          <div className="text-lg font-bold font-mono text-zinc-300">
            {stats.avgDuration} ms
          </div>
        </div>
        <div className="p-3 rounded-lg bg-dark-card border border-zinc-800 space-y-1">
          <div className="text-[11px] font-mono text-zinc-500">
            {t("history_view.stat_input_tokens")}
          </div>
          <div className="text-lg font-bold font-mono text-sky-400">
            {formatTokenCount(stats.inputTokens)}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-dark-card border border-zinc-800 space-y-1">
          <div className="text-[11px] font-mono text-zinc-500">
            {t("history_view.stat_output_tokens")}
          </div>
          <div className="text-lg font-bold font-mono text-violet-400">
            {formatTokenCount(stats.outputTokens)}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-dark-card border border-zinc-800 space-y-1">
          <div className="text-[11px] font-mono text-zinc-500">
            {t("history_view.stat_total_tokens")}
          </div>
          <div className="text-lg font-bold font-mono text-cyan-300">
            {formatTokenCount(stats.totalTokens)}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 rounded-lg bg-dark-card border border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full max-w-sm">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t("history_view.search_placeholder")}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-zinc-950 border border-zinc-800 rounded pl-8 pr-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-600 font-mono"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-zinc-500 font-mono">
              {t("history_view.workspace_label")}
            </span>
            <select
              value={selectedWorkspace}
              onChange={(e) => {
                setSelectedWorkspace(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 font-mono focus:outline-none max-w-44"
            >
              <option value="all">{t("history_view.all_workspaces")}</option>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tool Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-zinc-500 font-mono">
              {t("history_view.tool_label")}
            </span>
            <select
              value={selectedTool}
              onChange={(e) => {
                setSelectedTool(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 font-mono focus:outline-none"
            >
              <option value="all">{t("history_view.all_tools")}</option>
              <option value="read">{t("history_view.tool_read")}</option>
              <option value="bash">{t("history_view.tool_bash")}</option>
              <option value="edit">{t("history_view.tool_edit")}</option>
              <option value="write">{t("history_view.tool_write")}</option>
              <option value="transfer">{t("history_view.tool_transfer")}</option>
              <option value="sessions">{t("history_view.tool_sessions")}</option>
              <option value="init">{t("history_view.tool_init")}</option>
              <option value="chat">{t("history_view.tool_chat")}</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-zinc-500 font-mono">
              {t("history_view.status_label")}
            </span>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 font-mono focus:outline-none"
            >
              <option value="all">{t("history_view.all_status")}</option>
              <option value="success">{t("history_view.status_success")}</option>
              <option value="error">{t("history_view.status_error")}</option>
            </select>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="rounded-lg bg-dark-card border border-zinc-800 overflow-hidden">
        {filteredHistory.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500 italic">
            {t("history_view.empty_records")}
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/60 font-mono text-[11px] text-zinc-400 select-none">
                <th className="py-2.5 px-4">{t("history_view.table_time")}</th>
                <th className="py-2.5 px-3">{t("history_view.table_tool")}</th>
                <th className="py-2.5 px-3">{t("history_view.table_workspace")}</th>
                <th className="py-2.5 px-3">{t("history_view.field_args")}</th>
                <th className="py-2.5 px-3">{t("history_view.field_tokens")}</th>
                <th className="py-2.5 px-3">{t("history_view.table_duration")}</th>
                <th className="py-2.5 px-3">{t("history_view.table_status")}</th>
                <th className="py-2.5 px-4 text-right">
                  {t("history_view.table_actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono">
              {pagination.items.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-zinc-900/50 transition-colors"
                >
                  <td className="py-2.5 px-4 text-zinc-400 whitespace-nowrap">
                    {formatLocalTimestamp(item.timestamp)}
                  </td>
                  <td className="py-2.5 px-3">{getToolBadge(item.tool_name)}</td>
                  <td className="py-2.5 px-3 text-zinc-300 truncate max-w-[140px]">
                    {item.workspace_name || t("history_view.default_session")}
                  </td>
                  <td className="py-2.5 px-3 text-zinc-400 truncate max-w-[280px]">
                    {item.args_json}
                  </td>
                  <td className="py-2.5 px-3 text-cyan-300 whitespace-nowrap">
                    {formatTokenCount(item.total_tokens ?? 0)}
                  </td>
                  <td className="py-2.5 px-3 text-zinc-400 whitespace-nowrap">
                    {item.duration_ms} ms
                  </td>
                  <td className="py-2.5 px-3">
                    {item.status === "success" ? (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{t("history_view.status_success")}</span>
                      </span>
                    ) : item.status === "executing" ? (
                      <span className="flex items-center gap-1 text-[11px] text-amber-400">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>{t("history_view.status_executing")}</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] text-rose-400">
                        <XCircle className="w-3 h-3" />
                        <span>{t("history_view.status_error")}</span>
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      onClick={() => setInspectRecord(item)}
                      className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] inline-flex items-center gap-1 transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      <span>{t("history_view.view_btn")}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {filteredHistory.length > 0 && (
          <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-950/40 px-4 py-3 text-[11px] font-mono text-zinc-500">
            <span>
              {t("history_view.page_showing", {
                start: pagination.start,
                end: pagination.end,
                total: pagination.total,
              })}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-300 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-3 w-3" />
                {t("history_view.prev_page")}
              </button>
              <span className="min-w-20 text-center text-zinc-400">
                {t("history_view.page_current", {
                  page: pagination.page,
                  totalPages: pagination.totalPages,
                })}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-300 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("history_view.next_page")}
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Inspect Modal */}
      {inspectRecord && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-zinc-800 rounded-lg max-w-2xl w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-emerald-400" />
                  {t("history_view.inspect_title")}
                </h3>
                <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-3">
                  <span>ID: {inspectRecord.id}</span>
                  <span>
                    {t("history_view.field_call_time")}:{" "}
                    {formatLocalTimestamp(inspectRecord.timestamp)}
                  </span>
                  <span>
                    {t("history_view.field_duration")}:{" "}
                    {inspectRecord.duration_ms}ms
                  </span>
                </div>
                <div className="text-[11px] font-mono text-zinc-500 flex items-center gap-3">
                  <span>
                    {t("history_view.tokens_input", {
                      count: formatTokenCount(inspectRecord.input_tokens ?? 0),
                    })}
                  </span>
                  <span>
                    {t("history_view.tokens_output", {
                      count: formatTokenCount(inspectRecord.output_tokens ?? 0),
                    })}
                  </span>
                  <span>
                    {t("history_view.tokens_total", {
                      count: formatTokenCount(inspectRecord.total_tokens ?? 0),
                    })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {getToolBadge(inspectRecord.tool_name)}
              </div>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="space-y-1">
                <div className="text-zinc-400 font-semibold">
                  {t("history_view.args_and_raw_log")}
                </div>
                <div className="p-3 rounded bg-zinc-950 border border-zinc-800 text-zinc-300 whitespace-pre-wrap max-h-48 overflow-y-auto select-text">
                  {inspectRecord.args_json}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-zinc-400 font-semibold">
                  {t("history_view.result_summary_label")}
                </div>
                <div className="p-3 rounded bg-zinc-950 border border-zinc-800 text-zinc-300 select-text">
                  {inspectRecord.result_summary}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    JSON.stringify(inspectRecord, null, 2)
                  );
                  setCopiedInspect(true);
                  setTimeout(() => setCopiedInspect(false), 2000);
                }}
                className="px-3 py-1.5 rounded text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center gap-1.5 transition-colors"
              >
                {copiedInspect ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>
                  {copiedInspect
                    ? t("history_view.copied_json")
                    : t("history_view.copy_full_data")}
                </span>
              </button>
              <button
                onClick={() => setInspectRecord(null)}
                className="px-4 py-1.5 rounded text-xs font-medium bg-zinc-200 hover:bg-white text-zinc-950 font-semibold"
              >
                {t("history_view.close_btn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
