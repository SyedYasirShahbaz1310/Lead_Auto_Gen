'use client';

import React from 'react';
import { Play, Pause, RotateCw, AlertTriangle, Radio, Sun, Moon } from 'lucide-react';
import { EngineState } from '@/lib/types';
import { useTheme } from '@/lib/theme';

interface HeaderProps {
  engineState: EngineState;
  pauseReason?: string | null;
  wsConnected: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
}

export function Header({
  engineState,
  pauseReason,
  wsConnected,
  onStart,
  onPause,
  onResume,
}: HeaderProps) {
  const { theme, toggleTheme } = useTheme();

  const getStatusBadge = () => {
    switch (engineState) {
      case 'RUNNING':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400 text-xs font-semibold shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>ENGINE RUNNING</span>
          </div>
        );
      case 'PAUSED':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400 text-xs font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <span>ENGINE PAUSED</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-400 text-xs font-semibold">
            <span className="h-2 w-2 rounded-full bg-slate-400"></span>
            <span>ENGINE IDLE</span>
          </div>
        );
    }
  };

  return (
    <header className="h-16 border-b border-slate-200 dark:border-white/5 bg-white/90 dark:bg-surface-200/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-10 transition-colors">
      <div className="flex items-center gap-4">
        {getStatusBadge()}
        
        {pauseReason && engineState === 'PAUSED' && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-300 text-xs">
            <span className="font-bold text-rose-600 dark:text-red-400">Alert:</span> {pauseReason}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Dark / Light Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 hover:bg-slate-200 dark:bg-surface-100/80 dark:hover:bg-primary-500/10 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all shadow-sm group"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="h-4 w-4 text-amber-500 transition-transform group-hover:rotate-45" />
              <span className="hidden sm:inline">Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 text-indigo-600 transition-transform group-hover:-rotate-12" />
              <span className="hidden sm:inline">Dark Mode</span>
            </>
          )}
        </button>

        {/* WebSocket health indicator */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mr-2" title="Engine Communication Channel">
          <Radio className={`h-3.5 w-3.5 ${wsConnected ? 'text-emerald-500 dark:text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
          <span className="hidden sm:inline font-medium">{wsConnected ? 'Live Stream' : 'REST Active'}</span>
        </div>

        {/* Engine Controls */}
        {engineState === 'RUNNING' ? (
          <button
            onClick={onPause}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-sm"
          >
            <Pause className="h-3.5 w-3.5" /> Pause Engine
          </button>
        ) : engineState === 'PAUSED' ? (
          <button
            onClick={onResume}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all"
          >
            <RotateCw className="h-3.5 w-3.5" /> Resume Engine
          </button>
        ) : (
          <button
            onClick={onStart}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all"
          >
            <Play className="h-3.5 w-3.5" /> Start Auto Engine
          </button>
        )}
      </div>
    </header>
  );
}
