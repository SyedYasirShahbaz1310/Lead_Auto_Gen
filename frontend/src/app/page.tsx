'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Header } from '@/components/Header';
import { MetricsCards } from '@/components/MetricsCards';
import { StageControls } from '@/components/StageControls';
import { LiveTerminal } from '@/components/LiveTerminal';
import { EmailApprovalModal } from '@/components/EmailApprovalModal';
import { 
  fetchStats, 
  startPipeline, 
  pausePipeline, 
  resumePipeline, 
  stopPipeline,
  fetchApiKeys,
  fetchVerifiedLeads 
} from '@/lib/api';
import { DashboardStats, LogEvent, ApiKeyItem, VerifiedLead } from '@/lib/types';
import { ShieldCheck, Cpu, Key, AlertCircle, RefreshCw } from 'lucide-react';

const INITIAL_STATS: DashboardStats = {
  state: 'IDLE',
  pause_reason: null,
  total_mined: 0,
  emails_scraped: 0,
  pending_scraping: 0,
  verified_leads: 0,
  ready_outreach: 0,
  emails_dispatched: 0,
  total_keys: 0,
  active_keys: 0,
  exhausted_keys: 0,
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [approvalMode, setApprovalMode] = useState(false);

  // Approval Modal State
  const [approvalLead, setApprovalLead] = useState<VerifiedLead | null>(null);
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [statsData, keysData] = await Promise.all([
        fetchStats(),
        fetchApiKeys()
      ]);
      setStats(statsData);
      setKeys(keysData.keys || []);
    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleOpenApproval = async () => {
    try {
      const res = await fetchVerifiedLeads('READY');
      const readyList: VerifiedLead[] = res.leads || [];
      if (readyList.length > 0) {
        setApprovalLead(readyList[0]);
        setIsApprovalOpen(true);
      } else {
        alert('No leads currently in READY status in Sheet 2. Run Stage 1-3 first to verify leads!');
      }
    } catch (e) {
      console.error('Error loading ready leads for approval:', e);
    }
  };

  // Initialize WebSocket connection
  useEffect(() => {
    loadData();

    const wsUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000')
      .replace(/^http/, 'ws') + '/ws/pipeline';

    let socket: WebSocket;
    let reconnectTimer: any;

    const connectWebSocket = () => {
      try {
        socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          setWsConnected(true);
          console.log('Connected to Pipeline WebSocket');
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'INITIAL_STATE') {
              if (data.state) {
                setStats(prev => ({ ...prev, state: data.state, pause_reason: data.pause_reason }));
              }
              if (Array.isArray(data.logs)) {
                setLogs(data.logs);
              }
            } else if (data.type === 'STATUS_CHANGE') {
              setStats(prev => ({ ...prev, state: data.state, pause_reason: data.pause_reason }));
              setLogs(prev => [...prev, data]);
              loadData();
            } else {
              setLogs(prev => [...prev, data]);
              if (data.type === 'STAGE_COMPLETE' || data.type === 'QUOTA_EXCEEDED' || data.type === 'KEY_ROTATED' || data.type === 'DOMAINS_UPLOADED' || data.type === 'EMAIL_APPROVED_DISPATCH') {
                loadData();
              }
            }
          } catch (err) {
            console.error('Error parsing WS message:', err);
          }
        };

        socket.onclose = () => {
          setWsConnected(false);
          reconnectTimer = setTimeout(connectWebSocket, 3000);
        };

        socket.onerror = () => {
          setWsConnected(false);
        };
      } catch (err) {
        console.error('WebSocket connection error:', err);
        reconnectTimer = setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    const interval = setInterval(loadData, 10000);

    return () => {
      if (socket) socket.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(interval);
    };
  }, [loadData]);

  const handleStart = async () => {
    try {
      await startPipeline();
      setStats(prev => ({ ...prev, state: 'RUNNING' }));
    } catch (e) {
      console.error(e);
    }
  };

  const handlePause = async () => {
    try {
      await pausePipeline();
      setStats(prev => ({ ...prev, state: 'PAUSED' }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleResume = async () => {
    try {
      await resumePipeline();
      setStats(prev => ({ ...prev, state: 'RUNNING' }));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <Header
        engineState={stats.state}
        pauseReason={stats.pause_reason}
        wsConnected={wsConnected}
        onStart={handleStart}
        onPause={handlePause}
        onResume={handleResume}
      />

      <main className="flex-1 p-6 space-y-6 max-w-7xl w-full mx-auto">
        {/* Top KPI Metrics */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">Executive Operations Dashboard</h1>
            <p className="text-xs text-slate-400">Real-time telemetry and autonomous outreach pipeline status</p>
          </div>
          <button
            onClick={loadData}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100/80 hover:bg-surface-50 border border-white/5 text-xs text-slate-300 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <MetricsCards stats={stats} />

        {/* Quota Exceeded Pause Notification Banner if applicable */}
        {stats.state === 'PAUSED' && stats.pause_reason && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-300">Pipeline Execution Paused</h3>
                <p className="text-xs text-amber-200/80">{stats.pause_reason}</p>
              </div>
            </div>
            <a
              href="/keys"
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-md shrink-0"
            >
              Inject / Activate Key
            </a>
          </div>
        )}

        {/* Stage Execution Control */}
        <StageControls 
          onRefresh={loadData}
          onOpenApproval={handleOpenApproval}
          approvalMode={approvalMode}
          setApprovalMode={setApprovalMode}
        />

        {/* Live Terminal & Key Pool Status Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live Streaming Terminal */}
          <div className="lg:col-span-2">
            <LiveTerminal logs={logs} onClear={() => setLogs([])} />
          </div>

          {/* Quick API Key Pool Status */}
          <div className="glass-card p-5 rounded-2xl border border-white/5 space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Key className="h-4 w-4 text-purple-400" /> Key Pool Health
                </h3>
                <a href="/keys" className="text-xs text-primary-400 hover:underline">
                  Manage Pool &rarr;
                </a>
              </div>

              <div className="mt-3 space-y-2.5">
                {keys.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-4 text-center">Loading key pool from Sheet 3...</p>
                ) : (
                  keys.map((k) => (
                    <div
                      key={k.row_index}
                      className="p-2.5 rounded-xl bg-surface-100/60 border border-white/5 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold uppercase text-slate-300">{k.provider}</span>
                        <span className="text-[10px] text-slate-500 px-1.5 py-0.5 rounded bg-surface-200">
                          {k.key_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 text-[11px]">{k.calls_made} calls</span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            k.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {k.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-surface-100/40 border border-white/5 text-[11px] text-slate-400">
              <span className="text-slate-300 font-semibold">Auto-Rotation:</span> On HTTP 402/429 status, the engine auto-exhausts the key, activates fallback keys, or pauses safely.
            </div>
          </div>
        </div>
      </main>

      {/* Global Email Approval Modal */}
      <EmailApprovalModal
        lead={approvalLead}
        isOpen={isApprovalOpen}
        onClose={() => {
          setIsApprovalOpen(false);
          setApprovalLead(null);
        }}
        onSuccess={loadData}
      />
    </div>
  );
}
