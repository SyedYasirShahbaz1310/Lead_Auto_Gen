'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { 
  fetchRawLeads, 
  fetchVerifiedLeads, 
  deleteRawLeads, 
  deleteVerifiedLeads 
} from '@/lib/api';
import { exportToCSV, exportToExcel } from '@/lib/exportUtils';
import { RawLead, VerifiedLead } from '@/lib/types';
import { EmailApprovalModal } from '@/components/EmailApprovalModal';
import { 
  Users, 
  Search, 
  Download, 
  FileSpreadsheet, 
  RefreshCw, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Send, 
  Mail,
  ExternalLink,
  Filter,
  Sparkles,
  Phone,
  Trash2,
  CheckSquare,
  Square,
  Cpu,
  Target,
  Zap,
  Layers
} from 'lucide-react';

export default function LeadsExplorerPage() {
  const [activeTab, setActiveTab] = useState<'verified' | 'raw'>('verified');
  const [rawLeads, setRawLeads] = useState<RawLead[]>([]);
  const [verifiedLeads, setVerifiedLeads] = useState<VerifiedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');

  // Multi-Selection State
  const [selectedRawDomains, setSelectedRawDomains] = useState<Set<string>>(new Set());
  const [selectedVerifiedEmails, setSelectedVerifiedEmails] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  // Approval Modal State
  const [approvalModalLead, setApprovalModalLead] = useState<VerifiedLead | null>(null);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rawRes, verifiedRes] = await Promise.all([
        fetchRawLeads(),
        fetchVerifiedLeads()
      ]);
      setRawLeads(rawRes.leads || []);
      setVerifiedLeads(verifiedRes.leads || []);
      setSelectedRawDomains(new Set());
      setSelectedVerifiedEmails(new Set());
    } catch (e) {
      console.error('Error loading leads:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Raw Leads
  const filteredRawLeads = useMemo(() => {
    return rawLeads.filter(lead => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        lead.domain.toLowerCase().includes(q) ||
        lead.company_name.toLowerCase().includes(q) ||
        lead.raw_email.toLowerCase().includes(q) ||
        (lead.top_service_need && lead.top_service_need.toLowerCase().includes(q)) ||
        (lead.pain_points && lead.pain_points.toLowerCase().includes(q)) ||
        lead.phone_number.includes(q);
      
      const matchesStatus = statusFilter === 'ALL' || lead.scrape_status === statusFilter;
      const matchesService = serviceFilter === 'ALL' || (lead.top_service_need && lead.top_service_need.includes(serviceFilter));
      return matchesSearch && matchesStatus && matchesService;
    });
  }, [rawLeads, searchQuery, statusFilter, serviceFilter]);

  // Filtered Verified Leads
  const filteredVerifiedLeads = useMemo(() => {
    return verifiedLeads.filter(lead => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        lead.domain.toLowerCase().includes(q) ||
        lead.company_name.toLowerCase().includes(q) ||
        lead.decision_maker_email.toLowerCase().includes(q) ||
        (lead.top_service_need && lead.top_service_need.toLowerCase().includes(q)) ||
        (lead.pain_points && lead.pain_points.toLowerCase().includes(q)) ||
        lead.phone_number.includes(q);
      
      const matchesStatus = statusFilter === 'ALL' || lead.outreach_status === statusFilter;
      const matchesService = serviceFilter === 'ALL' || (lead.top_service_need && lead.top_service_need.includes(serviceFilter));
      return matchesSearch && matchesStatus && matchesService;
    });
  }, [verifiedLeads, searchQuery, statusFilter, serviceFilter]);

  // Selection Logic
  const toggleSelectAll = () => {
    if (activeTab === 'verified') {
      if (selectedVerifiedEmails.size === filteredVerifiedLeads.length) {
        setSelectedVerifiedEmails(new Set());
      } else {
        setSelectedVerifiedEmails(new Set(filteredVerifiedLeads.map(l => l.decision_maker_email)));
      }
    } else {
      if (selectedRawDomains.size === filteredRawLeads.length) {
        setSelectedRawDomains(new Set());
      } else {
        setSelectedRawDomains(new Set(filteredRawLeads.map(l => l.domain)));
      }
    }
  };

  const toggleSelectRaw = (domain: string) => {
    const next = new Set(selectedRawDomains);
    if (next.has(domain)) next.delete(domain);
    else next.add(domain);
    setSelectedRawDomains(next);
  };

  const toggleSelectVerified = (email: string) => {
    const next = new Set(selectedVerifiedEmails);
    if (next.has(email)) next.delete(email);
    else next.add(email);
    setSelectedVerifiedEmails(next);
  };

  // Delete Action Handlers
  const handleDeleteSelected = async () => {
    const count = activeTab === 'verified' ? selectedVerifiedEmails.size : selectedRawDomains.size;
    if (count === 0) return;

    const confirmText = activeTab === 'verified'
      ? `Are you sure you want to delete ${count} selected lead(s) from Google Sheets?`
      : `Are you sure you want to delete ${count} selected domain(s) from Google Sheets?`;

    if (!window.confirm(confirmText)) return;

    try {
      setIsDeleting(true);
      if (activeTab === 'verified') {
        await deleteVerifiedLeads(Array.from(selectedVerifiedEmails));
        setDeleteMessage(`Successfully deleted ${count} lead(s) from Sheet 2.`);
      } else {
        await deleteRawLeads(Array.from(selectedRawDomains));
        setDeleteMessage(`Successfully deleted ${count} domain(s) from Sheet 1.`);
      }
      await loadData();
      setTimeout(() => setDeleteMessage(null), 4000);
    } catch (e: any) {
      alert(`Delete failed: ${e.message || 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteSingleRaw = async (domain: string) => {
    if (!window.confirm(`Delete domain "${domain}" from Google Sheets?`)) return;
    try {
      setIsDeleting(true);
      await deleteRawLeads([domain]);
      setDeleteMessage(`Deleted domain ${domain} from Sheet 1.`);
      await loadData();
      setTimeout(() => setDeleteMessage(null), 3000);
    } catch (e: any) {
      alert(`Delete failed: ${e.message || 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteSingleVerified = async (email: string, domain: string) => {
    if (!window.confirm(`Delete lead "${email}" (${domain}) from Google Sheets?`)) return;
    try {
      setIsDeleting(true);
      await deleteVerifiedLeads([email], [domain]);
      setDeleteMessage(`Deleted lead ${email} from Sheet 2.`);
      await loadData();
      setTimeout(() => setDeleteMessage(null), 3000);
    } catch (e: any) {
      alert(`Delete failed: ${e.message || 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportCSV = () => {
    if (activeTab === 'raw') {
      exportToCSV(rawLeads, 'Raw_Scraped_Domains');
    } else {
      exportToCSV(verifiedLeads, 'Verified_Outreach_Queue');
    }
  };

  const handleExportExcel = () => {
    exportToExcel(rawLeads, verifiedLeads, 'LenGen_Full_Database');
  };

  const openApprovalModal = (lead: VerifiedLead) => {
    setApprovalModalLead(lead);
    setIsApprovalModalOpen(true);
  };

  const getServiceBadge = (service?: string, score?: number) => {
    const s = service || 'AI Automation & Agentic AI';
    let badgeStyle = 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/30';
    let icon = <Cpu className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />;

    if (s.includes('Web')) {
      badgeStyle = 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/30';
      icon = <Layers className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />;
    } else if (s.includes('SEO')) {
      badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30';
      icon = <Target className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />;
    } else if (s.includes('Learning') || s.includes('Machine')) {
      badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30';
      icon = <Zap className="h-3 w-3 text-amber-600 dark:text-amber-400" />;
    }

    return (
      <div className="flex flex-col gap-1">
        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${badgeStyle}`}>
          {icon}
          {s.split('&')[0].trim()}
        </span>
        {score ? (
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1 font-semibold">
            Need Score: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{score}/100</span>
          </span>
        ) : null}
      </div>
    );
  };

  const renderPainPoints = (text?: string) => {
    if (!text) return <span className="text-slate-400 dark:text-slate-500 italic">—</span>;
    if (text.startsWith('[') && text.includes(']')) {
      const parts = text.split(']');
      const niche = parts[0].replace('[', '').trim();
      const rest = parts.slice(1).join(']').trim();
      return (
        <div className="space-y-1">
          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/20">
            {niche}
          </span>
          <p className="text-slate-700 dark:text-slate-300 text-[11px] line-clamp-2 leading-relaxed" title={text}>
            {rest}
          </p>
        </div>
      );
    }
    return (
      <p className="text-slate-700 dark:text-slate-300 text-[11px] line-clamp-2 leading-relaxed" title={text}>
        {text}
      </p>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'READY':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30"><CheckCircle2 className="h-3 w-3" /> READY</span>;
      case 'SENT':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-primary-500/10 dark:text-primary-400 dark:border-primary-500/30"><Send className="h-3 w-3" /> SENT</span>;
      case 'DONE':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/30"><CheckCircle2 className="h-3 w-3" /> DONE</span>;
      case 'PENDING':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30"><Clock className="h-3 w-3" /> PENDING</span>;
      case 'REJECTED':
      case 'BOUNCED':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30"><XCircle className="h-3 w-3" /> {status}</span>;
      default:
        return <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{status}</span>;
    }
  };

  const selectedCount = activeTab === 'verified' ? selectedVerifiedEmails.size : selectedRawDomains.size;
  const totalInView = activeTab === 'verified' ? filteredVerifiedLeads.length : filteredRawLeads.length;
  const isAllSelected = totalInView > 0 && selectedCount === totalInView;

  return (
    <div className="flex-1 p-6 space-y-6 max-w-7xl w-full mx-auto">
      {/* Delete Notification Banner */}
      {deleteMessage && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300 text-xs font-bold animate-fade-in shadow-md">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            {deleteMessage}
          </div>
          <button onClick={() => setDeleteMessage(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">✕</button>
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600 dark:text-primary-400" /> Leads Database Explorer
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Live synchronization with Google Sheets & AI Website Intelligence Analysis
          </p>
        </div>

        {/* Action Buttons: Refresh, CSV Export, Excel XLSX Export */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={loadData}
            disabled={loading || isDeleting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-surface-100/80 dark:hover:bg-surface-50 border border-slate-200 dark:border-white/5 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 dark:bg-surface-100 dark:hover:bg-surface-50 border border-slate-300 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-white transition-all shadow-sm"
          >
            <Download className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
            Export to CSV
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-bold text-white transition-all shadow-md"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Export to Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* Tabs, Search, Filter Bar & Bulk Delete Button */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-surface-200/90 border border-slate-200 dark:border-white/5 shadow-sm">
        {/* Switch Sheet 1 vs Sheet 2 */}
        <div className="flex p-1 bg-slate-100 dark:bg-surface-200/80 rounded-xl border border-slate-200 dark:border-white/5 shrink-0">
          <button
            onClick={() => { setActiveTab('verified'); setStatusFilter('ALL'); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'verified'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Verified Outreach Queue (Sheet 2)
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'verified' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300'}`}>
              {verifiedLeads.length}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('raw'); setStatusFilter('ALL'); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'raw'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Mail className="h-4 w-4 text-cyan-400" />
            Raw Scraped Domains (Sheet 1)
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'raw' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300'}`}>
              {rawLeads.length}
            </span>
          </button>
        </div>

        {/* Action Controls & Search */}
        <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap">
          {/* Bulk Delete Button when items selected */}
          {selectedCount > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md"
            >
              <Trash2 className={`h-3.5 w-3.5 ${isDeleting ? 'animate-spin' : ''}`} />
              Delete Selected ({selectedCount})
            </button>
          )}

          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search domain, pain point..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-surface-200 border border-slate-300 dark:border-white/10 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-sm"
            />
          </div>

          {/* Service Need Filter */}
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="bg-white dark:bg-surface-200 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500 shadow-sm"
          >
            <option value="ALL">All Services</option>
            <option value="AI Automation">AI Automation</option>
            <option value="Web">Web Development</option>
            <option value="SEO">SEO & Growth</option>
            <option value="Machine">ML & Data</option>
          </select>

          <div className="flex items-center gap-2 shrink-0">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white dark:bg-surface-200 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500 shadow-sm"
            >
              <option value="ALL">All Statuses</option>
              {activeTab === 'verified' ? (
                <>
                  <option value="READY">READY (Verified)</option>
                  <option value="SENT">SENT (Outreach)</option>
                  <option value="BOUNCED">BOUNCED</option>
                </>
              ) : (
                <>
                  <option value="PENDING">PENDING</option>
                  <option value="DONE">DONE</option>
                  <option value="REJECTED">REJECTED</option>
                </>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm bg-white dark:bg-slate-900 transition-colors">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
            <RefreshCw className="h-6 w-6 animate-spin text-indigo-600 dark:text-primary-400" />
            <p className="text-xs font-medium">Querying Google Sheets Primary Database...</p>
          </div>
        ) : activeTab === 'verified' ? (
          /* Table for Sheet 2: Verified Outreach Queue */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-surface-200/90 text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-white/5 font-bold">
                <tr>
                  <th className="px-3 py-3 w-10 text-center">
                    <button 
                      onClick={toggleSelectAll} 
                      className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                      title="Select / Deselect All"
                    >
                      {isAllSelected ? (
                        <CheckSquare className="h-4 w-4 text-indigo-600 dark:text-primary-400" />
                      ) : (
                        <Square className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-3">#</th>
                  <th className="px-4 py-3">Domain</th>
                  <th className="px-4 py-3">Decision Maker Email</th>
                  <th className="px-4 py-3">Service Need & Score</th>
                  <th className="px-4 py-3">Detected Pain Points</th>
                  <th className="px-4 py-3">Outreach Status</th>
                  <th className="px-4 py-3">Sent Timestamp</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredVerifiedLeads.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-500 italic">
                      No verified leads matching filters found in Sheet 2.
                    </td>
                  </tr>
                ) : (
                  filteredVerifiedLeads.map((row) => {
                    const isSelected = selectedVerifiedEmails.has(row.decision_maker_email);
                    return (
                      <tr 
                        key={row.row_index} 
                        className={`transition-colors ${isSelected ? 'bg-indigo-50/70 dark:bg-primary-500/10' : 'hover:bg-slate-50/70 dark:hover:bg-white/[0.02]'}`}
                      >
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => toggleSelectVerified(row.decision_maker_email)}
                            className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                          >
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-indigo-600 dark:text-primary-400" />
                            ) : (
                              <Square className="h-4 w-4 text-slate-400 dark:text-slate-600" />
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-3 font-mono text-slate-400 font-bold">{row.row_index}</td>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            {row.domain}
                            <a
                              href={`https://${row.domain}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                          {row.phone_number && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 font-normal">
                              <Phone className="h-2.5 w-2.5" /> {row.phone_number}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-emerald-700 dark:text-emerald-300 font-bold">
                          {row.decision_maker_email}
                        </td>
                        <td className="px-4 py-3">
                          {getServiceBadge(row.top_service_need, row.need_score)}
                        </td>
                        <td className="px-4 py-3 max-w-sm">
                          {renderPainPoints(row.pain_points)}
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(row.outreach_status)}</td>
                        <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400 text-[11px]">{row.sent_timestamp || '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2 justify-end">
                            {row.outreach_status === 'READY' && (
                              <button
                                onClick={() => openApprovalModal(row)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-primary-600/20 dark:hover:bg-primary-600/30 dark:text-primary-300 dark:border-primary-500/30 text-xs font-bold transition-all shadow-sm"
                              >
                                <Sparkles className="h-3 w-3" /> Preview
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteSingleVerified(row.decision_maker_email, row.domain)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/20 transition-all"
                              title="Delete from Google Sheets"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Table for Sheet 1: Raw Scraped Domains */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-surface-200/90 text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-white/5 font-bold">
                <tr>
                  <th className="px-3 py-3 w-10 text-center">
                    <button 
                      onClick={toggleSelectAll} 
                      className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                      title="Select / Deselect All"
                    >
                      {isAllSelected ? (
                        <CheckSquare className="h-4 w-4 text-indigo-600 dark:text-primary-400" />
                      ) : (
                        <Square className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-3">#</th>
                  <th className="px-4 py-3">Domain & Company</th>
                  <th className="px-4 py-3">Scraped Executive Emails</th>
                  <th className="px-4 py-3">AI Service Match</th>
                  <th className="px-4 py-3">Identified Pain Points</th>
                  <th className="px-4 py-3">Scrape Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredRawLeads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-500 italic">
                      No raw domains matching filters found in Sheet 1.
                    </td>
                  </tr>
                ) : (
                  filteredRawLeads.map((row) => {
                    const isSelected = selectedRawDomains.has(row.domain);
                    return (
                      <tr 
                        key={row.row_index} 
                        className={`transition-colors ${isSelected ? 'bg-indigo-50/70 dark:bg-primary-500/10' : 'hover:bg-slate-50/70 dark:hover:bg-white/[0.02]'}`}
                      >
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => toggleSelectRaw(row.domain)}
                            className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                          >
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-indigo-600 dark:text-primary-400" />
                            ) : (
                              <Square className="h-4 w-4 text-slate-400 dark:text-slate-600" />
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-3 font-mono text-slate-400 font-bold">{row.row_index}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-slate-900 dark:text-white font-bold">
                            {row.domain}
                            <a
                              href={`https://${row.domain}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-normal">{row.company_name}</span>
                          {row.phone_number && (
                            <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Phone className="h-2.5 w-2.5" /> {row.phone_number}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-cyan-700 dark:text-cyan-300 max-w-xs font-semibold">
                          {row.raw_email ? (
                            <div className="flex flex-wrap gap-1">
                              {row.raw_email.split(',').map((email, idx) => (
                                <span
                                  key={idx}
                                  className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                                    idx === 0
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20 font-bold'
                                      : 'bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/20'
                                  }`}
                                >
                                  {email.trim()}
                                </span>
                              ))}
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {getServiceBadge(row.top_service_need, row.need_score)}
                        </td>
                        <td className="px-4 py-3 max-w-sm">
                          {renderPainPoints(row.pain_points)}
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(row.scrape_status)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeleteSingleRaw(row.domain)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/20 transition-all"
                            title="Delete from Google Sheets"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Email Approval Modal */}
      <EmailApprovalModal
        lead={approvalModalLead}
        isOpen={isApprovalModalOpen}
        onClose={() => {
          setIsApprovalModalOpen(false);
          setApprovalModalLead(null);
        }}
        onSuccess={loadData}
      />
    </div>
  );
}
