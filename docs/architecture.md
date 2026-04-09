# LegalEagle Architecture

## Overview
LegalEagle is a multi-tenant web app for law firms handling consumer bankruptcy. It digitizes client intake (questionnaire + document upload), performs AI-powered fraud/inconsistency review, automates the means test, and generates official bankruptcy petition forms.

## Tech Stack
- **Client**: React 19 + Vite, Tailwind CSS, shadcn/ui components, React Router
- **Server**: Express 5 + TypeScript
- **ORM**: Drizzle ORM (schema-as-code, supports SQLite dev / PostgreSQL prod)
- **Database**: SQLite (local dev), PostgreSQL (production) — extracted data stored as JSONB
- **Blob Storage**: Azure Blob Storage (via `IBlobStorage` interface) for original files and generated PDFs
- **AI**: Claude API (Anthropic SDK, claude-sonnet-4-20250514)
- **Auth**: Interface-driven (`IAuthProvider`) — dev stub now, real provider later
- **Deployment**: Azure App Service (B1 tier), GitHub Actions CI/CD

## Multi-Tenant Data Model
```
law_firms → users (paralegal/attorney/admin) → clients → cases → documents
                                                  ↑                    ↓
                                            clients auth          extraction_results (JSONB)
                                            separately            validation_results
```

## Roles & Auth

Two distinct user populations with separate auth flows:

| Role | Table | Auth Method | Access |
|------|-------|-------------|--------|
| client | `clients` | Magic link or simple password | Own case(s) only — questionnaire, document upload, status |
| paralegal | `users` | Email + password (SSO later) | Assigned clients — intake, doc review, extraction review |
| attorney | `users` | Email + password (SSO later) | All clients in firm — review, sign-off, means test params |
| admin | `users` | Email + password (SSO later) | Full firm access — user mgmt, settings, reference data |

Auth is enforced via middleware that attaches `req.user` (with `userId`, `lawFirmId`, `role`) to every request. All queries are tenant-scoped by `lawFirmId`.

## Page Structure

### Client Pages
| Route | Purpose |
|-------|---------|
| `/login` | Client login (magic link or password) |
| `/client/dashboard` | My cases, document upload status, what's still needed |
| `/client/case/:id` | Questionnaire + document upload for a specific case |

### Staff Pages
| Route | Purpose |
|-------|---------|
| `/staff/login` | Staff login (email + password) |
| `/staff/dashboard` | Client list, review queue, cases needing attention |
| `/staff/case/:id` | Full case view — questionnaire, documents, review, means test |
| `/staff/case/:id/review` | Document review interface (side-by-side original + extracted data) |
| `/admin/settings` | Firm settings, user management, reference data |

## Key Patterns
- `import './env'` in server index.ts loads dotenv before other imports
- Anthropic client is lazy-initialized (env vars not available at import time)
- Express 5 uses `/{*splat}` for catch-all routes
- Client build skips `tsc` (just `vite build`)
- All external dependencies behind interfaces (storage, auth, AI, OCR, queues)
- Drizzle schema is source of truth — `drizzle-kit push` syncs DB (wipe + reseed until real data exists)

## Planned Features
- Means test automation (Form 122A / 122C) from paystub uploads
- Schedule I auto-population from parsed income data
- Full petition generation from questionnaire + extracted document data
- Document processing pipeline (classify, extract, validate, review)
- Cross-document validation and fraud detection
