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

### Client Pages (TurboTax-style 3-zone layout)
| Route | Purpose |
|-------|---------|
| `/client-login` | Client login |
| `/client/dashboard` | My cases, what's still needed |
| `/client/case/:id/personal` | Step 1: Name & Residence, Prior Bankruptcy |
| `/client/case/:id/documents` | Step 2: Upload/manage documents, process, autofill |
| `/client/case/:id/income-employment` | Step 3: Occupation, Business, Financial, Taxes |
| `/client/case/:id/debts` | Step 4: Debts, Suits, Garnishment, Cosigners, etc. |
| `/client/case/:id/assets` | Step 5: Property, Gifts, Losses, Vehicles, etc. |
| `/client/case/:id/review` | Step 6: Completion summary + sign-off |

### Staff Pages (TurboTax-style 3-zone layout)
| Route | Purpose |
|-------|---------|
| `/login` | Staff login (email + password) |
| `/staff/dashboard` | Case list, review queue, cases needing attention |
| `/staff/case/:id/intake` | Step 1: Case details + full questionnaire |
| `/staff/case/:id/documents` | Step 2: Document management |
| `/staff/case/:id/extraction` | Step 3: Per-document extraction review |
| `/staff/case/:id/means-test` | Step 4: Means test calculation |
| `/staff/case/:id/review` | Step 5: AI review + manual checklist |
| `/staff/case/:id/petition` | Step 6: Generated petition forms |
| `/staff/case/:id/filing` | Step 7: Filing status + court info |
| `/admin/settings` | Firm settings, user management, reference data |

## API Access Control

Auth middleware (`createAuthMiddleware`) is applied to all `/api/*` routes. Per-route authorization is enforced as follows:

### Document endpoints (`/api/documents`)
| Endpoint | Client | Staff | Notes |
|----------|--------|-------|-------|
| `POST /upload` | Own cases | All | `verifyCaseAccess` checks client owns the case |
| `GET /` (list) | Own cases | All | Filtered by `caseId` query param |
| `GET /:id/download` | Own cases | All | |
| `DELETE /:id` | Own cases | All | Soft-delete only |
| `POST /:id/process` | Own cases | All | Runs classification + extraction pipeline |
| `GET /:id/extraction` | No | All | `requireStaff` — extraction review is staff-only |
| `POST /:id/extraction/accept` | No | All | `requireStaff` |
| `POST /:id/extraction/correct` | No | All | `requireStaff` |
| `GET /:id/validations` | No | All | `requireStaff` |
| `POST /:id/validations/:vid/dismiss` | No | All | `requireStaff` |

### Case endpoints (`/api/cases`)
| Endpoint | Client | Staff | Notes |
|----------|--------|-------|-------|
| `GET /` (list) | No | All | `requireStaff` — clients use `/api/client-portal/cases` |
| `GET /:id` | No | All | `requireStaff` — clients use `/api/client-portal/cases/:id` |
| `POST /` (create) | No | All | `requireStaff` |
| `PUT /:id` (update) | No | All | `requireStaff` |
| `DELETE /:id` | No | All | `requireStaff` |
| `POST /:id/autofill` | Own cases | All | `verifyCaseAccess` |
| `POST /:id/questionnaire/autofill` | Own cases | All | `verifyCaseAccess` — builds patch + merges |
| `POST /:id/process-documents` | Own cases | All | `verifyCaseAccess` — batch process all docs |
| `GET /:id/review-summary` | No | All | `requireStaff` |

### Client portal (`/api/client-portal`)
| Endpoint | Client | Staff | Notes |
|----------|--------|-------|-------|
| `GET /cases` | Own | N/A | Client-only, filtered by `clientId` |
| `GET /cases/:id` | Own | N/A | Client-only, includes questionnaire |

### Other endpoints
- `/api/forms` — authenticated (any role), no staff restriction
- `/api/clients` — `requireStaff` (full route)
- `/api/auth` — public (login/token validation)

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
