import React, { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { Header } from "./components/Header";
import { TitleBar } from "./components/TitleBar";
import { UpdateDialog } from "./components/UpdateDialog";
import {
  CloseAction,
  CloseConfirmDialog,
} from "./components/CloseConfirmDialog";
import { Sidebar, NavTab } from "./components/Sidebar";
import { TerminalDrawer } from "./components/TerminalDrawer";
import { EnvironmentView } from "./views/EnvironmentView";
import { WorkspaceView } from "./views/WorkspaceView";
import { HealthView } from "./views/HealthView";
import { HistoryView } from "./views/HistoryView";
import { SettingsView } from "./views/SettingsView";
import {
  EnvCheckItem,
  WorkspaceItem,
  OtunnelDaemonStatus,
  McpCallRecord,
  TunnelSettings,
  InstallProgressEvent,
} from "./types";
import { useAppUpdater } from "./hooks/useAppUpdater";
import {
  checkEnvironment,
  listWorkspaces,
  getOtunnelStatus,
  listHistory,
  getSettings,
  startOtunnel,
  stopOtunnel,
  refreshProcessEnvironment,
  resolveCloseRequest,
} from "./api";
import { useTranslation } from "./i18n";

export const App: React.FC = () => {
  const { t, locale } = useTranslation();
  const [currentTab, setCurrentTab] = useState<NavTab>("env");
  const updater = useAppUpdater();
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeDialogBusy, setCloseDialogBusy] = useState(false);
  const [closeDialogError, setCloseDialogError] = useState<string | null>(null);

  // Core States
  const [envItems, setEnvItems] = useState<EnvCheckItem[]>([]);
  const [envLoading, setEnvLoading] = useState(false);

  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(false);

  const [otunnelStatus, setOtunnelStatus] = useState<OtunnelDaemonStatus | null>(
    null
  );
  const [isTogglingOtunnel, setIsTogglingOtunnel] = useState(false);
  const [tunnelActionError, setTunnelActionError] = useState<string | null>(
    null
  );

  const [history, setHistory] = useState<McpCallRecord[]>([]);
  const [settings, setSettings] = useState<TunnelSettings | null>(null);

  // Terminal Drawer State
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalTitle, setTerminalTitle] = useState(
    t("app.terminal_title_install")
  );
  const [terminalLogs, setTerminalLogs] = useState<
    Array<{ line: string; is_error: boolean }>
  >([]);

  // Refresh functions
  const loadEnv = useCallback(async () => {
    try {
      setEnvLoading(true);
      try {
        // Installers such as winget update persistent PATH, but a running desktop
        // process keeps the environment it inherited at startup. Refresh before
        // every environment scan so newly installed tools are detected immediately
        // without asking the user to restart TunnelDock.
        await refreshProcessEnvironment();
      } catch (e) {
        console.warn("Failed to refresh process environment:", e);
      }
      const items = await checkEnvironment();
      setEnvItems(items);
    } catch (e) {
      console.error("Failed to load environment:", e);
    } finally {
      setEnvLoading(false);
    }
  }, []);

  const loadWorkspaces = useCallback(async () => {
    try {
      setWorkspacesLoading(true);
      const list = await listWorkspaces();
      setWorkspaces(list);
    } catch (e) {
      console.error("Failed to load workspaces:", e);
    } finally {
      setWorkspacesLoading(false);
    }
  }, []);

  const loadOtunnelStatus = useCallback(async () => {
    try {
      const status = await getOtunnelStatus();
      setOtunnelStatus(status);
    } catch (e) {
      console.error("Failed to load otunnel status:", e);
    }
  }, []);

  const loadHistoryData = useCallback(async () => {
    try {
      const h = await listHistory();
      setHistory(h);
    } catch (e) {
      console.error("Failed to load history:", e);
    }
  }, []);

  const loadSettingsData = useCallback(async () => {
    try {
      const s = await getSettings();
      setSettings(s);
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.allSettled([
      loadEnv(),
      loadWorkspaces(),
      loadOtunnelStatus(),
      loadHistoryData(),
      loadSettingsData(),
    ]);
  }, [
    loadEnv,
    loadWorkspaces,
    loadOtunnelStatus,
    loadHistoryData,
    loadSettingsData,
  ]);

  // Initial Load and locale change reload
  useEffect(() => {
    refreshAll();
  }, [locale, refreshAll]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    listen("app-close-requested", () => {
      setCloseDialogError(null);
      setCloseDialogOpen(true);
    })
      .then((stopListening) => {
        if (disposed) {
          stopListening();
        } else {
          unlisten = stopListening;
        }
      })
      .catch((error) => {
        console.warn("Close request listener registration failed:", error);
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  // Periodic health polling
  useEffect(() => {
    const timer = setInterval(() => {
      loadOtunnelStatus();
    }, 4000);
    return () => clearInterval(timer);
  }, [loadOtunnelStatus]);

  // Event Listeners for logs
  useEffect(() => {
    let unlistenInstall: (() => void) | undefined;
    let unlistenWs: (() => void) | undefined;
    let unlistenAudit: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        unlistenInstall = await listen<InstallProgressEvent>(
          "install-log",
          (event) => {
            setTerminalLogs((prev) => [
              ...prev,
              { line: event.payload.log_line, is_error: event.payload.is_error },
            ]);
          }
        );

        unlistenWs = await listen<{
          workspace_id: string;
          line: string;
          is_error: boolean;
        }>("workspace-log", (event) => {
          setTerminalLogs((prev) => [
            ...prev,
            { line: event.payload.line, is_error: event.payload.is_error },
          ]);
        });

        unlistenAudit = await listen("audit-updated", () => {
          void loadHistoryData();
        });
      } catch (e) {
        console.warn("Tauri event listener registration skipped or failed:", e);
      }
    };

    setupListeners();

    return () => {
      if (unlistenInstall) unlistenInstall();
      if (unlistenWs) unlistenWs();
      if (unlistenAudit) unlistenAudit();
    };
  }, [loadHistoryData]);

  // Header Toggle Otunnel
  const handleToggleOtunnel = async () => {
    const isRunning = Boolean(otunnelStatus?.running);
    try {
      setIsTogglingOtunnel(true);
      setTunnelActionError(null);
      if (isRunning) {
        await stopOtunnel();
      } else {
        await startOtunnel();
      }
    } catch (err) {
      console.error(err);
      setTunnelActionError(String(err));
    } finally {
      await loadOtunnelStatus();
      setIsTogglingOtunnel(false);
    }
  };

  const handleCloseResolve = useCallback(
    async (action: CloseAction) => {
      if (closeDialogBusy) return;

      setCloseDialogBusy(true);
      setCloseDialogError(null);
      try {
        await resolveCloseRequest(action);
        setCloseDialogOpen(false);
      } catch (error) {
        setCloseDialogError(
          error instanceof Error ? error.message : String(error)
        );
      } finally {
        setCloseDialogBusy(false);
      }
    },
    [closeDialogBusy]
  );

  const handleOpenTerminalForWs = (_workspaceId: string, title: string) => {
    setTerminalTitle(title);
    setTerminalOpen(true);
  };

  // Badge calculations
  const missingEnvCount = envItems.filter(
    (i) => i.status === "missing" || i.status === "outdated"
  ).length;

  const activeWorkspacesCount = workspaces.filter(
    (w) => w.status === "ready" || w.status === "executing"
  ).length;

  const isTunnelOnline =
    otunnelStatus?.running && otunnelStatus?.healthz_ok;

  return (
    <div className="h-screen w-screen flex flex-col bg-dark-bg text-zinc-100 overflow-hidden font-sans">
      {/* Fully themed cross-platform window chrome */}
      <TitleBar />

      {/* Top Header */}
      <Header
        otunnelStatus={otunnelStatus}
        activeSessionsCount={activeWorkspacesCount}
        onToggleOtunnel={handleToggleOtunnel}
        isTogglingOtunnel={isTogglingOtunnel}
        onRefresh={refreshAll}
        updateState={updater.state}
        onOpenUpdater={updater.openDialog}
      />

      {tunnelActionError && (
        <div
          role="alert"
          className="mx-4 mt-3 p-3 rounded-lg bg-rose-950/50 border border-rose-800/70 text-xs text-rose-200 flex items-start justify-between gap-4 shadow-lg"
        >
          <div className="space-y-1 min-w-0">
            <div className="font-semibold">{t("app.tunnel_failed_title")}</div>
            <pre className="font-mono text-[11px] text-rose-300 whitespace-pre-wrap break-words leading-relaxed select-text">
              {tunnelActionError}
            </pre>
          </div>
          <button
            type="button"
            onClick={() => setTunnelActionError(null)}
            className="shrink-0 px-2 py-1 rounded border border-rose-700/60 bg-rose-900/40 text-rose-300 hover:text-rose-100"
          >
            {t("app.close_btn")}
          </button>
        </div>
      )}

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          missingEnvCount={missingEnvCount}
          activeWorkspacesCount={activeWorkspacesCount}
          doctorPassed={!!isTunnelOnline}
          historyCount={history.length}
          settings={settings}
        />

        {/* View Content Area */}
        <main className="flex-1 overflow-y-auto bg-dark-bg">
          {currentTab === "env" && (
            <EnvironmentView
              items={envItems}
              loading={envLoading}
              onRefresh={loadEnv}
              onOpenTerminal={() => {
                setTerminalTitle(t("app.terminal_title_env_diag"));
                setTerminalOpen(true);
              }}
              settings={settings}
              onSaveSettings={loadSettingsData}
            />
          )}

          {currentTab === "workspaces" && (
            <WorkspaceView
              workspaces={workspaces}
              loading={workspacesLoading}
              onRefresh={loadWorkspaces}
              onOpenTerminalForWorkspace={handleOpenTerminalForWs}
            />
          )}

          {currentTab === "health" && (
            <HealthView
              otunnelStatus={otunnelStatus}
              onRefreshStatus={loadOtunnelStatus}
            />
          )}

          {currentTab === "history" && (
            <HistoryView
              history={history}
              workspaces={workspaces}
              onRefresh={loadHistoryData}
            />
          )}

          {currentTab === "settings" && (
            <SettingsView
              settings={settings}
              onRefreshSettings={loadSettingsData}
              updateState={updater.state}
              onCheckUpdates={() => updater.checkForUpdates(true)}
              onOpenUpdater={updater.openDialog}
            />
          )}
        </main>
      </div>

      {/* Persistent Monospace Terminal Drawer */}
      <TerminalDrawer
        title={terminalTitle}
        isOpen={terminalOpen}
        onClose={() => setTerminalOpen(false)}
        logs={terminalLogs}
        onClear={() => setTerminalLogs([])}
      />

      <UpdateDialog
        open={updater.dialogOpen}
        state={updater.state}
        onClose={updater.closeDialog}
        onCheck={() => updater.checkForUpdates(true)}
        onInstall={updater.downloadAndInstall}
      />

      <CloseConfirmDialog
        open={closeDialogOpen}
        busy={closeDialogBusy}
        error={closeDialogError}
        onResolve={handleCloseResolve}
      />
    </div>
  );
};

export default App;
