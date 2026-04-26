# LegalEagle Documentation Index

Single entry point for all project documentation. Grouped by audience — start with the section most relevant to your task.

---

## Development

| Document | Summary |
|---|---|
| [architecture.md](dev/architecture.md) | **Source of truth** for system design: tech stack, multi-tenant data model, roles, page routes, API access control, and key implementation patterns. |
| [design-decisions.md](dev/design-decisions.md) | Product direction, target workflow, auth strategy, data model evolution, interface-driven architecture decisions, and pre-pilot quality gates. |
| [ui-patterns.md](dev/ui-patterns.md) | **Source of truth** for all frontend conventions: shared components, layout, typography, spacing, colors, tables, forms, and responsive rules — read before touching any UI. |
| [ui-requirements.md](dev/ui-requirements.md) | View-by-view behavior specs, user flows, and role-based capability matrix for every page in the client and staff portals. |
| [ui-validation-plan.md](dev/ui-validation-plan.md) | End-to-end browser validation sequence (Chrome MCP / Playwright / API tiers) with test credentials and per-page checklists; run after any UI change. |
| [document-pipeline.md](dev/document-pipeline.md) | Full document lifecycle: upload → classification → extraction → validation → human review → form mapping, including implementation status and processing pipeline stages 1–9. |
| [document-pipeline-reference.md](dev/document-pipeline-reference.md) | Detailed data model (SQL table diagrams, indexes), storage architecture, security design, IRS reference data schema, backup & DR, and database strategy for the document pipeline. |
| [extraction.md](dev/extraction.md) | Extraction service overview: architecture, Quick Reference, main pipeline flow diagram with confidence thresholds, Service API, and how to run the service. |
| [extraction-pipeline.md](dev/extraction-pipeline.md) | Step-by-step extraction pipeline mechanics: Steps 1–5 with full flow diagrams, text extraction strategies, OCR tiers, classification chain, Rule→Azure DI→Claude extraction chain, schemas, and confidence scoring. |
| [extraction-config.md](dev/extraction-config.md) | Extraction service operational reference: cost tiers, provider cost analysis from eval runs, threshold constants, Azure DI setup, and evaluation script documentation. |
| [extraction-requirements.md](dev/extraction-requirements.md) | Per-document-class extraction schemas and behavioral rules defining what fields to extract and how for each supported document type. |
| [model-selection.md](dev/model-selection.md) | **Source of truth** for AI model selection: which model to use per task type and per agent, model characteristics, and cost/capability tradeoffs. |
| [efiling-plan.md](dev/efiling-plan.md) | Phased implementation plan for PACER/CM-ECF e-filing, court reference data, filing packages, AI pre-flight validation, and docket monitoring. |
| [competitive-matrix.md](dev/competitive-matrix.md) | Feature-by-feature comparison of LegalEagle vs. Jubilee Pro vs. Glade.ai across pricing, chapter support, document processing, means test, and e-filing. |
| [questionnaire-review-2026-04-18.md](dev/questionnaire-review-2026-04-18.md) | Point-in-time review of Richard's questionnaire feedback (2026-04-18): per-section change requests classified as NEW / MODIFY / REMOVE with file references and open questions pending attorney answer. |

---

## Domain Knowledge

| Document | Summary |
|---|---|
| [legal-eagle-features.md](domain/legal-eagle-features.md) | Full feature inventory from MVP through post-MVP roadmap: platform foundation, intake, case management, document AI, petition prep, e-filing, and tiered upsell modules. |
| [means-test.md](domain/means-test.md) | Chapter 7 means test reference covering statutory basis, the two-part income/expense structure, CMI definition and lookback period, allowed deductions, and presumption-of-abuse thresholds. |
| [questionnaire-guide.md](domain/questionnaire-guide.md) | Section-by-section guide for all 27 BK questionnaire sections — what each asks, legal rationale, common client confusion, and edge cases; drives validation rules and AI review logic. |
| [document-checklist.md](domain/document-checklist.md) | Document acceptance criteria, coverage requirements, and acceptable substitutes for each document type the system processes — drives upload checklist UI and completeness validation. |
| [roles-and-workflow.md](domain/roles-and-workflow.md) | Firm workflow from initial consultation through court filing, with role definitions, handoff gates, and approval criteria — drives role permissions, notifications, and case status lifecycle. |
| [richard-howto.md](domain/richard-howto.md) | Guide for the domain expert (Richard) on how to edit docs via GitHub, simple Markdown formatting, and a prioritized list of domain documentation still needed. |

---

## Reading Paths by Role

| Role | Start here |
|---|---|
| **New developer** | architecture.md → design-decisions.md → ui-patterns.md |
| **Frontend work** | ui-patterns.md → ui-requirements.md |
| **Document / extraction work** | document-pipeline.md → extraction.md → extraction-pipeline.md → extraction-requirements.md |
| **AI / agent work** | model-selection.md → extraction.md → extraction-pipeline.md |
| **Domain expert (legal)** | richard-howto.md → questionnaire-guide.md → document-checklist.md → roles-and-workflow.md → means-test.md |
| **Product / strategy** | legal-eagle-features.md → competitive-matrix.md |
| **E-filing feature** | efiling-plan.md → architecture.md (filing-packages section) |
