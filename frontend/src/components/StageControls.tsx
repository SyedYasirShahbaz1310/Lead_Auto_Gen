'use client';

import React, { useState, useRef } from 'react';
import { Search, Globe, Mail, ShieldCheck, Send, ArrowRight, Loader2, Sparkles, Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import { triggerMiner, triggerScraper, triggerVerifier, triggerDispatcher, uploadDomainFile } from '@/lib/api';

interface StageControlsProps {
  onRefresh: () => void;
  onOpenApproval?: () => void;
  approvalMode: boolean;
  setApprovalMode: (mode: boolean) => void;
}

export function StageControls({ onRefresh, onOpenApproval, approvalMode, setApprovalMode }: StageControlsProps) {
  const [keyword, setKeyword] = useState('real estate agency in pakistan');
  const [mineLimit, setMineLimit] = useState(20);
  const [scrapeBatch, setScrapeBatch] = useState(10);
  const [verifyBatch, setVerifyBatch] = useState(10);
  const [dispatchCount, setDispatchCount] = useState(5);
  const [fastMode, setFastMode] = useState(true);
  const [loadingStage, setLoadingStage] = useState<string | null>(null);

  // Upload State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const handleStage1 = async () => {
    setLoadingStage('miner');
    try {
      await triggerMiner(keyword, Number(mineLimit) || 20);
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStage(null);
    }
  };

  const handleStage2 = async () => {
    setLoadingStage('scraper');
    try {
      await triggerScraper(Number(scrapeBatch) || 10);
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStage(null);
    }
  };

  const handleStage3 = async () => {
    setLoadingStage('verifier');
    try {
      await triggerVerifier(Number(verifyBatch) || 10);
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStage(null);
    }
  };

  const handleStage4 = async () => {
    if (approvalMode && onOpenApproval) {
      onOpenApproval();
      return;
    }
    setLoadingStage('dispatcher');
    try {
      await triggerDispatcher(Number(dispatchCount) || 5, fastMode);
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStage(null);
    }
  };

  const [analyzedSummary, setAnalyzedSummary] = useState<any[] | null>(null);

  const handleFileUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadMsg({
      type: 'info',
      text: `Deeply analyzing ${selectedFile.name}... Scraping websites, detecting Niches & analyzing AI Pain Points...`
    });
    setAnalyzedSummary(null);
    try {
      const res = await uploadDomainFile(selectedFile);
      setUploadMsg({
        type: 'success',
        text: `Uploaded "${res.filename}"! Successfully analyzed ${res.added_to_sheet} website(s) with AI Niche & Pain Point detection.`,
      });
      if (res.leads && res.leads.length > 0) {
        setAnalyzedSummary(res.leads);
      }
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onRefresh();
    } catch (e: any) {
      setUploadMsg({
        type: 'error',
        text: e.message || 'File upload failed. Ensure .csv, .xlsx, or .txt format.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="glass-card p-5 rounded-2xl border border-white/5 space-y-4">
      {/* Top Header & Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary-400" /> Pipeline Controls & Custom Domain Intelligence
          </h2>
          <p className="text-xs text-slate-400">Configure batch limits, upload custom domain files with AI Niche & Pain Point analysis</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Approval Mode Toggle */}
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer bg-surface-100/80 px-3 py-1.5 rounded-xl border border-white/5 hover:border-primary-500/30 transition-colors">
            <input
              type="checkbox"
              checked={approvalMode}
              onChange={(e) => setApprovalMode(e.target.checked)}
              className="rounded border-slate-700 bg-surface-200 text-primary-600 focus:ring-primary-500 h-3.5 w-3.5"
            />
            <span className={approvalMode ? 'text-primary-300 font-semibold' : 'text-slate-300'}>
              Manual Outreach Approval Required
            </span>
          </label>

          {/* Fast dispatch mode toggle */}
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer bg-surface-100/80 px-3 py-1.5 rounded-xl border border-white/5">
            <input
              type="checkbox"
              checked={fastMode}
              onChange={(e) => setFastMode(e.target.checked)}
              className="rounded border-slate-700 bg-surface-200 text-primary-600 focus:ring-primary-500 h-3.5 w-3.5"
            />
            <span>Fast Demo (Skip Delay)</span>
          </label>
        </div>
      </div>

      {/* Domain File Upload Strip */}
      <div className="p-3.5 rounded-xl bg-surface-200/40 border border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <FileSpreadsheet className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xs font-semibold text-white block">Custom Domain File Upload (AI Niche & Pain Point Analysis)</span>
            <span className="text-[11px] text-slate-400">Upload .csv, .xlsx, or .txt — engine crawls site, detects Niche & extracts genuine Pain Points</span>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.txt"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setSelectedFile(e.target.files[0]);
                setUploadMsg(null);
                setAnalyzedSummary(null);
              }
            }}
            className="hidden"
            id="domain-file-input"
          />
          <label
            htmlFor="domain-file-input"
            className="flex-1 md:flex-none cursor-pointer py-1.5 px-3 rounded-lg bg-surface-200 hover:bg-surface-300 border border-white/10 text-xs text-slate-200 flex items-center justify-center gap-1.5 transition-all"
          >
            <Upload className="h-3.5 w-3.5 text-slate-400" />
            {selectedFile ? selectedFile.name : 'Choose File'}
          </label>

          {selectedFile && (
            <button
              onClick={handleFileUpload}
              disabled={isUploading}
              className="py-1.5 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {isUploading ? 'Analyzing Websites...' : 'Upload & Analyze'}
            </button>
          )}
        </div>
      </div>

      {uploadMsg && (
        <div
          className={`p-2.5 rounded-xl flex items-center gap-2 text-xs ${
            uploadMsg.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
              : uploadMsg.type === 'info'
              ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 animate-pulse'
              : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
          }`}
        >
          {uploadMsg.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          ) : uploadMsg.type === 'info' ? (
            <Loader2 className="h-4 w-4 shrink-0 text-cyan-400 animate-spin" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          )}
          <span>{uploadMsg.text}</span>
        </div>
      )}

      {/* Analyzed Custom Domains Intelligence Drawer */}
      {analyzedSummary && analyzedSummary.length > 0 && (
        <div className="p-4 rounded-xl bg-surface-100/90 border border-cyan-500/40 space-y-3 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Sparkles className="h-4 w-4 text-cyan-400 animate-pulse" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">
                  AI Deep Website Analysis & Detected Pain Points ({analyzedSummary.length} Uploaded Domains)
                </span>
                <span className="text-[10px] text-slate-400">
                  Exact Niche identified, executive contacts extracted & operational bottlenecks analyzed via Gemini AI
                </span>
              </div>
            </div>
            <button
              onClick={() => setAnalyzedSummary(null)}
              className="text-[11px] px-2 py-1 rounded-md bg-surface-200 hover:bg-surface-300 text-slate-300 hover:text-white transition-colors"
            >
              ✕ Close
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
            {analyzedSummary.map((item, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-surface-200/90 border border-white/10 space-y-2 text-xs shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-white text-sm block">{item.domain}</span>
                    <span className="text-[11px] text-slate-400 font-medium">{item.company_name}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-right">
                      {item.detected_niche || item.top_service_need || 'Commercial Business'}
                    </span>
                    {item.need_score ? (
                      <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                        Need Score: {item.need_score}%
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Scraped Contacts */}
                {(item.raw_email || item.phone_number) && (
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-300 bg-surface-300/40 p-1.5 rounded-lg border border-white/5">
                    {item.raw_email && (
                      <span className="text-cyan-300 flex items-center gap-1">
                        ✉ {item.raw_email.split(',')[0]}
                        {item.raw_email.split(',').length > 1 ? ` (+${item.raw_email.split(',').length - 1} more)` : ''}
                      </span>
                    )}
                    {item.phone_number && (
                      <span className="text-slate-400 flex items-center gap-1">
                        ☎ {item.phone_number.split(',')[0]}
                      </span>
                    )}
                  </div>
                )}

                {/* Detected Pain Points */}
                <div className="text-[11px] text-slate-200 bg-surface-300/80 p-2 rounded-lg border border-amber-500/20 leading-relaxed">
                  <span className="text-amber-400 font-bold block mb-0.5">⚠️ Detected Pain Points & Bottlenecks:</span>
                  {item.pain_points || 'Website analyzed. Lacks 24/7 autonomous inquiry responders.'}
                </div>

                {/* Pitch / Opportunity Angle */}
                {item.pitch_angle && (
                  <div className="text-[10px] text-emerald-300 bg-emerald-500/10 p-1.5 rounded-md border border-emerald-500/20">
                    <span className="font-bold text-emerald-400">💡 Solution: </span>
                    {item.pitch_angle}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4 Interactive Stage Cards with Custom Batch Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Stage 1: Miner */}
        <div className="p-3.5 rounded-xl bg-surface-100/50 border border-cyan-500/20 space-y-2.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-cyan-400">Stage 1: Domain Discovery</span>
              <Globe className="h-4 w-4 text-cyan-400" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Mines 100% genuine registered niche domains to Sheet 1.</p>
            <div className="space-y-1.5 mt-2">
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Keyword (e.g. fashion, real estate)"
                className="w-full bg-surface-200/80 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                <span>Count Limit:</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={mineLimit}
                  onChange={(e) => setMineLimit(parseInt(e.target.value) || 1)}
                  className="w-16 bg-surface-200/80 border border-white/10 rounded px-2 py-0.5 text-xs text-white text-right focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>
          <button
            onClick={handleStage1}
            disabled={loadingStage !== null}
            className="w-full mt-2 py-2 px-3 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
          >
            {loadingStage === 'miner' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Mine {mineLimit} Domains
          </button>
        </div>

        {/* Stage 2: Scraper */}
        <div className="p-3.5 rounded-xl bg-surface-100/50 border border-amber-500/20 space-y-2.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-400">Stage 2: Multi-Email & Phone</span>
              <Mail className="h-4 w-4 text-amber-400" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Extracts all genuine emails, Founder/CEO roles, and real phones.</p>
            <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-slate-400">
              <span>Scrape Batch Size:</span>
              <input
                type="number"
                min={1}
                max={50}
                value={scrapeBatch}
                onChange={(e) => setScrapeBatch(parseInt(e.target.value) || 1)}
                className="w-16 bg-surface-200/80 border border-white/10 rounded px-2 py-0.5 text-xs text-white text-right focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
          <button
            onClick={handleStage2}
            disabled={loadingStage !== null}
            className="w-full mt-2 py-2 px-3 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
          >
            {loadingStage === 'scraper' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
            Scrape {scrapeBatch} Leads
          </button>
        </div>

        {/* Stage 3: Verifier */}
        <div className="p-3.5 rounded-xl bg-surface-100/50 border border-emerald-500/20 space-y-2.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-400">Stage 3: Deliverability Verifier</span>
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">DNS MX check + APILayer. Pushes &gt;90% deliverable to Sheet 2.</p>
            <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-slate-400">
              <span>Verify Batch Size:</span>
              <input
                type="number"
                min={1}
                max={50}
                value={verifyBatch}
                onChange={(e) => setVerifyBatch(parseInt(e.target.value) || 1)}
                className="w-16 bg-surface-200/80 border border-white/10 rounded px-2 py-0.5 text-xs text-white text-right focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <button
            onClick={handleStage3}
            disabled={loadingStage !== null}
            className="w-full mt-2 py-2 px-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
          >
            {loadingStage === 'verifier' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            Verify {verifyBatch} Leads
          </button>
        </div>

        {/* Stage 4: Dispatcher */}
        <div className="p-3.5 rounded-xl bg-surface-100/50 border border-primary-500/20 space-y-2.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary-400">Stage 4: AI Cold Outreach</span>
              <Send className="h-4 w-4 text-primary-400" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {approvalMode ? 'Manual Approval Enabled: Review & send individually.' : 'Autonomous dispatch via Brevo REST API.'}
            </p>
            <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-slate-400">
              <span>Outreach Count:</span>
              <input
                type="number"
                min={1}
                max={50}
                value={dispatchCount}
                onChange={(e) => setDispatchCount(parseInt(e.target.value) || 1)}
                className="w-16 bg-surface-200/80 border border-white/10 rounded px-2 py-0.5 text-xs text-white text-right focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>
          <button
            onClick={handleStage4}
            disabled={loadingStage !== null}
            className="w-full mt-2 py-2 px-3 rounded-lg bg-primary-600/20 hover:bg-primary-600/30 text-primary-300 border border-primary-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
          >
            {loadingStage === 'dispatcher' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : approvalMode ? (
              <Sparkles className="h-3.5 w-3.5" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {approvalMode ? 'Open Approval Modal' : `Dispatch ${dispatchCount} Emails`}
          </button>
        </div>
      </div>
    </div>
  );
}
