'use client';

import React from 'react';
import { Globe, Mail, CheckCircle2, Send, Key, Sparkles, TrendingUp } from 'lucide-react';
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
      color: 'from-cyan-500/20 to-blue-500/10',
      borderColor: 'border-cyan-500/30',
      textColor: 'text-cyan-400',
      iconBg: 'bg-cyan-500/10',
    },
    {
      title: 'Emails Scraped',
      value: stats.emails_scraped,
      subtitle: 'BS4 & Hunter/Tomba fallback',
      icon: Mail,
      color: 'from-amber-500/20 to-orange-500/10',
      borderColor: 'border-amber-500/30',
      textColor: 'text-amber-400',
      iconBg: 'bg-amber-500/10',
    },
    {
      title: 'Verified Leads (>90%)',
      value: stats.verified_leads,
      subtitle: `${stats.ready_outreach} ready for outreach`,
      icon: CheckCircle2,
      color: 'from-emerald-500/20 to-teal-500/10',
      borderColor: 'border-emerald-500/30',
      textColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10',
    },
    {
      title: 'Emails Dispatched',
      value: stats.emails_dispatched,
      subtitle: 'AI Gemini & Brevo Engine',
      icon: Send,
      color: 'from-primary-500/20 to-violet-500/10',
      borderColor: 'border-primary-500/30',
      textColor: 'text-primary-400',
      iconBg: 'bg-primary-500/10',
    },
    {
      title: 'Active API Keys',
      value: `${stats.active_keys} / ${stats.total_keys}`,
      subtitle: `${stats.exhausted_keys} exhausted in pool`,
      icon: Key,
      color: 'from-purple-500/20 to-pink-500/10',
      borderColor: 'border-purple-500/30',
      textColor: 'text-purple-400',
      iconBg: 'bg-purple-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div
            key={i}
            className={`glass-card p-4 rounded-2xl bg-gradient-to-br ${c.color} border ${c.borderColor} relative overflow-hidden transition-all duration-300 hover:scale-[1.02]`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400">{c.title}</span>
              <div className={`p-2 rounded-xl ${c.iconBg} ${c.textColor}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-white tracking-tight">{c.value}</div>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <span>{c.subtitle}</span>
            </p>
          </div>
        );
      })}
    </div>
  );
}
