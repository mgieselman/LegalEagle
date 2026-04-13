# LegalEagle Agent Instructions

## Architecture

- This repository is a full-stack application with a React/Vite client in [client](client) and an Express/TypeScript server in [server](server).
- The client is a single-page app. [client/src/components/FormShell.tsx](client/src/components/FormShell.tsx) is the primary orchestration component and renders the 27 questionnaire sections from [client/src/components/form-sections](client/src/components/form-sections).
- The server exposes form CRUD routes in [server/src/routes/forms.ts](server/src/routes/forms.ts), document handling in [server/src/routes/documents.ts](server/src/routes/documents.ts), case management in [server/src/routes/cases.ts](server/src/routes/cases.ts), AI review in [server/src/routes/review.ts](server/src/routes/review.ts), and PDF download in [server/src/routes/download.ts](server/src/routes/download.ts), backed by Drizzle ORM with schema in [server/src/db/schema.ts](server/src/db/schema.ts).
- A standalone Python FastAPI extraction service lives in [extractor](extractor). It handles document classification, text extraction, OCR, and field extraction via a Rule → Azure DI → Claude chain. See [docs/extraction.md](docs/extraction.md) for architecture details.
- The server also serves the built SPA in production from [client/dist](client/dist) via [server/src/index.ts](server/src/index.ts).

## Build And Test

- Client install: `cd client && npm ci`
- Client dev: `cd client && npm run dev`
- Client build: `cd client && npm run build`
- Client lint: `cd client && npm run lint`
- Server install: `cd server && npm ci`
- Server dev: `cd server && npm run dev`
- Server build: `cd server && npm run build`
- Server test: `cd server && npm test`
- Full-stack local development runs the server on port `3001` and the Vite client separately; the client proxies `/api` to the server via [client/vite.config.ts](client/vite.config.ts).

## Conventions

- Preserve the section component pattern: `Section{number}{Topic}` components live in [client/src/components/form-sections](client/src/components/form-sections) and are registered in [client/src/components/FormShell.tsx](client/src/components/FormShell.tsx).
- Keep questionnaire types aligned across [client/src/types/questionnaire.ts](client/src/types/questionnaire.ts) and [server/src/types/questionnaire.ts](server/src/types/questionnaire.ts) when changing form data shape.
- Root `.env` values are loaded by [server/src/env.ts](server/src/env.ts). `ANTHROPIC_API_KEY` is required for AI review. `DATABASE_PATH` and `PORT` are optional.
- Plausible analytics is optional and controlled by Vite env vars. See [client/README.md](client/README.md) for the current setup.
- Prefer linking to existing docs instead of duplicating them. Current repo documentation is limited; [client/README.md](client/README.md) contains the client and Plausible notes.

## Deployment Policy

- Use GitHub Actions as the only deployment mechanism for this repository.
- Do not deploy this application directly from a local machine with Azure CLI, zip deploy, or any other manual deployment path unless the user explicitly overrides this policy for a specific task.
- For normal deployment, make changes in the repository and rely on [.github/workflows/deploy.yml](.github/workflows/deploy.yml) to build, test, package, and deploy the application.

## Pre-Push Checklist

Before every `git push`, run through this checklist:

1. **Review `.gitignore`** — Ensure all of the following are ignored:
   - Virtual environments (`*/.venv/`, `__pycache__/`, `*.pyc`)
   - Eval / benchmark output directories (`extractor/eval_*/`)
   - Large data or R&D directories (`Extraction/`, `azure-di-eval/`)
   - Scratch scripts and review notes (`bench_results_*.md`, `test_results.md`, `classifier-review.md`)
   - Secrets and local data (`.env`, `*.db`, `server/data/`)
2. **Check staged files** — Run `git diff --cached --stat` and scan for:
   - Binary files (`.dylib`, `.so`, `.exe`, `.whl`, images, PDFs)
   - Unexpectedly large files (anything over 1 MB)
   - Directories that look like vendored dependencies or data dumps
   - Any file that contains secrets, API keys, or PII
3. **Verify commit size is reasonable** — If the commit adds more than 500 files or the pack is larger than 50 MB, stop and investigate before pushing.