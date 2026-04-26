# Roles & Workflow

> **Owner:** Richard (legal domain) + Matt (implementation)  
> **Status:** Stub — scaffolded from system design docs. Richard needs to validate against the firm's actual workflow.  
> **How to contribute:** See [richard-howto.md](richard-howto.md) for editing instructions.  
> **Why this matters:** Drives role-based permissions, notification logic, case status lifecycle, and the review queue UI.

---

## System Roles

| Role | Who | What they can do |
|---|---|---|
| **client** | Bankruptcy debtor (and spouse for joint filings) | Fill out questionnaire, upload documents, view their own case status |
| **paralegal** | Firm paralegal or legal assistant | Manage intake, review document extractions, request re-uploads, communicate with clients |
| **attorney** | Supervising/filing attorney | Review AI fraud analysis, approve means test, sign off on petition, set case parameters |
| **admin** | Firm administrator | All of the above plus user management, firm settings, reference data |

> Technical implementation of roles, authentication, and access control: see [architecture.md](../dev/architecture.md#roles--auth).

---

## Workflow: First Client Contact Through Filing

*Below is a template. Richard: please update each step to reflect how your firm actually works.*

### Step 1 — Initial Consultation & Conflict Check

- **Who:** Attorney or paralegal
- **Action:** Run conflict check; confirm client qualifies for Chapter 7 or 13
- **System:** *(conflict check not yet in app — done externally)*
- **Output:** Decision to proceed; create client + case record in LegalEagle

### Step 2 — Client Intake

- **Who:** Paralegal sets up the case; client fills out questionnaire
- **Action:** Paralegal creates client account and sends login link. Client completes the 27-section digital questionnaire.
- **System:** Client portal questionnaire
- **Questions for Richard:**
  - Do clients fill this out on their own, or does the paralegal walk them through it?
  - Is there a deadline by which the questionnaire must be complete before document upload starts?

### Step 3 — Document Upload

- **Who:** Client uploads; paralegal monitors completeness
- **Action:** Client uploads pay stubs, tax returns, bank statements, ID documents via the document portal. App automatically classifies and extracts data from each uploaded document.
- **System:** Document upload + extraction pipeline
- **Questions for Richard:**
  - Do clients know what to upload, or does the paralegal send them a checklist?
  - How long do clients typically take to complete document upload?
  - What happens if a client uploads something blurry or wrong?

### Step 4 — Paralegal Review

- **Who:** Paralegal
- **Action:** Review extracted data for accuracy. Accept or correct extractions. Request re-uploads for bad documents. Verify document coverage (6 months of pay stubs, etc.).
- **System:** Staff document review panel
- **Questions for Richard:**
  - At what point does the paralegal hand off to the attorney?
  - What is the approval gate before the attorney reviews?

### Step 5 — Attorney Review

- **Who:** Attorney
- **Action:** Review AI fraud and inconsistency analysis. Review means test calculation. Confirm questionnaire data is complete and accurate. Sign off before petition generation.
- **System:** AI review panel + means test calculator
- **Questions for Richard:**
  - Does the attorney review every case, or only cases with red flags?
  - What does "sign off" mean in your workflow — is it a formal approval action in the system?

### Step 6 — Petition Preparation

- **Who:** Attorney or paralegal under attorney supervision
- **Action:** Generate petition forms (Schedule I, Form 122A, etc.). Review generated PDF. Make any manual corrections.
- **System:** Petition generation *(not yet built)*
- **Questions for Richard:**
  - Who reviews the generated petition — attorney only, or paralegal first?

### Step 7 — Filing

- **Who:** Attorney
- **Action:** File petition via CM/ECF (PACER). Pay filing fees.
- **System:** E-filing *(not yet built; see [efiling-plan.md](../dev/efiling-plan.md))*
- **Questions for Richard:**
  - Do you file directly via CM/ECF today, or use a third-party service?

---

## Handoff Points & Approval Gates

*Richard: please fill in what "done" means at each handoff.*

| Handoff | From | To | "Done" criteria |
|---|---|---|---|
| Intake complete | Client | Paralegal | *(what must be complete before paralegal starts review?)* |
| Ready for attorney | Paralegal | Attorney | *(what must paralegal verify before escalating?)* |
| Ready to file | Attorney | Filing | *(what must attorney confirm before filing?)* |

---

## What "Ready to File" Means

*Richard: please define this for your firm.*

Checklist items before a petition can be filed:
- [ ] All 27 questionnaire sections completed
- [ ] Required documents uploaded and extracted
- [ ] Document coverage validated (6 months pay stubs, etc.)
- [ ] Means test calculation complete
- [ ] AI fraud review run and reviewed by attorney
- [ ] Petition forms generated and reviewed
- [ ] Attorney sign-off recorded
- [ ] Filing fees confirmed

---

## Questions for Richard

- [ ] Does the paralegal or the attorney have the primary relationship with the client?
- [ ] How are urgent cases (imminent foreclosure, wage garnishment) handled differently?
- [ ] What is your typical case timeline from intake to filing?
- [ ] Are there cases where you skip certain steps (e.g., simple Chapter 7 with no assets)?
