import React, { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Layers,
  Plus,
  Play,
  Square,
  RotateCcw,
  GitBranch,
  FolderOpen,
  Copy,
  Check,
  Terminal,
  Trash2,
  Sparkles,
  X,
} from "lucide-react";
import { WorkspaceItem } from "../types";
import {
  addWorkspace,
  removeWorkspace,
  startWorkspaceSession,
  stopWorkspaceSession,
  restartWorkspaceSession,
  generateChatGptPrompt,
  openPathInExplorer,
} from "../api";
import { useTranslation } from "../i18n";

interface WorkspaceViewProps {
  workspaces: WorkspaceItem[];
  loading: boolean;
  onRefresh: () => void;
  onOpenTerminalForWorkspace: (workspaceId: string, title: string) => void;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({
  workspaces,
  loading: _loading,
  onRefresh,
  onOpenTerminalForWorkspace,
}) => {
  const { t, locale } = useTranslation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPath, setNewPath] = useState("");
  const [newName, setNewName] = useState("");
  const [addingError, setAddingError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ChatGPT prompt modal state
  const [promptModalWs, setPromptModalWs] = useState<WorkspaceItem | null>(null);
  const [promptText, setPromptText] = useState("");
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Loading state per workspace action
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const formatGitStatus = (rawStatus: string | null | undefined): string | null => {
    if (!rawStatus) return null;
    const lower = rawStatus.toLowerCase();
    if (lower.includes("clean") || rawStatus.includes("干净")) {
      return t("workspace_view.git_clean");
    }
    const match = rawStatus.match(/\d+/);
    if (match && (rawStatus.includes("未提交") || lower.includes("uncommitted"))) {
      return t("workspace_view.uncommitted_changes", { count: match[0] });
    }
    return rawStatus;
  };

  const handleSelectDirectory = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: t("workspace_view.folder_picker_title"),
      });

      if (selectedPath) {
        setNewPath(selectedPath);
        setAddingError(null);
      }
    } catch (err) {
      setAddingError(
        t("workspace_view.folder_picker_error", { error: String(err) })
      );
    }
  };

  const handleAddWorkspace = async () => {
    if (!newPath.trim()) {
      setAddingError(t("workspace_view.path_required"));
      return;
    }
    try {
      setIsSubmitting(true);
      setAddingError(null);
      await addWorkspace(newPath.trim(), newName.trim() || undefined);
      setNewPath("");
      setNewName("");
      setShowAddModal(false);
      await onRefresh();
    } catch (err: any) {
      setAddingError(String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStart = async (id: string, name: string) => {
    try {
      setActionLoadingId(id);
      await startWorkspaceSession(id);
      onOpenTerminalForWorkspace(id, `${name} (Pi Session)`);
      await onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleStop = async (id: string) => {
    try {
      setActionLoadingId(id);
      await stopWorkspaceSession(id);
      await onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRestart = async (id: string, name: string) => {
    try {
      setActionLoadingId(id);
      await restartWorkspaceSession(id);
      onOpenTerminalForWorkspace(id, `${name} (Pi Session)`);
      await onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemove = async (id: string) => {
    if (confirm(t("workspace_view.remove_confirm"))) {
      try {
        await removeWorkspace(id);
        await onRefresh();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleOpenPromptModal = async (ws: WorkspaceItem) => {
    try {
      const p = await generateChatGptPrompt(ws.path, ws.session_id, locale);
      setPromptText(p);
      setPromptModalWs(ws);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(promptText);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="p-5 rounded-lg bg-dark-card border border-zinc-800/90 shadow-lg flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-100">
              {t("workspace_view.title")}
            </h2>
            <span className="text-xs font-mono text-zinc-500">
              {t("workspace_view.projects_count", { count: workspaces.length })}
            </span>
          </div>
          <p className="text-xs text-zinc-400 max-w-2xl">
            {t("workspace_view.banner_desc")}
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 font-semibold shadow transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>{t("workspace_view.add_btn")}</span>
        </button>
      </div>

      {/* Workspaces Grid */}
      {workspaces.length === 0 ? (
        <div className="p-12 text-center rounded-lg bg-dark-card/50 border border-zinc-800/80 space-y-4">
          <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
            <Layers className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-zinc-200">
              {t("workspace_view.empty_title")}
            </h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              {t("workspace_view.empty_desc")}
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{t("workspace_view.add_first_project")}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workspaces.map((ws) => {
            const isRunning = ws.status === "ready" || ws.status === "executing";
            const isLoading = actionLoadingId === ws.id;

            return (
              <div
                key={ws.id}
                className={`p-5 rounded-lg bg-dark-card border transition-all flex flex-col justify-between space-y-4 ${
                  isRunning
                    ? "border-emerald-800/50 shadow-[0_0_15px_rgba(16,185,129,0.06)]"
                    : "border-zinc-800 hover:border-zinc-700/80"
                }`}
              >
                <div className="space-y-3">
                  {/* Top Bar: Title & Status */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-zinc-100">
                          {ws.name}
                        </h3>
                        {isRunning && (
                          <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 shrink-0 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            {t("workspace_view.session_online")}
                          </span>
                        )}
                        {!isRunning && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-500 border border-zinc-800 shrink-0 whitespace-nowrap">
                            {t("workspace_view.not_started")}
                          </span>
                        )}
                      </div>

                      {/* Path */}
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
                        <span className="truncate max-w-[280px]">{ws.path}</span>
                        <button
                          onClick={() => openPathInExplorer(ws.path)}
                          className="text-zinc-500 hover:text-zinc-300 transition-colors"
                          title={t("workspace_view.open_in_folder")}
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemove(ws.id)}
                      className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-900 transition-colors"
                      title={t("workspace_view.remove_workspace")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Metadata Row: Git & Session Details */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="p-2 rounded bg-zinc-950/70 border border-zinc-800/80 space-y-0.5">
                      <div className="text-zinc-500 flex items-center gap-1">
                        <GitBranch className="w-3 h-3 text-zinc-400" />
                        <span>{t("workspace_view.git_status_label")}</span>
                      </div>
                      <div className="text-zinc-300 font-medium truncate">
                        {ws.git_branch ? ws.git_branch : t("workspace_view.no_git_repo")}
                      </div>
                      {formatGitStatus(ws.git_status) && (
                        <div className="text-[10px] text-zinc-400 truncate">
                          {formatGitStatus(ws.git_status)}
                        </div>
                      )}
                    </div>

                    <div className="p-2 rounded bg-zinc-950/70 border border-zinc-800/80 space-y-0.5">
                      <div className="text-zinc-500 flex items-center justify-between">
                        <span>Session ID</span>
                        {ws.pid && (
                          <span className="text-[10px] text-zinc-500">
                            PID: {ws.pid}
                          </span>
                        )}
                      </div>
                      <div className="text-zinc-300 font-medium truncate">
                        {ws.session_id
                          ? ws.session_id
                          : isRunning
                          ? t("workspace_view.waiting_probe")
                          : t("workspace_view.not_activated")}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {t("workspace_view.bound_chatgpt", {
                          count: ws.binding_count,
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons Row */}
                <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {!isRunning ? (
                      <button
                        onClick={() => handleStart(ws.id, ws.name)}
                        disabled={isLoading}
                        className="px-3 py-1.5 rounded text-xs font-medium bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-300 border border-emerald-800/60 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Play className="w-3 h-3 text-emerald-400" />
                        <span>{t("workspace_view.start_pi_session")}</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleStop(ws.id)}
                          disabled={isLoading}
                          className="px-2.5 py-1.5 rounded text-xs font-medium bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 border border-rose-800/60 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Square className="w-3 h-3 text-rose-400" />
                          <span>{t("workspace_view.stop_session")}</span>
                        </button>
                        <button
                          onClick={() => handleRestart(ws.id, ws.name)}
                          disabled={isLoading}
                          className="p-1.5 rounded text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors disabled:opacity-50"
                          title={t("workspace_view.restart_tooltip")}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() =>
                        onOpenTerminalForWorkspace(
                          ws.id,
                          `${ws.name} (Pi Session)`
                        )
                      }
                      className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors border border-transparent hover:border-zinc-700"
                      title={t("workspace_view.terminal_tooltip")}
                    >
                      <Terminal className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => handleOpenPromptModal(ws)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition-colors"
                  >
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>{t("workspace_view.chatgpt_cmd_btn")}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Workspace Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-zinc-800 rounded-lg max-w-md w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-400 shrink-0" />
                  {t("workspace_view.add_modal_title")}
                </h3>
                <p className="text-xs text-zinc-400">
                  {t("workspace_view.add_modal_desc")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="shrink-0 p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition-colors"
                title={t("workspace_view.close_btn")}
                aria-label="close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addingError && (
              <div className="p-3 rounded bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300">
                {addingError}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-300 font-medium">
                  {t("workspace_view.project_path_label")}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t("workspace_view.project_path_placeholder")}
                    value={newPath}
                    onChange={(e) => {
                      setNewPath(e.target.value);
                      if (addingError) setAddingError(null);
                    }}
                    className="min-w-0 flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-zinc-600"
                  />
                  <button
                    type="button"
                    onClick={handleSelectDirectory}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                    title={t("workspace_view.select_folder_tooltip")}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    <span>{t("workspace_view.select_folder_btn")}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-zinc-300 font-medium">
                  {t("workspace_view.project_name_label")}
                </label>
                <input
                  type="text"
                  placeholder={t("workspace_view.project_name_placeholder")}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              >
                {t("workspace_view.close_btn")}
              </button>
              <button
                onClick={handleAddWorkspace}
                disabled={isSubmitting}
                className="px-4 py-1.5 rounded text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold disabled:opacity-50"
              >
                {isSubmitting
                  ? t("workspace_view.adding_btn")
                  : t("workspace_view.add_and_ready")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ChatGPT Prompt Modal */}
      {promptModalWs && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-zinc-800 rounded-lg max-w-xl w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5 min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{t("workspace_view.prompt_modal_title")}</span>
                </h3>
                <p
                  className="text-xs text-zinc-400 font-mono truncate"
                  title={`${promptModalWs.name} (${promptModalWs.path})`}
                >
                  {promptModalWs.name}{" "}
                  <span className="text-zinc-500">
                    ({promptModalWs.path})
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPromptModalWs(null)}
                className="shrink-0 p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition-colors"
                title={t("workspace_view.close_btn")}
                aria-label="close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded bg-zinc-950 border border-zinc-800/80 font-mono text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed select-text max-h-72 overflow-y-auto">
              {promptText}
            </div>

            <div className="flex items-center justify-between gap-4 pt-1">
              <p className="text-[11px] text-zinc-400 min-w-0 flex-1">
                {t("workspace_view.prompt_send_hint")}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPromptModalWs(null)}
                  className="px-3 py-1.5 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 shrink-0 whitespace-nowrap transition-colors"
                >
                  {t("workspace_view.close_btn")}
                </button>
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="px-3.5 py-1.5 rounded text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-colors shadow-sm"
                >
                  {copiedPrompt ? (
                    <Check className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>
                    {copiedPrompt
                      ? t("workspace_view.copied_prompt_btn")
                      : t("workspace_view.copy_prompt_btn")}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
