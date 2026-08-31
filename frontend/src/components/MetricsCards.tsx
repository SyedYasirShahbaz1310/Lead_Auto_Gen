'use client';

import React from 'react';
import { Globe, Mail, CheckCircle2, Send, Key } from 'lucide-react';
import { DashboardStats } from '@/lib/types';

interface MetricsCardsProps {
  stats: DashboardStats;
}

export function MetricsCards({ stats }: MetricsCardsProps) {
  const cards = [
    {
      title: 'Domains Mined',
      value: stats.total_mined,
      subtitle: `${stats.pending_scraping} pending scraping`,
      icon: Globe,
      lightBg: 'bg-sky-50/70 border-sky-200 hover:border-sky-300',
      darkBg: 'from-cyan-500/20 to-blue-500/10 border-cyan-500/30',
      textColor: 'text-sky-600 dark:text-cyan-400',
      iconBg: 'bg-sky-100 text-sky-600 dark:bg-cyan-500/10 dark:text-cyan-400',
    },
    {
      title: 'Emails Scraped',
      value: stats.emails_scraped,
      subtitle: 'BS4 & Hunter/Tomba fallback',
      icon: Mail,
      lightBg: 'bg-amber-50/70 border-amber-200 hover:border-amber-300',
      darkBg: 'from-amber-500/20 to-orange-500/10 border-amber-500/30',
      textColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
    },
    {
      title: 'Verified Leads (>90%)',
      value: stats.verified_leads,
      subtitle: `${stats.ready_outreach} ready for outreach`,
      icon: CheckCircle2,
      lightBg: 'bg-emerald-50/70 border-emerald-200 hover:border-emerald-300',
      darkBg: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/30',
      textColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
    },
    {
      title: 'Emails Dispatched',
      value: stats.emails_dispatched,
      subtitle: 'AI Gemini & Brevo Engine',
      icon: Send,
      lightBg: 'bg-indigo-50/70 border-indigo-200 hover:border-indigo-300',
      darkBg: 'from-primary-500/20 to-violet-500/10 border-primary-500/30',
      textColor: 'text-indigo-600 dark:text-primary-400',
      iconBg: 'bg-indigo-100 text-indigo-600 dark:bg-primary-500/10 dark:text-primary-400',
    },
    {
      title: 'Active API Keys',
      value: `${stats.active_keys} / ${stats.total_keys}`,
      subtitle: `${stats.exhausted_keys} exhausted in pool`,
      icon: Key,
      lightBg: 'bg-purple-50/70 border-purple-200 hover:border-purple-300',
      darkBg: 'from-purple-500/20 to-pink-500/10 border-purple-500/30',
      textColor: 'text-purple-600 dark:text-purple-400',
      iconBg: 'bg-purple-100 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div
            key={i}
            className={`p-4 rounded-2xl border transition-all duration-300 hover:scale-[1.02] shadow-sm bg-white dark:bg-gradient-to-br ${c.lightBg} dark:${c.darkBg}`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{c.title}</span>
              <div className={`p-2 rounded-xl ${c.iconBg}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">{c.value}</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              <span>{c.subtitle}</span>
            </p>
          </div>
        );
      })}
    </div>
  );
}
