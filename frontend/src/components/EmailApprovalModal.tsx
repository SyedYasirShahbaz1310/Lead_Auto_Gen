'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Send, 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Cpu, 
  Target
} from 'lucide-react';
import { previewColdEmail, dispatchApprovedEmail } from '@/lib/api';

interface EmailApprovalModalProps {
  lead: {
    row_index: number;
    domain: string;
    decision_maker_email: string;
    phone_number?: string;
    top_service_need?: string;
    need_score?: number;
    pain_points?: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EmailApprovalModal({ lead, isOpen, onClose, onSuccess }: EmailApprovalModalProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [serviceNeed, setServiceNeed] = useState('');
  const [needScore, setNeedScore] = useState<number>(0);
  const [painPoints, setPainPoints] = useState('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen && lead) {
      setServiceNeed(lead.top_service_need || 'AI Automation & Agentic AI');
      setNeedScore(lead.need_score || 88);
      setPainPoints(lead.pain_points || '');
      loadPreview();
    } else {
      setSubject('');
      setBody('');
      setStatusMsg(null);
    }
  }, [isOpen, lead]);

  const loadPreview = async () => {
    if (!lead) return;
    setIsLoadingPreview(true);
    setStatusMsg(null);
    try {
      const res = await previewColdEmail({
        domain: lead.domain,
        email: lead.decision_maker_email,
      });
      setSubject(res.subject || `Solving ${lead.domain}'s acquisition bottleneck with AI`);
      setBody(res.body || '');
      if (res.top_service_need) setServiceNeed(res.top_service_need);
      if (res.need_score) setNeedScore(res.need_score);
      if (res.pain_points) setPainPoints(res.pain_points);
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e.message || 'Failed to generate preview' });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleSend = async () => {
    if (!lead || !subject.trim() || !body.trim()) return;
    setIsSending(true);
    setStatusMsg(null);
    try {
      await dispatchApprovedEmail({
        row_index: lead.row_index,
        domain: lead.domain,
        email: lead.decision_maker_email,
        subject: subject.trim(),
        body: body.trim(),
      });
      setStatusMsg({ type: 'success', text: `Email dispatched successfully to ${lead.decision_maker_email}!` });
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e.message || 'Failed to dispatch email' });
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen || !lead) return null;

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-surface-200/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-primary-500/20 text-indigo-600 dark:text-primary-400 border border-indigo-200 dark:border-primary-500/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Manual Cold Outreach Approval</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                AI Website Pain-Point Analysis & Consultative Outreach for <span className="text-slate-900 dark:text-white font-bold">{lead.domain}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {statusMsg && (
            <div
              className={`p-3 rounded-xl flex items-center gap-2.5 text-xs font-bold ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-300'
                  : 'bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-300'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Lead Details */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 dark:bg-surface-200/50 rounded-xl border border-slate-200 dark:border-white/5 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">Domain</span>
              <span className="text-slate-900 dark:text-white font-bold">{lead.domain}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Recipient Email</span>
              <span className="text-emerald-700 dark:text-emerald-300 font-mono font-bold">{lead.decision_maker_email}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Phone Number</span>
              <span className="text-slate-700 dark:text-slate-300 font-medium">{lead.phone_number || 'N/A'}</span>
            </div>
          </div>

          {/* AI Website Intelligence & Pain Point Analysis Card */}
          <div className="p-4 bg-indigo-50/70 dark:bg-gradient-to-br dark:from-indigo-950/40 dark:via-surface-200/60 dark:to-purple-950/30 rounded-xl border border-indigo-200 dark:border-indigo-500/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-300">
                <Target className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                AI Website Diagnosis & Service Match
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Need Urgency:</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 text-xs font-bold dark:border-emerald-500/30">
                  {needScore || 88}/100
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-white dark:bg-black/20 rounded-lg border border-indigo-100 dark:border-white/5 shadow-sm">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-bold uppercase tracking-wider mb-1">Recommended Solution</span>
                <span className="text-indigo-700 dark:text-cyan-300 font-bold text-xs flex items-center gap-1">
                  <Cpu className="h-3.5 w-3.5 text-indigo-600 dark:text-cyan-400" />
                  {serviceNeed || 'AI Automation & Agentic AI'}
                </span>
              </div>

              <div className="p-2.5 bg-white dark:bg-black/20 rounded-lg border border-indigo-100 dark:border-white/5 shadow-sm">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-bold uppercase tracking-wider mb-1">Identified Pain Points</span>
                <p className="text-slate-700 dark:text-slate-300 text-[11px] leading-snug font-medium">
                  {painPoints || 'Lacks 24/7 autonomous client interaction and high-converting AI pipeline infrastructure.'}
                </p>
              </div>
            </div>
          </div>

          {isLoadingPreview ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-600 dark:text-primary-400" />
              <p className="text-xs font-medium">Crafting human-like consultative cold email addressing detected pain points...</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Subject Line */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Email Subject Line</label>
                  <button
                    onClick={loadPreview}
                    className="text-[11px] text-indigo-600 hover:text-indigo-700 dark:text-primary-400 dark:hover:text-primary-300 flex items-center gap-1 font-bold transition-colors"
                  >
                    <RefreshCw className="h-3 w-3" /> Regenerate AI Draft
                  </button>
                </div>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-white dark:bg-surface-200 border border-slate-300 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-medium shadow-sm"
                  placeholder="Subject line..."
                />
              </div>

              {/* Email Body */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Personalized Email Body (Human-Written Style)
                  </label>
                  <span className={`text-[11px] font-mono font-semibold ${wordCount > 130 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                    {wordCount} words (~100 recommended)
                  </span>
                </div>
                <textarea
                  rows={9}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full bg-white dark:bg-surface-200 border border-slate-300 dark:border-white/10 rounded-xl p-3.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 leading-relaxed font-sans shadow-sm"
                  placeholder="Email body..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-surface-200/60">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleSend}
              disabled={isSending || isLoadingPreview || !subject.trim() || !body.trim()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending via Brevo...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Approve & Send Email
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
