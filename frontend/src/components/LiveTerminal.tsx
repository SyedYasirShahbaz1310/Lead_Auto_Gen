'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Terminal, Trash2, ArrowDownCircle, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';
import { LogEvent } from '@/lib/types';

interface LiveTerminalProps {
  logs: LogEvent[];
  onClear: () => void;
}

export function LiveTerminal({ logs, onClear }: LiveTerminalProps) {
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const getLogBadge = (log: LogEvent) => {
    switch (log.status) {
      case 'success':
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">SUCCESS</span>;
      case 'error':
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">ALERT</span>;
      case 'warning':
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">WARN</span>;
      default:
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">INFO</span>;
    }
  };

  return (
    <div className="glass-card rounded-2xl border border-white/5 overflow-hidden flex flex-col h-96">
      {/* Terminal Header */}
      <div className="bg-surface-200/90 px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-500/80"></span>
            <span className="h-3 w-3 rounded-full bg-amber-500/80"></span>
            <span className="h-3 w-3 rounded-full bg-emerald-500/80"></span>
          </div>
          <span className="text-xs font-mono font-semibold text-slate-300 ml-2 flex items-center gap-1.5">
            <Terminal className="h-3.5 w-3.5 text-primary-400" /> realtime_pipeline.log
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${
              autoScroll ? 'bg-primary-600/20 text-primary-300 border-primary-500/30' : 'bg-surface-100 text-slate-400 border-white/5'
            }`}
          >
            <ArrowDownCircle className="h-3 w-3" />
            <span className="hidden sm:inline">Auto-scroll</span>
          </button>
          <button
            onClick={onClear}
            className="text-xs text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-surface-100 transition-all"
            title="Clear Terminal Logs"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      <div className="p-4 flex-1 overflow-y-auto font-mono text-xs space-y-2 bg-[#060910]">
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 italic">
            Waiting for live engine events...
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="flex items-start gap-2.5 animate-fade-in hover:bg-white/[0.02] p-1 rounded transition-colors">
              <span className="text-slate-500 select-none">
                [{log.timestamp || new Date().toLocaleTimeString()}]
              </span>
              <div className="shrink-0">{getLogBadge(log)}</div>
              {log.stage && (
                <span className="text-slate-400 font-semibold select-none">
                  [{log.stage}]
                </span>
              )}
              <span className={log.status === 'error' ? 'text-rose-300 font-medium' : log.status === 'warning' ? 'text-amber-300' : 'text-slate-300'}>
                {log.message}
              </span>
            </div>
          ))
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}
