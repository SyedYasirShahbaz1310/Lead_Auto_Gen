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
  Database
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Leads Explorer', href: '/leads', icon: Users },
  { name: 'API Key Pool', href: '/keys', icon: KeyRound },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-surface-200/90 border-r border-white/5 flex flex-col justify-between p-4 h-screen sticky top-0 backdrop-blur-xl z-20">
      <div>
        {/* Brand Logo */}
        <div className="flex items-center gap-3 px-3 py-4 mb-6 border-b border-white/5">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-primary-600 via-accent-violet to-accent-cyan flex items-center justify-center shadow-glow-primary">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white tracking-wide flex items-center gap-1.5">
              LenGen <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-primary-500/20 text-primary-400 border border-primary-500/30">AI</span>
            </h1>
            <p className="text-xs text-slate-400">Zero-SQL Outreach Engine</p>
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
                    ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30 shadow-glow-primary'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-surface-50/50'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-primary-400' : 'text-slate-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Engine Pipeline Stages Quick Guide */}
        <div className="mt-8 px-3 py-3 rounded-xl bg-surface-100/60 border border-white/5 space-y-2.5">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Pipeline Architecture</span>
            <Sparkles className="h-3 w-3 text-accent-cyan" />
          </div>
          <div className="space-y-1.5 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan"></span>
              <span>1. DomainsDB Mining</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-amber"></span>
              <span>2. BS4 / Hunter / Tomba</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-emerald"></span>
              <span>3. DNS MX & APILayer</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-400"></span>
              <span>4. Gemini AI & Brevo</span>
            </div>
          </div>
        </div>
      </div>

      {/* Database & System Footprint */}
      <div className="p-3 rounded-xl bg-surface-100/40 border border-white/5 text-xs text-slate-400 space-y-1">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-slate-300 font-medium">
            <Database className="h-3.5 w-3.5 text-accent-emerald" /> Primary DB
          </span>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-mono">
            Google Sheets
          </span>
        </div>
        <p className="text-[11px] text-slate-500 truncate" title="1WfbbOks3xmzXImmHAXmER4P_cpBVAsgZlk_qpItFaaM">
          ID: 1WfbbOks3...
        </p>
      </div>
    </aside>
  );
}
