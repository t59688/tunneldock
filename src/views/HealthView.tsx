import React, { useState, useEffect } from "react";
import {
  RefreshCw,
  Power,
  RotateCcw,
  Globe,
  Radio,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { DoctorReport, OtunnelDaemonStatus } from "../types";
import {
  startOtunnel,
  stopOtunnel,
  restartOtunnel,
  runOtunnelDoctor,
  probeNetworkLatency,
} from "../api";
import { useTranslation } from "../i18n";

interface HealthViewProps {
  otunnelStatus: OtunnelDaemonStatus | null;
  onRefreshStatus: () => void;
}

export const HealthView: React.FC<HealthViewProps> = ({
  otunnelStatus,
  onRefreshStatus,
}) => {
  const { t } = useTranslation();
  const [doctorReport, setDoctorReport] = useState<DoctorReport | null>(null);
  const [runningDoctor, setRunningDoctor] = useState(false);
  const [networkLatency, setNetworkLatency] = useState<number | null>(null);
  const [probingNetwork, setProbingNetwork] = useState(false);
  const [showRawOutput, setShowRawOutput] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isRunning = Boolean(otunnelStatus?.running);
  const isOnline = Boolean(isRunning && otunnelStatus?.healthz_ok);
  const healthAddress = otunnelStatus?.health_base_url
    ? otunnelStatus.health_base_url.replace(/^https?:\/\//, "")
    : t("health_view.health_auto_allocated");
  const healthModeDescription = otunnelStatus?.listen_port
    ? t("health_view.health_address_desc", { port: otunnelStatus.listen_port })
    : t("health_view.health_address_desc_auto");

  const handleToggleDaemon = async () => {
    try {
      setActionLoading(true);
      setActionError(null);
      if (isRunning) {
        await stopOtunnel();
      } else {
        await startOtunnel();
      }
      await onRefreshStatus();
    } catch (e: any) {
      console.error(e);
      setActionError(String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestartDaemon = async () => {
    try {
      setActionLoading(true);
      setActionError(null);
      await restartOtunnel();
      await onRefreshStatus();
    } catch (e: any) {
      console.error(e);
      setActionError(String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunDoctor = async () => {
    try {
      setRunningDoctor(true);
      setActionError(null);
      const report = await runOtunnelDoctor();
      setDoctorReport(report);
    } catch (err: any) {
      console.error(err);
      setActionError(String(err));
    } finally {
      setRunningDoctor(false);
    }
  };

  const handleProbeNetwork = async () => {
    try {
      setProbingNetwork(true);
      const ms = await probeNetworkLatency();
      setNetworkLatency(ms);
    } catch (err) {
      console.error(err);
      setNetworkLatency(null);
    } finally {
      setProbingNetwork(false);
    }
  };

  useEffect(() => {
    handleProbeNetwork();
  }, []);

  const getDoctorItemTitle = (name: string) => {
    switch (name) {
      case "config_source":
        return t("health_view.item_config_source");
      case "profile_load":
        return t("health_view.item_profile_load");
      case "tunnel_id":
        return t("health_view.item_tunnel_id");
      case "control_plane_api_key":
        return t("health_view.item_control_plane_api_key");
      case "mcp_target":
        return t("health_view.item_mcp_target");
      case "mcp_server_reachable":
        return t("health_view.item_mcp_server_reachable");
      case "control_plane_connection":
        return t("health_view.item_control_plane_connection");
      case "health_listener":
        return t("health_view.item_health_listener");
      default:
        return name;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="p-5 rounded-lg bg-dark-card border border-zinc-800/90 shadow-lg flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-100">
              {t("health_view.title")}
            </h2>
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded border ${
                isOnline
                  ? "bg-emerald-950/50 text-emerald-400 border-emerald-800/60"
                  : "bg-zinc-900 text-zinc-500 border-zinc-800"
              }`}
            >
              {isOnline
                ? t("health_view.banner_online")
                : isRunning
                ? t("health_view.banner_abnormal")
                : t("health_view.banner_stopped")}
            </span>
          </div>
          <p className="text-xs text-zinc-400 max-w-xl">
            {t("health_view.banner_poll_desc", { desc: healthModeDescription })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefreshStatus}
            className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t("health_view.refresh_probe")}</span>
          </button>

          <button
            onClick={handleRunDoctor}
            disabled={runningDoctor}
            className="flex items-center gap-2 px-4 py-2 rounded text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold shadow transition-all disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>
              {runningDoctor
                ? t("health_view.running_doctor_btn")
                : t("health_view.run_doctor_btn")}
            </span>
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="font-semibold text-rose-200 block">
              {t("health_view.action_failed")}
            </span>
            <pre className="font-mono text-[11px] text-rose-300 whitespace-pre-wrap leading-relaxed select-text">
              {actionError}
            </pre>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-rose-400 hover:text-rose-200 text-xs font-mono shrink-0 px-2 py-1 rounded bg-rose-900/40 border border-rose-700/60 transition-colors"
          >
            {t("health_view.ignore_btn")}
          </button>
        </div>
      )}

      {/* Probes and Status Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Daemon Card */}
        <div className="p-4 rounded-lg bg-dark-card border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
              <Radio className="w-4 h-4 text-emerald-400" />
              <span>{t("health_view.daemon_card_title")}</span>
            </div>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                isOnline
                  ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/60"
                  : isRunning
                  ? "bg-amber-950/40 text-amber-400 border-amber-800/60"
                  : "bg-zinc-900 text-zinc-500 border-zinc-800"
              }`}
            >
              {isOnline ? "RUNNING" : isRunning ? "UNHEALTHY" : "STOPPED"}
            </span>
          </div>

          <div className="space-y-1.5 text-xs font-mono text-zinc-400">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">{t("health_view.pid_label")}</span>
              <span className="text-zinc-200">{otunnelStatus?.pid || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">{t("health_view.probe_port_label")}</span>
              <span className="text-zinc-200">
                {otunnelStatus?.listen_port
                  ? `127.0.0.1:${otunnelStatus.listen_port}`
                  : t("health_view.port_unstarted")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">{t("health_view.probe_latency_label")}</span>
              <span className="text-zinc-200">
                {otunnelStatus?.latency_ms != null
                  ? `${otunnelStatus?.latency_ms} ms`
                  : "—"}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-800/80 flex items-center gap-2">
            <button
              onClick={handleToggleDaemon}
              disabled={actionLoading}
              className={`flex-1 py-1.5 rounded text-xs font-medium border flex items-center justify-center gap-1.5 transition-colors ${
                isRunning
                  ? "bg-rose-950/30 text-rose-300 border-rose-800/60 hover:bg-rose-900/40"
                  : "bg-emerald-950/30 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/40"
              } disabled:opacity-50`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>
                {isRunning
                  ? t("health_view.stop_daemon")
                  : t("health_view.start_daemon")}
              </span>
            </button>
            {isRunning && (
              <button
                onClick={handleRestartDaemon}
                disabled={actionLoading}
                className="p-1.5 rounded text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors"
                title={t("health_view.restart_daemon")}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Health Endpoints Card */}
        <div className="p-4 rounded-lg bg-dark-card border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>{t("health_view.endpoints_card_title")}</span>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">
              {healthAddress}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2 rounded bg-zinc-950 border border-zinc-800/80 flex items-center justify-between">
              <div className="font-mono text-zinc-300 flex items-center gap-1.5">
                <span className="text-zinc-500">GET</span>
                <span>/healthz</span>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  otunnelStatus?.healthz_ok
                    ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/60"
                    : "bg-zinc-900 text-zinc-500 border-zinc-800"
                }`}
              >
                {otunnelStatus?.healthz_ok
                  ? t("health_view.endpoint_healthz_ok")
                  : t("health_view.endpoint_no_response")}
              </span>
            </div>

            <div className="p-2 rounded bg-zinc-950 border border-zinc-800/80 flex items-center justify-between">
              <div className="font-mono text-zinc-300 flex items-center gap-1.5">
                <span className="text-zinc-500">GET</span>
                <span>/readyz</span>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  otunnelStatus?.readyz_ok
                    ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/60"
                    : "bg-zinc-900 text-zinc-500 border-zinc-800"
                }`}
              >
                {otunnelStatus?.readyz_ok
                  ? t("health_view.endpoint_readyz_ok")
                  : t("health_view.endpoint_not_ready")}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-zinc-500">
            {t("health_view.endpoints_desc")}
          </p>
        </div>

        {/* Network Connectivity Card */}
        <div className="p-4 rounded-lg bg-dark-card border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
              <Globe className="w-4 h-4 text-emerald-400" />
              <span>{t("health_view.connectivity_card_title")}</span>
            </div>
            <button
              onClick={handleProbeNetwork}
              disabled={probingNetwork}
              className="text-zinc-400 hover:text-zinc-200"
              title={t("health_view.reprobe_network")}
            >
              <RefreshCw
                className={`w-3 h-3 ${probingNetwork ? "animate-spin" : ""}`}
              />
            </button>
          </div>

          <div className="space-y-1.5 text-xs font-mono text-zinc-400">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">{t("health_view.target_addr_label")}</span>
              <span className="text-zinc-200 truncate">api.openai.com:443</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">{t("health_view.network_status_label")}</span>
              <span
                className={
                  networkLatency !== null
                    ? "text-emerald-400 font-medium"
                    : "text-rose-400 font-medium"
                }
              >
                {networkLatency !== null
                  ? t("health_view.network_normal")
                  : t("health_view.network_timeout")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">{t("health_view.rtt_label")}</span>
              <span className="text-zinc-200">
                {networkLatency !== null ? `${networkLatency} ms` : "—"}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-500">
            {t("health_view.connectivity_desc")}
          </div>
        </div>
      </div>

      {/* Otunnel Doctor Checklist */}
      <div className="p-5 rounded-lg bg-dark-card border border-zinc-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-100">
                {t("health_view.doctor_title")}
              </h3>
              {doctorReport && (
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    doctorReport.overall === "PASS"
                      ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/60"
                      : "bg-amber-950/60 text-amber-400 border-amber-800/60"
                  }`}
                >
                  RESULT: {doctorReport.overall}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              {t("health_view.doctor_profile_desc")}
            </p>
          </div>

          {doctorReport && (
            <button
              onClick={() => setShowRawOutput(!showRawOutput)}
              className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-mono"
            >
              <span>
                {showRawOutput
                  ? t("health_view.collapse_raw_log")
                  : t("health_view.view_raw_log")}
              </span>
              {showRawOutput ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        {!doctorReport ? (
          <div className="py-8 text-center text-xs text-zinc-500 space-y-2 border border-dashed border-zinc-800 rounded">
            <div>{t("health_view.not_run_yet")}</div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {doctorReport.items.map((item, idx) => {
                const isPass = item.status === "PASS";
                const isSkip = item.status === "SKIP";

                return (
                  <div
                    key={idx}
                    className={`p-3 rounded border text-xs space-y-1.5 transition-all ${
                      isPass
                        ? "bg-zinc-950/60 border-zinc-800/80"
                        : isSkip
                        ? "bg-zinc-950/40 border-zinc-800/60"
                        : "bg-rose-950/20 border-rose-800/60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-medium text-zinc-200">
                        {getDoctorItemTitle(item.name)}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                          isPass
                            ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/60"
                            : isSkip
                            ? "bg-zinc-900 text-zinc-500 border-zinc-800"
                            : "bg-rose-950/60 text-rose-400 border-rose-800/60 font-semibold"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    {item.details && (
                      <div className="font-mono text-[11px] text-zinc-400 truncate">
                        {item.details}
                      </div>
                    )}

                    {item.suggestion && (
                      <div className="p-2 rounded bg-zinc-900/90 border border-zinc-800 text-[11px] text-amber-300 leading-relaxed">
                        <span className="font-semibold text-amber-400">
                          {t("health_view.fix_suggestion")}{" "}
                        </span>
                        {item.suggestion}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {showRawOutput && (
              <div className="p-3 rounded bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed select-text">
                {doctorReport.raw_output}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
