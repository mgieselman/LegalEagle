---
name: deploy
description: 'Commit and push the current repository changes to GitHub so the existing GitHub Actions deployment workflow can run. Use for requests like deploy, ship this, commit and push, or release current changes. This repository deploys via GitHub Actions only.'
argument-hint: 'Optional commit message or deployment note'
user-invocable: true
disable-model-invocation: true
---

# Deploy

## When to Use

- Use when the user wants to deploy the current changes.
- Use when the user asks to commit and push the current branch.
- Use when the user wants GitHub Actions to perform the production deployment.

## Procedure

1. Inspect the working tree with `git status --short` and review changed files before committing.
2. Run the relevant validation commands for the touched areas. For this repository that usually means:
   - `cd client && npm run build` for client changes
   - `cd client && npm run lint` for client code changes when practical
   - `cd server && npm run build && npm test` for server changes
3. Summarize any failures and stop if validation fails unless the user explicitly asks to proceed anyway.
4. Stage only the intended files. Do not include unrelated user changes without checking.
5. Create a concise commit message. If the user supplied a message, use it. Otherwise write a short imperative message based on the actual changes.
6. Commit the staged changes with non-interactive git commands.
7. Push the current branch to `origin`.
8. Tell the user that deployment is handled by [../../workflows/deploy.yml](../../workflows/deploy.yml) after the push.

## Rules

- Do not use Azure CLI, local zip deploy, or any manual deployment path unless the user explicitly overrides repository policy.
- Prefer pushing through GitHub so GitHub Actions performs the deployment.
- If the current branch is not `main`, explain that the existing deploy workflow runs on pushes to `main` and ask whether the user wants a push to the current branch only or a merge/push path to `main`.
- Do not amend commits unless the user explicitly asks.