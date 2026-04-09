# LegalEagle

Multi-tenant bankruptcy SaaS for law firms — questionnaire intake, document processing, AI fraud review, means test automation, petition generation.

## Quick Reference
- **Build client**: `cd client && npx vite build`
- **Build server**: `cd server && npx tsc`
- **Dev**: `npm run dev` (runs both client and server)
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

## Key Gotchas
- `import './env'` must be first import in server/index.ts (loads dotenv before other modules)
- Anthropic client must be lazy-initialized (env vars not available at import time due to hoisting)
- Express 5: use `/{*splat}` not `*` for catch-all routes
- Express 5: `req.params` returns `string | string[]`, handle explicitly

## Reference Docs
Architecture, design decisions, and BK domain knowledge are in `/docs/`. Read before making structural changes.
- `/docs/architecture.md` — system design, tech stack, roles, page structure
- `/docs/design-decisions.md` — product direction, workflow, auth strategy, interfaces
- `/docs/document-pipeline.md` — document processing pipeline (upload, classify, extract, validate, review, form generation)
- `/docs/bk-knowledge/means-test.md` — Chapter 7 means test reference (Forms 122A, Schedule I)
