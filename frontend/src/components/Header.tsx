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
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold shadow-glow-emerald animate-pulse-subtle">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>ENGINE RUNNING</span>
          </div>
        );
      case 'PAUSED':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <span>ENGINE PAUSED</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-400 text-xs font-semibold">
            <span className="h-2 w-2 rounded-full bg-slate-500"></span>
            <span>ENGINE IDLE</span>
          </div>
        );
    }
  };

  return (
    <header className="h-16 border-b border-white/5 bg-surface-200/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-4">
        {getStatusBadge()}
        
        {pauseReason && engineState === 'PAUSED' && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
            <span className="font-semibold text-red-400">Alert:</span> {pauseReason}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Dark / Light Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 hover:border-primary-500/40 bg-surface-100/80 hover:bg-primary-500/10 text-slate-300 hover:text-primary-400 text-xs font-medium transition-all shadow-sm group"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="h-4 w-4 text-amber-400 transition-transform group-hover:rotate-45" />
              <span className="hidden sm:inline">Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 text-indigo-500 transition-transform group-hover:-rotate-12" />
              <span className="hidden sm:inline">Dark Mode</span>
            </>
          )}
        </button>

        {/* WebSocket health indicator */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mr-2" title="Engine Communication Channel">
          <Radio className={`h-3.5 w-3.5 ${wsConnected ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
          <span className="hidden sm:inline">{wsConnected ? 'Live Stream' : 'REST Active'}</span>
        </div>

        {/* Engine Controls */}
        {engineState === 'RUNNING' ? (
          <button
            onClick={onPause}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-all"
          >
            <Pause className="h-3.5 w-3.5" /> Pause Engine
          </button>
        ) : engineState === 'PAUSED' ? (
          <button
            onClick={onResume}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-glow-primary transition-all"
          >
            <RotateCw className="h-3.5 w-3.5" /> Resume Engine
          </button>
        ) : (
          <button
            onClick={onStart}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-glow-emerald transition-all"
          >
            <Play className="h-3.5 w-3.5" /> Start Auto Engine
          </button>
        )}
      </div>
    </header>
  );
}
