---
title: LenGen AI Backend
emoji: ⚡
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# LenGen AI — Autonomous Zero-SQL Lead Generation, Verification & Cold Outreach Engine

An enterprise-grade, production-ready lead generation and automated outreach engine built with **Next.js 14 App Router** (TypeScript, Tailwind CSS, Lucide Icons), **Python FastAPI** async processing workers, and **Google Sheets** as the primary, zero-SQL database.

---

## Architecture Overview

```
                               ┌──────────────────────────────────────────────┐
                               │  Google Sheets Primary Database (gspread)     │
                               │  - Sheet 1: Raw_Scraped_Domains              │
                               │  - Sheet 2: Verified_Outreach_Queue          │
                               │  - Sheet 3: API_Keys_Pool                    │
                               └──────────────┬───────────────────────────────┘
                                              │
                   ▲                          │ gspread async engine
                   │                          ▼
┌──────────────────┴────────┐      ┌──────────────────────────────────────────┐
│ Next.js 14 Dashboard      │      │ FastAPI Autonomous Background Engine     │
│ - Live KPI Telemetry      │◄════►│ - Stage 1: DomainsDB Miner (Niche e-com) │
│ - Leads Explorer (CSV/XLS)│  WS  │ - Stage 2: BS4 + Hunter/Tomba Fallback   │
│ - Key Pool & Injection    │ REST │ - Stage 3: DNS MX + APILayer Verifier    │
│ - Live Event Terminal     │      │ - Stage 4: Gemini AI + Brevo Dispatcher  │
└───────────────────────────┘      └──────────────────────────────────────────┘
```

---

## 4-Stage Autonomous Pipeline

1. **Stage 1 (`miner_service.py`)**:
   - Queries DomainsDB.info API for niche e-commerce domains.
   - Appends newly discovered domains to Sheet 1 (`Raw_Scraped_Domains`) with status `PENDING`.
2. **Stage 2 (`scraper_service.py`)**:
   - Crawls domain homepage, contact, and about pages with BeautifulSoup.
   - Falls back to Hunter.io and Tomba.io API using active key pool for founder/CEO emails.
   - Updates Sheet 1 status to `DONE` or `REJECTED`.
3. **Stage 3 (`verifier_service.py`)**:
   - Performs local DNS MX record check via `dnspython`.
   - Validates deliverability via APILayer Mailboxlayer API.
   - If deliverability score is >90% (0.90), pushes lead to Sheet 2 (`Verified_Outreach_Queue`) with status `READY`.
4. **Stage 4 (`dispatcher_service.py`)**:
   - Fetches `READY` leads from Sheet 2.
   - Google Gemini API (`google-generativeai`) crafts a customized, hyper-personalized 100-word cold outreach email based on company name and domain.
   - Dispatches transactional email via Brevo REST API using configured sender identity.
   - Enforces programmatic random delay (120-180 seconds, or fast demo mode).
   - Updates Sheet 2 status to `SENT` with timestamp.

---

## Intelligent Key Rotation & Auto-Pause

- When any external API returns HTTP 402 or 429:
  1. That key's status in Sheet 3 (`API_Keys_Pool`) is updated to `EXHAUSTED`.
  2. The service rotates to the next available `ACTIVE` key for that provider.
  3. If all keys for a provider are exhausted, the global engine state transitions to `PAUSED` and broadcasts a WebSocket notification (`Provider [Name] Quota Exceeded. Pipeline Paused.`).
  4. Operators can inject a new key or reactivate exhausted keys in the `/keys` UI, automatically resuming the pipeline.

---

## Quick Start Guide

### 1. Launch All (Backend + Frontend)
Double-click `start_all.bat` or run:
```bash
start_all.bat
```

### 2. Manual Startup

**Backend**:
```bash
cd backend
.venv\Scripts\activate
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend**:
```bash
cd frontend
npm run dev
```

- **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Backend API & Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **WebSocket Feed**: `ws://localhost:8000/ws/pipeline`
