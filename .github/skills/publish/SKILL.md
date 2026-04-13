---
name: publish
description: 'Run strict pre-publish checks, commit and push to GitHub, monitor GitHub Actions deploy status, and verify the Azure site is healthy. Use for requests like publish, ship, release, deploy now, commit push and verify deployment.'
argument-hint: 'Optional commit message and mode: strict | full (default strict). Example: "strict feat: mobile sidebar drawer"'
user-invocable: true
disable-model-invocation: true
---

# Publish

## Purpose

Use this skill to publish safely: gate with `/wrap`, commit intended changes, push to GitHub, watch deployment, and confirm the site is up without errors.

## Preconditions

- Repository deployment policy is GitHub Actions only.
- Workflow trigger is push to `main` in [../../../workflows/deploy.yml](../../../workflows/deploy.yml).
- `/wrap` must pass before commit/push.

## Inputs

- Optional wrap mode (`strict` recommended, `full` allowed).
- Optional commit message.

If mode is omitted, default to `strict`.

## Procedure

1. Run pre-publish gate.
- Invoke `/wrap strict` (or requested mode).
- Continue only if wrap verdict is `PASS`.

2. Verify branch and change intent.
- Run `git branch --show-current` and `git status --short`.
- If branch is not `main`, explain deploy trigger behavior and ask whether to continue push or switch/merge path.
- Stage only intended files; avoid unrelated files.

3. Commit.
- Use user-provided message when available.
- Otherwise write a concise commit message based on changed files.
- Use non-interactive git commands only.

4. Push to GitHub.
- Push current branch to `origin`.
- If push fails, stop and report exact error.

5. Monitor deployment workflow.
- Poll GitHub Actions run status for workflow `Build and Deploy to Azure` after push.
- Prefer GitHub API endpoint for latest runs on the branch.
- Report run number, status, conclusion, and failing step when applicable.
- Continue until run is `completed` with `success` or `failure`.

6. Verify site health.
- Check `https://app-legaleagle.azurewebsites.net` (or domain configured in workflow env).
- Validate HTTP success and basic page content (for example app shell title/HTML).
- If deployment succeeded but site check fails, report as `FAIL` with diagnostics.

## Failure Handling

- If `/wrap` fails: stop before commit/push.
- If workflow fails: report failing job/step and recommend next fix command(s).
- If site health fails: report deploy run outcome plus HTTP/body diagnostics.

## Rules

- Never use Azure CLI direct deploy commands outside the existing workflow unless user explicitly overrides policy.
- Do not bypass failed checks with force-push, reset, or destructive git commands.
- Do not include unrelated user changes in commit without confirmation.
- Do not amend commits unless explicitly requested.

## Output Template

- `Wrap`: PASS/FAIL and mode used
- `Commit`: hash + message
- `Push`: success/failure
- `Deploy run`: run number + URL + final conclusion
- `Site check`: URL + HTTP status + pass/fail
- `Final`: PASS/FAIL
- `Next step`: exact command(s) or fix target
