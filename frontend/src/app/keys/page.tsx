'use client';

import React, { useEffect, useState } from 'react';
import { fetchApiKeys, injectApiKey, activateKey } from '@/lib/api';
import { ApiKeyItem } from '@/lib/types';
import { 
  KeyRound, 
  PlusCircle, 
  RotateCw, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Zap,
  Activity,
  Layers
} from 'lucide-react';

const PROVIDERS = [
  { id: 'hunter', name: 'Hunter.io', desc: 'Domain search for founder/CEO emails' },
  { id: 'tomba', name: 'Tomba.io', desc: 'B2B executive email discovery fallback' },
  { id: 'apilayer', name: 'APILayer Mailboxlayer', desc: 'Real-time deliverability & SMTP verifier' },
  { id: 'brevo', name: 'Brevo (Sendinblue)', desc: 'Transactional AI email dispatching' },
  { id: 'domainsdb', name: 'DomainsDB.info', desc: 'Niche e-commerce domain discovery' },
];

export default function KeyManagerPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showKeyMap, setShowKeyMap] = useState<Record<number, boolean>>({});
  
  // Injection Form State
  const [provider, setProvider] = useState('hunter');
  const [emailAccount, setEmailAccount] = useState('');
  const [apiKeyVal, setApiKeyVal] = useState('');
  const [keyType, setKeyType] = useState<'FREE' | 'PAID'>('FREE');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadKeys = async () => {
    try {
      setLoading(true);
      const res = await fetchApiKeys();
      setKeys(res.keys || []);
    } catch (e) {
      console.error('Error loading keys:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const handleInjectKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyVal.trim() || !emailAccount.trim()) {
      setFeedback({ type: 'error', message: 'Please enter account email and API key.' });
      return;
    }

    try {
      setSubmitting(true);
      setFeedback(null);
      await injectApiKey({
        provider,
        email_account: emailAccount,
        api_key: apiKeyVal,
        key_type: keyType,
        auto_resume: true
      });
      setFeedback({ type: 'success', message: `API Key for ${provider.toUpperCase()} injected & activated. Pipeline resumed!` });
      setEmailAccount('');
      setApiKeyVal('');
      loadKeys();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to inject API key.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReactivate = async (rowIndex: number) => {
    try {
      await activateKey(rowIndex, true);
      loadKeys();
      setFeedback({ type: 'success', message: 'Key reactivated & pipeline resumed!' });
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message || 'Failed to reactivate key.' });
    }
  };

  const toggleShowKey = (rowIdx: number) => {
    setShowKeyMap(prev => ({ ...prev, [rowIdx]: !prev[rowIdx] }));
  };

  return (
    <div className="flex-1 p-6 space-y-6 max-w-7xl w-full mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-purple-400" /> API Keys & Rotation Pool
          </h1>
          <p className="text-xs text-slate-400">
            Managed directly in Google Sheets (Sheet 3: <code className="text-purple-300">API_Keys_Pool</code>). Auto-rotates on HTTP 402/429.
          </p>
        </div>

        <button
          onClick={loadKeys}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-100/80 hover:bg-surface-50 border border-white/5 text-xs text-slate-300 transition-all self-start md:self-auto"
        >
          <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Keys
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between animate-fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
            &times;
          </button>
        </div>
      )}

      {/* Main Grid: Key Pool Cards & Injection Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Key Pool List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary-400" /> Active Keys in Rotation ({keys.length})
            </h2>
            <span className="text-xs text-slate-400">
              {keys.filter(k => k.status === 'ACTIVE').length} Active / {keys.filter(k => k.status === 'EXHAUSTED').length} Exhausted
            </span>
          </div>

          {loading ? (
            <div className="glass-card p-12 rounded-2xl border border-white/5 text-center text-slate-500 text-xs">
              Loading API keys from Sheet 3...
            </div>
          ) : keys.length === 0 ? (
            <div className="glass-card p-12 rounded-2xl border border-white/5 text-center text-slate-500 text-xs italic">
              No API keys found in Sheet 3. Use the form on the right to inject your first key.
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map((k) => {
                const isExhausted = k.status === 'EXHAUSTED';
                const isVisible = showKeyMap[k.row_index];

                return (
                  <div
                    key={k.row_index}
                    className={`glass-card p-4 rounded-2xl border transition-all ${
                      isExhausted ? 'border-rose-500/30 bg-rose-950/10' : 'border-white/5 hover:border-purple-500/30'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold uppercase tracking-wide text-white">
                            {k.provider}
                          </span>
                          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30">
                            {k.key_type}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isExhausted
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {k.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <span>Account:</span> <span className="text-slate-300 font-mono">{k.email_account}</span>
                        </p>
                      </div>

                      {/* Calls Counter & Actions */}
                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        <div className="text-right">
                          <div className="text-xs font-mono font-bold text-white">{k.calls_made} calls</div>
                          <div className="text-[10px] text-slate-500">recorded</div>
                        </div>

                        {isExhausted ? (
                          <button
                            onClick={() => handleReactivate(k.row_index)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-glow-emerald transition-all flex items-center gap-1"
                          >
                            <RotateCw className="h-3 w-3" /> Reactivate & Resume
                          </button>
                        ) : (
                          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400" title="Key is healthy and active">
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Masked Key Display */}
                    <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400 font-mono">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 select-none">API Key:</span>
                        <span className="text-slate-300">
                          {isVisible
                            ? k.api_key
                            : k.api_key
                            ? `${k.api_key.substring(0, 6)}••••••••••••••••${k.api_key.substring(k.api_key.length - 4)}`
                            : '—'}
                        </span>
                      </div>
                      <button
                        onClick={() => toggleShowKey(k.row_index)}
                        className="text-slate-400 hover:text-white p-1 rounded transition-colors"
                        title={isVisible ? 'Hide Key' : 'Show Key'}
                      >
                        {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5 text-slate-500" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Col: Key Injection Form */}
        <div className="glass-card p-5 rounded-2xl border border-white/5 space-y-4 h-fit">
          <div className="border-b border-white/5 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <PlusCircle className="h-4 w-4 text-emerald-400" /> Key Injection Form
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Add new credentials to Google Sheet pool and resume paused engine
            </p>
          </div>

          <form onSubmit={handleInjectKey} className="space-y-4 text-xs">
            {/* Provider Dropdown */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">API Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full bg-surface-200 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-primary-500"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Email Account */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">Account Email</label>
              <input
                type="email"
                required
                value={emailAccount}
                onChange={(e) => setEmailAccount(e.target.value)}
                placeholder="e.g. outreach@domain.com"
                className="w-full bg-surface-200 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-primary-500"
              />
            </div>

            {/* API Key */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">API Key / Secret Token</label>
              <input
                type="text"
                required
                value={apiKeyVal}
                onChange={(e) => setApiKeyVal(e.target.value)}
                placeholder="Paste API Key token here"
                className="w-full bg-surface-200 border border-white/10 rounded-xl px-3 py-2 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-primary-500"
              />
            </div>

            {/* Key Type: FREE vs PAID Toggle */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">Key Tier / Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setKeyType('FREE')}
                  className={`py-2 rounded-xl text-center font-semibold transition-all ${
                    keyType === 'FREE'
                      ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40'
                      : 'bg-surface-200 text-slate-400 border border-transparent'
                  }`}
                >
                  FREE Tier
                </button>
                <button
                  type="button"
                  onClick={() => setKeyType('PAID')}
                  className={`py-2 rounded-xl text-center font-semibold transition-all ${
                    keyType === 'PAID'
                      ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-surface-200 text-slate-400 border border-transparent'
                  }`}
                >
                  PAID Tier
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-primary-600 via-primary-500 to-accent-violet hover:from-primary-500 hover:to-accent-violet text-white font-bold text-xs shadow-glow-primary transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Zap className="h-4 w-4" />
              {submitting ? 'Injecting...' : 'Activate Key & Resume Pipeline'}
            </button>
          </form>

          <div className="p-3 rounded-xl bg-surface-100/40 border border-white/5 text-[11px] text-slate-400">
            <span className="text-slate-300 font-semibold">Zero-SQL Guarantee:</span> Injected keys are immediately written to Sheet 3 in Google Sheets and cached in memory.
          </div>
        </div>
      </div>
    </div>
  );
}
