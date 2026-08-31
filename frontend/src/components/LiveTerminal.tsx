'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Terminal, Trash2, ArrowDownCircle } from 'lucide-react';
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
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">SUCCESS</span>;
      case 'error':
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">ALERT</span>;
      case 'warning':
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">WARN</span>;
      default:
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">INFO</span>;
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden flex flex-col h-96 shadow-md bg-white dark:bg-slate-900 transition-colors">
      {/* Terminal Header */}
      <div className="bg-slate-100 dark:bg-surface-200/90 px-4 py-3 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-rose-500"></span>
            <span className="h-3 w-3 rounded-full bg-amber-500"></span>
            <span className="h-3 w-3 rounded-full bg-emerald-500"></span>
          </div>
          <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-300 ml-2 flex items-center gap-1.5">
            <Terminal className="h-3.5 w-3.5 text-indigo-600 dark:text-primary-400" /> realtime_pipeline.log
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 font-semibold ${
              autoScroll
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-primary-600/20 dark:text-primary-300 dark:border-primary-500/30'
                : 'bg-white text-slate-600 border-slate-300 dark:bg-surface-100 dark:text-slate-400 dark:border-white/5'
            }`}
          >
            <ArrowDownCircle className="h-3 w-3" />
            <span className="hidden sm:inline">Auto-scroll</span>
          </button>
          <button
            onClick={onClear}
            className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-surface-100 transition-all"
            title="Clear Terminal Logs"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Body - Monospace Console Window */}
      <div className="p-4 flex-1 overflow-y-auto font-mono text-xs space-y-2 bg-[#090d16] text-slate-200 selection:bg-indigo-500 selection:text-white">
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 italic">
            Waiting for live engine events...
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="flex items-start gap-2.5 animate-fade-in hover:bg-white/[0.04] p-1 rounded transition-colors">
              <span className="text-slate-500 select-none">
                [{log.timestamp || new Date().toLocaleTimeString()}]
              </span>
              <div className="shrink-0">{getLogBadge(log)}</div>
              {log.stage && (
                <span className="text-slate-400 font-semibold select-none">
                  [{log.stage}]
                </span>
              )}
              <span className={log.status === 'error' ? 'text-rose-300 font-medium' : log.status === 'warning' ? 'text-amber-300' : 'text-slate-200'}>
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
