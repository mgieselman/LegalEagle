# Model Selection Guide

Use this document to decide which AI model to use for a given agent task. Default to **Claude Sonnet 4** when in doubt.

## Quick Reference

| Task type | Preferred model | Rationale |
|---|---|---|
| Architecture review, security audit | Claude Opus 4 | Complex multi-step reasoning; high stakes, cost justified |
| Feature implementation, tests, routes | Claude Sonnet 4 | Best speed/quality balance for most coding tasks |
| Read-only exploration, Q&A | Claude Sonnet 4 | Lightweight context gathering; no need for Opus |
| Mechanical scaffolding, boilerplate | o3 / Codex | Fast and cheap for repetitive, well-defined code generation |
| Long-document analysis (>100k tokens) | Gemini 2.5 Pro | Context window advantage for large codebases or doc sets |
| Visual / screenshot validation | Gemini 2.5 Pro | Strongest multimodal model for UI screenshots and PDFs |
| E2E browser validation | Claude Sonnet 4 | Adequate for structured validation steps; Gemini if screenshots needed |

## Per-Agent Defaults

| Agent | Default model | Override when |
|---|---|---|
| Architecture Reviewer | Claude Opus 4 | Use Sonnet for quick sanity checks on small changes |
| Code Reviewer | Claude Sonnet 4 | Upgrade to Opus 4 for security-sensitive or large PRs |
| Coder | Claude Sonnet 4 | Use o3/Codex for boilerplate-heavy scaffolding; Gemini if reading many large files |
| Tester | Claude Sonnet 4 | Rarely needs overriding |
| E2E Validator | Claude Sonnet 4 | Use Gemini 2.5 Pro when validation requires reading screenshots |
| Explore | Claude Sonnet 4 | Use Gemini 2.5 Pro for very large file sets (>100k tokens) |

## Model Characteristics

### Claude Opus 4
- Best reasoning and instruction-following in the Claude family
- Use for: architecture decisions, threat modeling, complex refactors, anything where a wrong answer has significant downstream cost
- Cost: ~5× Sonnet — reserve for genuinely hard problems

### Claude Sonnet 4
- Default for all coding and review tasks
- Good balance of speed, quality, and cost
- Handles TypeScript, React, Python, SQL, and Express 5 patterns well

### o3 / Codex (OpenAI)
- Optimized for fill-in-the-middle and structured code generation
- Use for: generating repetitive CRUD endpoints, scaffolding new components from a clear spec, migration scripts
- Avoid for: open-ended reasoning, architecture decisions, security review

### Gemini 2.5 Pro
- Largest context window (~1M tokens); strong multimodal support
- Use for: analyzing many files at once, reading long extraction schemas, validating UI from screenshots
- Avoid for: tasks that need tight TypeScript awareness — Claude handles this better

## Rules

- Never use a more expensive model just because it's available. Match model to task difficulty.
- If the agent file specifies a model array, pick the first that fits the task at hand.
- When overriding a default, note why in the task description so reviewers understand the choice.
