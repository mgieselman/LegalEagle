# LegalEagle

Multi-tenant bankruptcy SaaS for law firms — questionnaire intake, document processing, AI fraud review, means test automation, petition generation.

## Quick Reference
- **Start all services**: `.venv/bin/python start.py` (kills existing, starts client :3002, server :3001, extractor :8321)
- **Build client**: `cd client && npx vite build`
- **Build server**: `cd server && npx tsc`
- **Model**: `claude-sonnet-4-20250514`
- **ORM**: Drizzle ORM — schema is source of truth, `drizzle-kit push` syncs DB
- **DB**: SQLite (dev), PostgreSQL (prod). Wipe and reseed on deploy until real data exists.

## Design Principles
- **Interface-driven architecture**: All external dependencies (storage, auth, AI, OCR, queues, etc.) must be accessed through interfaces/abstractions so implementations can be swapped. No direct coupling to Azure, AWS, or any specific vendor in business logic.
- **Make it work first, make it pretty later**: Focus on end-to-end functionality before UI polish.
- **Soft delete only**: Legal app — never hard-delete records. Use `deleted_at` timestamps.

## Code Quality Requirements
- **Strict TypeScript — no `any`.** Use proper types, generics, or `unknown` with type guards. The questionnaire has 150+ fields and extraction schemas vary by doc type — `any` hides bugs that surface as wrong data in court filings.
- **Lint + format enforced.** ESLint + Prettier. Code must pass lint before commit. No style debates.
- **No secrets in code.** All secrets in `.env` files only. Never commit API keys, SSNs, or credentials. `.env` must be in `.gitignore`.
- **API boundary validation with Zod.** All API inputs and AI extraction outputs must be validated with Zod schemas before processing. Never trust client-submitted or AI-generated data without validation.

## Testing Requirements
- **All code must have unit tests.** No exceptions — every module, service, route, and component needs corresponding tests.
- **All unit tests must pass before moving to the next phase** in any implementation plan. Do not proceed to phase N+1 until phase N's tests are green.
- **End-to-end validation via Chrome MCP** at the end of each plan phase — use the browser to verify the actual UI works as expected (login flows, page navigation, form interactions, etc.).

## Roles
- **client** — authenticates against `clients` table (separate from staff). Sees own case(s) only.
- **paralegal** — staff role. Manages intake, doc review. Sees assigned clients.
- **attorney** — staff role. Reviews, signs off, sets means test params. Sees all firm clients.
- **admin** — staff role. Full access + user mgmt, settings, reference data.

## UI Consistency
Before building or modifying any frontend component, read `/docs/dev/ui-patterns.md`. Key rules:
- **Use shared components** from `client/src/components/ui/` — `PageHeader`, `StatusBadge`, `EmptyState`, `DataTable`, `Card`, `SeverityIcon`/`SeverityCard`/`ConfidenceScore`, `Button`, `Input`, `Label`, `Select`. Do not duplicate their logic inline.
- **Never hardcode status, severity, or confidence colors.** Always use the corresponding shared component.
- **Page structure**: every page wraps in `<div className="p-6 space-y-6">` with a `<PageHeader>` at top.
- **Tables**: use `DataTable` for read-only lists. Cell padding is `p-3`, header bg is `bg-muted/50`, row hover is `hover:bg-muted/30`.
- **Spacing**: `space-y-6` between page sections, `space-y-4` between form fields, `gap-4` in grids, `gap-1` for icon+text in buttons.
- **Typography**: page titles are `text-2xl font-bold`, body text is `text-sm`, secondary text adds `text-muted-foreground`.
- **Icons**: Lucide React, `h-4 w-4` standard size. Loading spinner is `Loader2` with `animate-spin`.
- **Responsive**: single breakpoint `md:` (768px). Mobile-first. Tables need mobile card variants.

## Key Gotchas
- `import './env'` must be first import in server/index.ts (loads dotenv before other modules)
- Anthropic client must be lazy-initialized (env vars not available at import time due to hoisting)
- Express 5: use `/{*splat}` not `*` for catch-all routes
- Express 5: `req.params` returns `string | string[]`, handle explicitly

## Reference Docs
Architecture, design decisions, and BK domain knowledge are in `/docs/`. Read before making structural changes.
- `/docs/dev/architecture.md` — system design, tech stack, roles, page structure
- `/docs/dev/design-decisions.md` — product direction, workflow, auth strategy, interfaces
- `/docs/dev/document-pipeline.md` — document processing pipeline (upload, classify, extract, validate, review, form generation)
- `/docs/dev/extraction.md` — extraction pipeline architecture, classification tiers, rule extractors, Azure DI, cost analysis
- `/docs/dev/extraction-requirements.md` — per-doc-class extraction schemas and behavioral rules
- `/docs/dev/ui-requirements.md` — view specs, user flows, role capabilities, progress bar stages
- `/docs/dev/ui-patterns.md` — **read before any frontend work** — Tailwind conventions, shared components, spacing, colors, anti-patterns
- `/docs/dev/competitive-matrix.md` — feature comparison vs. Jubilee Pro and Glade.ai
- `/docs/domain/means-test.md` — Chapter 7 means test reference (Forms 122A, Schedule I)
