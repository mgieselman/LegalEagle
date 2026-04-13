# LegalEagle Server Instructions

## Architecture

- The server is an Express + TypeScript app started from [src/index.ts](src/index.ts).
- Route handlers live in [src/routes](src/routes) and business logic lives in [src/services](src/services).
- Form persistence via Drizzle ORM: schema defined in [src/db/schema.ts](src/db/schema.ts), CRUD operations in [src/services/db.ts](src/services/db.ts).
- The production server serves both API routes and the built SPA from `client/dist`.

## Build And Test

- Install dependencies: `cd server && npm ci`
- Start dev server: `cd server && npm run dev`
- Build server: `cd server && npm run build`
- Run tests: `cd server && npm test`
- Seed local data: `cd server && npm run seed`

## Conventions

- Keep route files thin: parse request details and delegate persistence, review, or PDF work to service modules.
- Preserve the existing route split: [src/routes/forms.ts](src/routes/forms.ts), [src/routes/cases.ts](src/routes/cases.ts), [src/routes/documents.ts](src/routes/documents.ts), [src/routes/review.ts](src/routes/review.ts), [src/routes/download.ts](src/routes/download.ts), [src/routes/clients.ts](src/routes/clients.ts), [src/routes/auth.ts](src/routes/auth.ts), [src/routes/clientPortal.ts](src/routes/clientPortal.ts).
- Keep questionnaire types aligned with the client copy in [../client/src/types/questionnaire.ts](../client/src/types/questionnaire.ts).
- Root `.env` values are loaded by [src/env.ts](src/env.ts). `ANTHROPIC_API_KEY` is required for the AI review path.
- Do not change deployment behavior in server code to work around environment issues; deployment is handled through GitHub Actions in [../.github/workflows/deploy.yml](../.github/workflows/deploy.yml).