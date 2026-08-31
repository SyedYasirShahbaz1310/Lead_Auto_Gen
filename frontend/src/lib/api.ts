export const API_BASE = typeof window !== 'undefined'
  ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000')
      : (process.env.NEXT_PUBLIC_BACKEND_URL || ''))
  : (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000');

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/api/stats`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function fetchRawLeads(status?: string) {
  const url = status ? `${API_BASE}/api/leads/raw?status=${status}` : `${API_BASE}/api/leads/raw`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch raw leads');
  return res.json();
}

export async function fetchVerifiedLeads(status?: string) {
  const url = status ? `${API_BASE}/api/leads/verified?status=${status}` : `${API_BASE}/api/leads/verified`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch verified leads');
  return res.json();
}

export async function fetchExportData() {
  const res = await fetch(`${API_BASE}/api/leads/export`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch export data');
  return res.json();
}

export async function fetchApiKeys(provider?: string) {
  const url = provider ? `${API_BASE}/api/keys?provider=${provider}` : `${API_BASE}/api/keys`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch API keys');
  return res.json();
}

export async function injectApiKey(payload: {
  provider: string;
  email_account: string;
  api_key: string;
  key_type: string;
  auto_resume?: boolean;
}) {
  const res = await fetch(`${API_BASE}/api/keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to inject key');
  return res.json();
}

export async function activateKey(rowIndex: number, resumePipeline: boolean = true) {
  const res = await fetch(`${API_BASE}/api/keys/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ row_index: rowIndex, resume_pipeline: resumePipeline })
  });
  if (!res.ok) throw new Error('Failed to activate key');
  return res.json();
}

export async function startPipeline() {
  const res = await fetch(`${API_BASE}/api/pipeline/start`, { method: 'POST' });
  return res.json();
}

export async function pausePipeline() {
  const res = await fetch(`${API_BASE}/api/pipeline/pause`, { method: 'POST' });
  return res.json();
}

export async function resumePipeline() {
  const res = await fetch(`${API_BASE}/api/pipeline/resume`, { method: 'POST' });
  return res.json();
}

export async function stopPipeline() {
  const res = await fetch(`${API_BASE}/api/pipeline/stop`, { method: 'POST' });
  return res.json();
}

export async function triggerMiner(keyword?: string, limit: number = 20) {
  const res = await fetch(`${API_BASE}/api/pipeline/mine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword, limit })
  });
  return res.json();
}

export async function triggerScraper(batchSize: number = 10) {
  const res = await fetch(`${API_BASE}/api/pipeline/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batch_size: batchSize })
  });
  return res.json();
}

export async function triggerVerifier(batchSize: number = 10) {
  const res = await fetch(`${API_BASE}/api/pipeline/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batch_size: batchSize })
  });
  return res.json();
}

export async function triggerDispatcher(maxItems: number = 5, fastMode: boolean = false) {
  const res = await fetch(`${API_BASE}/api/pipeline/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ max_items: maxItems, fast_mode: fastMode })
  });
  return res.json();
}

export async function uploadDomainFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/api/leads/upload`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to upload domain file' }));
    throw new Error(err.detail || 'Upload failed');
  }
  return res.json();
}

export async function previewColdEmail(payload: {
  domain: string;
  email: string;
  company_name?: string;
}) {
  const res = await fetch(`${API_BASE}/api/pipeline/preview-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to generate email preview');
  return res.json();
}

export async function dispatchApprovedEmail(payload: {
  row_index: number;
  domain: string;
  email: string;
  subject: string;
  body: string;
}) {
  const res = await fetch(`${API_BASE}/api/pipeline/dispatch/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to dispatch approved email');
  return res.json();
}

export async function deleteRawLeads(domains: string[]) {
  const res = await fetch(`${API_BASE}/api/leads/raw`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domains })
  });
  if (!res.ok) throw new Error('Failed to delete raw leads');
  return res.json();
}

export async function deleteVerifiedLeads(emails: string[], domains?: string[]) {
  const res = await fetch(`${API_BASE}/api/leads/verified`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emails, domains })
  });
  if (!res.ok) throw new Error('Failed to delete verified leads');
  return res.json();
}

