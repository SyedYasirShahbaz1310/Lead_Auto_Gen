'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  KeyRound, 
  Zap, 
  Sparkles,
  Database,
  Sun,
  Moon
} from 'lucide-react';
import { useTheme } from '@/lib/theme';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Leads Explorer', href: '/leads', icon: Users },
  { name: 'API Key Pool', href: '/keys', icon: KeyRound },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="w-64 bg-white dark:bg-surface-200/90 border-r border-slate-200 dark:border-white/5 flex flex-col justify-between p-4 h-screen sticky top-0 backdrop-blur-xl z-20 transition-colors shadow-sm dark:shadow-none">
      <div>
        {/* Brand Logo */}
        <div className="flex items-center gap-3 px-3 py-4 mb-6 border-b border-slate-100 dark:border-white/5">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-primary-600 via-accent-violet to-accent-cyan flex items-center justify-center shadow-md">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-900 dark:text-slate-100 tracking-wide flex items-center gap-1.5">
              LenGen <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-primary-500/15 text-primary-600 dark:text-primary-400 border border-primary-500/30">AI</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Zero-SQL Outreach Engine</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1.5">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-primary-600/20 text-indigo-600 dark:text-primary-400 border border-indigo-200 dark:border-primary-500/30 shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-surface-50/50'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-600 dark:text-primary-400' : 'text-slate-500 dark:text-slate-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Engine Pipeline Stages Quick Guide */}
        <div className="mt-8 px-3.5 py-3 rounded-xl bg-slate-50 dark:bg-surface-100/60 border border-slate-200 dark:border-white/5 space-y-2.5">
          <div className="text-[11px] font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Pipeline Architecture</span>
            <Sparkles className="h-3 w-3 text-cyan-500 dark:text-accent-cyan" />
          </div>
          <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-500"></span>
              <span>1. DomainsDB Mining</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
              <span>2. BS4 / Hunter / Tomba</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span>3. DNS MX & APILayer</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
              <span>4. Gemini AI & Brevo</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {/* Quick Theme Switcher Card */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-surface-100/50 dark:hover:bg-surface-50 border border-slate-200 dark:border-white/5 text-xs text-slate-700 dark:text-slate-300 transition-all group"
        >
          <span className="flex items-center gap-2 font-medium">
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-500 group-hover:rotate-45 transition-transform" />
            ) : (
              <Moon className="h-4 w-4 text-indigo-600 group-hover:-rotate-12 transition-transform" />
            )}
            <span>{theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}</span>
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-white dark:bg-surface-200 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 uppercase font-mono font-bold">
            {theme}
          </span>
        </button>

        {/* Database & System Footprint */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-100/40 border border-slate-200 dark:border-white/5 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold">
              <Database className="h-3.5 w-3.5 text-emerald-600 dark:text-accent-emerald" /> Primary DB
            </span>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-transparent px-1.5 py-0.5 rounded font-mono font-bold">
              Google Sheets
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-500 truncate" title="1WfbbOks3xmzXImmHAXmER4P_cpBVAsgZlk_qpItFaaM">
            ID: 1WfbbOks3...
          </p>
        </div>
      </div>
    </aside>
  );
}
