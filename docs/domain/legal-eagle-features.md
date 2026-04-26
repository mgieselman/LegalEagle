# Legal Eagle — Feature Inventory

> **Source of truth** for the LegalEagle feature roadmap (MVP scope + post-MVP backlog). For detailed feature comparisons against Jubilee Pro and Glade.ai see [competitive-matrix.md](../dev/competitive-matrix.md).

## Summary

Legal Eagle is a security-first, white-label SaaS practice management platform for bankruptcy law firms, with Symmes Law Firm as Customer Zero. The product replaces the fragmented stack most firms run today (intake forms + petition software + calendaring + credit pulls + PACER + eFiling + billing) with a single AI-augmented system, and competes directly against Glade.ai on two clear gaps: SOC 2 certification and a no-train-on-client-data policy.

The MVP scope below covers the end-to-end consumer bankruptcy workflow (intake → petition prep → court-compliant filing output → billing) for Chapter 7 and Chapter 13. Post-MVP work expands the AI surface area, automates eFiling submission, opens additional practice areas, and layers on premium upsell modules.

---

## MVP

### Platform foundation
- Multi-tenant SaaS with firm-level data isolation
- White-label subdomains per firm (e.g. `legal.symmeslaw.com`) with firm-specific branding, logo, and colors
- Role-based access control (attorney, paralegal, admin, client)
- SOC 2 Type I controls in place from day one (Type II observation window started)
- AES-256 at rest, TLS 1.3 in transit
- Public trust page and explicit "no training on client data" policy

### Client intake
- Branded intake portal (mobile + desktop)
- Document upload from client devices
- eSignature integration (DocuSign / HelloSign API)
- Conflict check
- Custom intake questionnaires per case type

### Case management
- Case dashboard with status tracking
- Calendaring with court deadline integration
- Task management

### Document handling & AI flagging
- OCR / document extraction pipeline (Google Document AI or AWS Textract)
- LLM-assisted parsing (Claude Sonnet) into normalized JSON schema
- Three-stage flagging pipeline: extraction → analysis → red/yellow/informational flags
- Deterministic rules engine for statutory red flags (insider transfers, preference payments, luxury-goods presumption, large pre-filing withdrawals)
- Confidence-gated extraction with checksum reconciliation, dual-pass verification, schema validation, and source linking back to the original document
- Reject / comment workflow on uploaded docs

### Petition preparation (core differentiator — built natively)
- Auto-populated Chapter 7 and Chapter 13 forms from intake data
- Means test calculator with AI-assisted analysis
- Income / expense categorization
- Bank statement parsing
- Creditor matrix generation and formatting
- Final court-compliant PDF generation

### Credit & financial
- Tri-bureau credit report pulls via reseller (CRS Credit API, iSoftpull, or Soft Pull Solutions — not direct bureau credentialing)
- Bank statement analysis to populate Schedule AB
- Federal IRS and local standards baked into means test

### Filing & court integration
- PACER data integration via third-party provider (BankruptcyWatch recommended)
- CM/ECF eFiling support via **Case Upload** format — generate court-compliant PDFs and creditor matrix files for attorney upload to CM/ECF (full automated submission deferred)

### Billing
- Flat-fee and hourly tracking
- Trust / IOLTA account management
- Payment processing

### Onboarding & support
- Data migration from existing platforms
- 90-day try-before-you-buy trial
- Scheduled training sessions in the first 30 days
- Tiered support: chatbot + online ($49/mo) → priority online ($99/mo) → 24/7 live phone with a competent human ($199/mo)

---

## After MVP

### Compliance & trust
- SOC 2 Type II certification completed (continued audit cycle)

### Expanded AI document flagging
- Insider transfer detection across full lookback windows
- Preference payment analysis with statutory threshold tracking
- Large / unusual bank account charge anomaly detection
- ML anomaly detection layer (isolation forest / autoencoder) trained on per-client transaction history
- Behavior shift / change-point detection on time-series financial data
- Contextual LLM flags reading memo fields and cross-referencing across documents

### Automated eFiling
- Full automated CM/ECF submission via XML Case Opening (NextGen courts) — replaces the manual upload step from MVP
- Court calendar auto-sync (trustee assignments, courtrooms, judges)
- Court notice tracking with automations triggered by notice type
- Hearing management from a single calendar

### Deeper bankruptcy AI
- AI Schedules Builder — full schedule autofill from all collected data sources
- Exemption AI Agent — identifies and applies state-specific exemptions with statute citations
- AI Income Extraction from paystubs and non-employment income sources
- AI Document Rename — automatic file naming with proper titles
- AI Document Review — completeness and accuracy review on uploads
- Document expiry tracking with auto-task creation
- Fillable PDF → web questionnaire conversion (PDF Fill)
- Real-time collaborative questionnaire editing between staff and clients

### Client communication
- Branded, embeddable client portal (deeper than the MVP intake portal)
- AI chatbot for client-facing 24/7 support with escalation
- SMS messaging integration
- AI follow-ups in the firm's customized tone of voice
- Centralized communication log per case (calls, emails, texts, portal messages)

### Practice management depth
- Custom motion templates auto-generated with dynamic case data
- Document automation beyond government forms (custom contracts, letters)
- Open API and integrations marketplace (Zapier, Clio, LawPay, Slack, QuickBooks)
- Email integration (Gmail / Outlook sync)
- Native calendar sync (Google Calendar / Outlook)
- Firm analytics dashboard — case pipeline, revenue forecasting, staff productivity
- Attorney mobile app (native iOS / Android)

### Tiered upsell modules
- Advanced AI analysis tier (~$39/mo)
- SEO monitoring and online reputation alerts
- HR module (~$99/mo)

### Additional practice areas
- Chapter 11 / Subchapter V
- Immigration (USCIS / DOS / DOL filing)
- Family law
- Personal injury (with medical chronologies AI agent)
- Estate planning

### Enterprise
- Multi-office support
- Enterprise admin features
