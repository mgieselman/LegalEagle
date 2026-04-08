# LegalEagle Client Instructions

## Architecture

- The client is a React 19 + Vite single-page app rooted at [src/main.tsx](src/main.tsx) and [src/App.tsx](src/App.tsx).
- [src/components/FormShell.tsx](src/components/FormShell.tsx) owns the main questionnaire state, form CRUD orchestration, review flow, download flow, and mobile/desktop layout.
- Questionnaire sections live in [src/components/form-sections](src/components/form-sections) and are rendered from the `sections` registry in [src/components/FormShell.tsx](src/components/FormShell.tsx).
- Shared UI primitives live in [src/components/ui](src/components/ui) and utilities live in [src/lib](src/lib).

## Build And Test

- Install dependencies: `cd client && npm ci`
- Start dev server: `cd client && npm run dev`
- Build production bundle: `cd client && npm run build`
- Run lint: `cd client && npm run lint`

## Conventions

- Keep section components in the `Section{number}{Topic}` pattern and update the registry in [src/components/FormShell.tsx](src/components/FormShell.tsx) when adding, removing, or reordering sections.
- Keep form data paths and types aligned with [src/types/questionnaire.ts](src/types/questionnaire.ts). If the data shape changes, update the server copy in [../server/src/types/questionnaire.ts](../server/src/types/questionnaire.ts) too.
- Match the existing styling stack: utility-first class names, small reusable UI primitives, and `class-variance-authority` variants in files like [src/components/ui/button.tsx](src/components/ui/button.tsx).
- Use the API wrapper in [src/api/client.ts](src/api/client.ts) instead of ad hoc `fetch` calls.
- Plausible analytics is optional. Keep analytics code in [src/lib/plausible.ts](src/lib/plausible.ts) and gate it behind Vite env vars.