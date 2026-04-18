---
name: wrap
description: 'Run a pre-commit wrap-up pass: lint, type/build checks, targeted tests, code review findings, docs consistency updates, and commit-readiness summary. Use for requests like wrap this up, pre-commit check, final quality pass, ready to commit, or before push.'
argument-hint: 'Optional mode: fast | full | strict, plus optional note about commit intent'
user-invocable: true
---

# Wrap

## Purpose

Use this skill as the final quality gate before commit or push. It should run the right checks for changed files, identify risks, enforce documentation updates when behavior changes, and produce a clear go/no-go outcome.

## Modes

- `fast`: Quick pre-commit pass for local iteration.
- `full`: Normal pre-push pass with broader validation.
- `strict`: Release-grade pass; treat warnings in touched areas as blockers when practical.

If no mode is provided, default to `full`.

## Inputs

- Optional mode (`fast`, `full`, `strict`).
- Optional user note about commit/deploy intent.

## Publish Handoff

- When called as part of `/publish`, run `strict` unless explicitly overridden.
- Return a clear top-line verdict (`PASS` or `FAIL`) before details so `/publish` can gate commit/push behavior.
- If verdict is `FAIL`, do not recommend commit/push.

## Procedure

1. Inspect change scope.
- Run `git status --short` and `git diff --name-only --cached` (and unstaged if needed).
- Group changes by area: `client`, `server`, `extractor`, `docs`, workflow/config.
- If unexpected massive/unrelated changes appear (for example virtual env binaries), stop and ask how to proceed.

2. Run repository safety checks.
- Verify no obvious secrets or local artifacts are being committed.
- Flag suspicious staged files: binaries, files over 1 MB, virtual environments, local DB files, generated outputs.
- Validate ignore hygiene against repository policy in [../../../AGENTS.md](../../../AGENTS.md).

3. Run targeted validation by changed area.
- For `client` changes:
  - `cd client && npm run lint`
  - `cd client && npm run build`
  - In `full` or `strict`, run relevant tests when practical.
- For `server` changes:
  - `cd server && npm run lint`
  - `cd server && npm run build`
  - In `full` or `strict`, run relevant tests when practical.
- For `extractor` changes:
  - Run the smallest relevant checks/tests for touched modules.
  - Avoid heavy benchmark/eval runs unless requested.

4. Apply safe auto-fixes when deterministic.
- Use non-destructive, deterministic fixes only (for example lint auto-fix where supported).
- Re-run failed checks once after fixes.
- If still failing, report exact blockers and stop short of commit recommendation.

5. Perform a focused code review pass.
- Prioritize correctness, regression risk, auth/access control, data integrity, and API contract drift.
- Identify missing tests for changed behavior.
- Call out type safety regressions (`any`, unchecked inputs, schema mismatch).

6. Enforce documentation consistency.
- If behavior, routes, env vars, UI patterns, or workflows changed, update docs in `docs/` (and relevant READMEs) in the same pass.
- For UI behavior changes, ensure alignment with [../../../docs/dev/ui-patterns.md](../../../docs/dev/ui-patterns.md) and [../../../docs/dev/ui-requirements.md](../../../docs/dev/ui-requirements.md).
- If no docs update is needed, explicitly state why.

7. Produce a commit-readiness verdict.
- Return `PASS` or `FAIL`.
- Include:
  - Checks run and outcomes
  - Auto-fixes applied
  - Blocking findings
  - Non-blocking recommendations
  - Doc updates made (or why none)
  - Suggested next command (for example `git commit ...`)

## Mode Behavior

### Fast

- Run area-specific lint/build only.
- Skip slow tests unless clearly related and fast.
- Keep review/doc checks concise.

### Full

- Run lint/build plus practical targeted tests.
- Run full review + documentation consistency checks.
- This is the default for pre-push readiness.

### Strict

- Everything in `full`, plus stronger enforcement:
  - Treat warnings in changed code as blockers when feasible.
  - Require explicit test coverage note for behavior changes.
  - Require explicit doc decision (updated or justified as not needed).

## Rules

- Do not commit or push automatically unless the user explicitly asks.
- Do not use destructive git commands to clean the tree.
- Never revert unrelated user changes.
- Prefer smallest-scope checks that still provide confidence.
- If CI is known to be flaky or configured with `continue-on-error`, note that in the verdict.

## Output Template

- `Mode`: fast/full/strict
- `Verdict`: PASS/FAIL
- `Checks`: list of commands + result
- `Auto-fixes`: what changed
- `Blocking issues`: numbered list
- `Docs`: updated files or rationale for no changes
- `Next step`: exact recommended command(s)
