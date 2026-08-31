'use client';

import React, { useEffect, useState } from 'react';
import { fetchApiKeys, injectApiKey, activateKey } from '@/lib/api';
import { ApiKeyItem } from '@/lib/types';
import { 
  KeyRound, 
  PlusCircle, 
  RotateCw, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  Zap,
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
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-purple-600 dark:text-purple-400" /> API Keys & Rotation Pool
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Managed directly in Google Sheets (Sheet 3: <code className="text-purple-600 dark:text-purple-300 font-bold">API_Keys_Pool</code>). Auto-rotates on HTTP 402/429.
          </p>
        </div>

        <button
          onClick={loadKeys}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-surface-100/80 dark:hover:bg-surface-50 border border-slate-200 dark:border-white/5 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all self-start md:self-auto shadow-sm"
        >
          <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Keys
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between animate-fade-in shadow-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300'
              : 'bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
            &times;
          </button>
        </div>
      )}

      {/* Main Grid: Key Pool Cards & Injection Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Key Pool List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-600 dark:text-primary-400" /> Active Keys in Rotation ({keys.length})
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {keys.filter(k => k.status === 'ACTIVE').length} Active / {keys.filter(k => k.status === 'EXHAUSTED').length} Exhausted
            </span>
          </div>

          {loading ? (
            <div className="p-12 rounded-2xl border border-slate-200 dark:border-white/5 text-center text-slate-500 text-xs bg-white dark:bg-slate-900 shadow-sm">
              Loading API keys from Sheet 3...
            </div>
          ) : keys.length === 0 ? (
            <div className="p-12 rounded-2xl border border-slate-200 dark:border-white/5 text-center text-slate-500 text-xs italic bg-white dark:bg-slate-900 shadow-sm">
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
                    className={`p-4 rounded-2xl border transition-all shadow-sm bg-white dark:bg-slate-900 ${
                      isExhausted
                        ? 'border-rose-300 bg-rose-50/50 dark:border-rose-500/30 dark:bg-rose-950/10'
                        : 'border-slate-200 hover:border-purple-300 dark:border-white/5 dark:hover:border-purple-500/30'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-white">
                            {k.provider}
                          </span>
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/30">
                            {k.key_type}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isExhausted
                                ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30'
                            }`}
                          >
                            {k.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <span>Account:</span> <span className="text-slate-800 dark:text-slate-300 font-mono font-medium">{k.email_account}</span>
                        </p>
                      </div>

                      {/* Calls Counter & Actions */}
                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        <div className="text-right">
                          <div className="text-xs font-mono font-bold text-slate-900 dark:text-white">{k.calls_made} calls</div>
                          <div className="text-[10px] text-slate-500">recorded</div>
                        </div>

                        {isExhausted ? (
                          <button
                            onClick={() => handleReactivate(k.row_index)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1"
                          >
                            <RotateCw className="h-3 w-3" /> Reactivate & Resume
                          </button>
                        ) : (
                          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" title="Key is healthy and active">
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Masked Key Display */}
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 select-none">API Key:</span>
                        <span className="text-slate-800 dark:text-slate-300 font-semibold">
                          {isVisible
                            ? k.api_key
                            : k.api_key
                            ? `${k.api_key.substring(0, 6)}••••••••••••••••${k.api_key.substring(k.api_key.length - 4)}`
                            : '—'}
                        </span>
                      </div>
                      <button
                        onClick={() => toggleShowKey(k.row_index)}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded transition-colors"
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
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-white/5 space-y-4 h-fit bg-white dark:bg-slate-900 shadow-sm transition-colors">
          <div className="border-b border-slate-100 dark:border-white/5 pb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PlusCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Key Injection Form
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Add new credentials to Google Sheet pool and resume paused engine
            </p>
          </div>

          <form onSubmit={handleInjectKey} className="space-y-4 text-xs">
            {/* Provider Dropdown */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">API Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full bg-white dark:bg-surface-200 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-medium shadow-sm"
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
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">Account Email</label>
              <input
                type="email"
                required
                value={emailAccount}
                onChange={(e) => setEmailAccount(e.target.value)}
                placeholder="e.g. outreach@domain.com"
                className="w-full bg-white dark:bg-surface-200 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-sm"
              />
            </div>

            {/* API Key */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">API Key / Secret Token</label>
              <input
                type="text"
                required
                value={apiKeyVal}
                onChange={(e) => setApiKeyVal(e.target.value)}
                placeholder="Paste API Key token here"
                className="w-full bg-white dark:bg-surface-200 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-sm"
              />
            </div>

            {/* Key Type: FREE vs PAID Toggle */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">Key Tier / Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setKeyType('FREE')}
                  className={`py-2 rounded-xl text-center font-bold transition-all shadow-sm ${
                    keyType === 'FREE'
                      ? 'bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-600/20 dark:text-purple-300 dark:border-purple-500/40'
                      : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 dark:bg-surface-200 dark:text-slate-400 dark:border-transparent'
                  }`}
                >
                  FREE Tier
                </button>
                <button
                  type="button"
                  onClick={() => setKeyType('PAID')}
                  className={`py-2 rounded-xl text-center font-bold transition-all shadow-sm ${
                    keyType === 'PAID'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-600/20 dark:text-emerald-300 dark:border-emerald-500/40'
                      : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 dark:bg-surface-200 dark:text-slate-400 dark:border-transparent'
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
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 hover:from-indigo-500 hover:to-violet-600 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Zap className="h-4 w-4" />
              {submitting ? 'Injecting...' : 'Activate Key & Resume Pipeline'}
            </button>
          </form>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-100/40 border border-slate-200 dark:border-white/5 text-[11px] text-slate-600 dark:text-slate-400">
            <span className="text-slate-800 dark:text-slate-300 font-bold">Zero-SQL Guarantee:</span> Injected keys are immediately written to Sheet 3 in Google Sheets and cached in memory.
          </div>
        </div>
      </div>
    </div>
  );
}
