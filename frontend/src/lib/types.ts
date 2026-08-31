export type EngineState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED';

export interface DashboardStats {
  state: EngineState;
  pause_reason?: string | null;
  total_mined: number;
  emails_scraped: number;
  pending_scraping: number;
  verified_leads: number;
  ready_outreach: number;
  emails_dispatched: number;
  total_keys: number;
  active_keys: number;
  exhausted_keys: number;
}

export interface RawLead {
  row_index: number;
  domain: string;
  company_name: string;
  raw_email: string;
  phone_number: string;
  top_service_need?: string;
  need_score?: number;
  pain_points?: string;
  scrape_status: 'PENDING' | 'DONE' | 'REJECTED';
  scraped_date: string;
}

export interface VerifiedLead {
  row_index: number;
  domain: string;
  decision_maker_email: string;
  phone_number: string;
  verification_score: number | string;
  top_service_need?: string;
  need_score?: number;
  pain_points?: string;
  outreach_status: 'READY' | 'SENT' | 'BOUNCED';
  sent_timestamp: string;
}

export interface ApiKeyItem {
  row_index: number;
  provider: 'hunter' | 'tomba' | 'apilayer' | 'brevo' | 'domainsdb' | string;
  email_account: string;
  api_key: string;
  key_type: 'FREE' | 'PAID';
  status: 'ACTIVE' | 'EXHAUSTED';
  calls_made: number;
}

export interface LogEvent {
  type: string;
  stage?: string;
  provider?: string;
  message: string;
  status: 'info' | 'success' | 'warning' | 'error';
  timestamp?: string;
}
