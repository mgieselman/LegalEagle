# UI Requirements

## Views

| View | Route | Client | Paralegal | Attorney | Admin |
|---|---|---|---|---|---|
| Client Home | `/client/case/:id`, `/staff/case/:id` | Yes | Yes | Yes | Yes |
| Documents | `/client/case/:id/documents`, `/staff/case/:id/documents` | Yes | Yes | Yes | Yes |
| Questionnaire | `/client/case/:id/questionnaire`, `/staff/case/:id/questionnaire` | Yes | Yes | Yes | Yes |
| Document Review | `/staff/case/:id/documents/:docId/review` | No | Yes | Yes | Yes |
| Staff Dashboard | `/staff/dashboard` | No | Yes | Yes | Yes |
| Admin | `/admin/settings` | No | No | No | Yes |

---

## Navigation Structure

### Staff Layout (sidebar)
```
LegalEagle logo
─────────────────
Dashboard
Clients
Settings (admin only)
─────────────────
[User Name]
Sign out
```

### Client Layout (top bar)
```
LegalEagle logo          [User Name]  Sign out
```

### Case-Level Tabs (inside Client Home)

When viewing a case, both staff and client see a tab bar below the progress bar:

```
[Overview]  [Documents]  [Questionnaire]
```

Staff also sees:

```
[Overview]  [Documents]  [Questionnaire]  [Review]
```

Each tab maps to a nested route. The active tab is highlighted. This replaces the current approach of embedding documents inside the questionnaire as an accordion panel.

---

## Flow: Client

```
Login (/client-login)
  → Client Dashboard (/client/dashboard)
      Shows case cards with status labels
  → Click case
      → Client Home: Overview tab (/client/case/:id)
          Progress bar (Domino's-style stages)
          Task list: "What to do next"
            - "Upload your documents" → Documents tab
            - "Complete your questionnaire" → Questionnaire tab
          Key dates (meeting, hearing, filing)
      → Documents tab (/client/case/:id/documents)
          Document checklist with per-category progress
          Upload zone (drag-and-drop + browse)
          Uploaded files list with status
          Quality feedback (blurry/wrong doc rejection, re-upload prompts)
      → Questionnaire tab (/client/case/:id/questionnaire)
          27 collapsible sections
          Per-section progress indicators
          Autofilled fields visible (labeled as auto-populated)
          Save button
```

### Client key behaviors
- Client can work on documents and questionnaire in any order
- Progress bar updates as documents are uploaded/processed and questionnaire sections complete
- Client cannot see extraction details, AI review findings, or validation warnings
- Client cannot change document types or dismiss warnings
- Autofilled fields appear pre-populated but editable — client should be able to correct them

---

## Flow: Staff (Paralegal / Attorney)

```
Login (/login)
  → Staff Dashboard (/staff/dashboard)
      Table of all open cases: client name, chapter, status, progress, filing date
      Filter by status tabs
      Sort by column headers
      "New Client" button → /staff/clients/new
  → Click case
      → Client Home: Overview tab (/staff/case/:id)
          Progress bar (same Domino's-style)
          Case summary: client, chapter, filing district, household size
          Case actions: change status (dropdown), run AI review
          Task list showing what still needs attention:
            - Documents needing review (count)
            - Questionnaire sections incomplete (count)
            - Validation warnings unresolved (count)
            - Fraud review findings (count)
      → Documents tab (/staff/case/:id/documents)
          Same checklist + upload as client
          Plus: processing controls, status badges, classification overrides
          Click document → Document Review sub-view
      → Questionnaire tab (/staff/case/:id/questionnaire)
          Same 27 sections as client
          Plus: Save, Download PDF, Run AI Review buttons
          AI Review panel (collapsible right sidebar)
          Autofill button (populate from extracted data)
      → Review tab (/staff/case/:id/review)   [staff only]
          Three panels:
          1. Extraction review queue (docs needing review)
          2. Validation warnings (cross-doc, temporal, consistency)
          3. Fraud detection findings (from AI review agent)
```

---

## Flow: Document Upload → Extraction → Autofill

This is the core value pipeline. It spans multiple views.

```
1. UPLOAD (Documents tab)
   Client or staff uploads files
   ↓
2. CLASSIFY (automatic, background)
   AI identifies document type (paystub, W-2, bank statement, etc.)
   Confidence score assigned
   Low-confidence → flagged for staff review
   ↓
3. QUALITY CHECK (automatic, immediate feedback)
   Blurry images → rejected with "please retake" message
   Wrong document type → flagged with "this doesn't look like a [expected type]"
   Duplicates → auto-removed with notification
   ↓
4. EXTRACT (automatic, background)
   Rule engine + AI extracts structured data
   Per-field confidence scores
   High confidence (≥0.9) → auto-accepted
   Low confidence (<0.9) → needs review
   ↓
5. REVIEW (Document Review sub-view or Review tab, staff only)
   Side-by-side: original document | extracted data
   Accept / correct workflow
   Dismiss non-critical validation warnings
   ↓
6. AUTOFILL (Questionnaire tab, triggered by staff)
   Extracted data mapped to questionnaire fields
   Only fills empty fields (does not overwrite manual entry)
   Confidence ≥0.7 required for autofill
   Debtor vs. spouse routing based on document ownership
```

### Document status lifecycle (shown as badges)

```
uploaded → classifying → extracting → extracted (auto-accepted)
                                    → needs_review → reviewed (accepted/corrected)
                      → failed (retry available)
```

---

## View Details

### Client Home (Overview Tab)

Case-level landing page. First thing both client and staff see when opening a case.

| Feature | Client | Paralegal | Attorney |
|---|---|---|---|
| Progress bar (Domino's-style stages) | Yes | Yes | Yes |
| Task list ("what to do next") | Yes | Yes | Yes |
| Upcoming key dates | Yes | Yes | Yes |
| Links to scheduled meetings | Yes | Yes | Yes |
| Case summary (client, chapter, district) | No | Yes | Yes |
| Case status control (change status) | No | No | Yes |
| Run AI review | No | Yes | Yes |
| View fraud findings summary | No | Yes | Yes |

#### Progress bar stages (Domino's-style)

Shows all stages simultaneously. Each stage independently marked as completed or not — stages can complete out of order. Visual: horizontal row of circles connected by lines, filled when complete.

| Stage | Completes when | Blocks |
|---|---|---|
| Intake | Client created, case opened | Nothing |
| Documentation | All required document categories complete | — |
| Questionnaire | All required sections filled | — |
| Credit Counseling | Pre-filing credit counseling certificate uploaded | Filing |
| Review | All extractions accepted, no unresolved errors | Filing |
| Filed | Petition filed with court | — |
| Debtor Education | Post-filing debtor education certificate uploaded | Discharge |
| Hearing | 341 meeting date set | — |
| Discharged | Case discharged by court | — |

Note: There are two mandatory counseling sessions in bankruptcy. Credit counseling (pre-filing, 11 U.S.C. § 109(h)) must be completed before the petition can be filed. Debtor education (post-filing, 11 U.S.C. § 727(a)(11) / § 1328(g)) must be completed before discharge can be granted.

#### Task list logic

The task list is auto-generated from case state. It shows actionable items, not history.

| Condition | Task shown | Links to |
|---|---|---|
| Required doc category has no uploads | "Upload [category name]" | Documents tab |
| Document needs review | "[filename] needs review" | Document Review |
| Questionnaire section incomplete | "Complete [section name]" | Questionnaire tab, that section |
| Credit counseling not uploaded (pre-filing) | "Complete credit counseling and upload certificate" | Documents tab |
| Validation error exists | "[message summary]" | Review tab |
| Fraud finding (error severity) | "Review fraud finding: [summary]" | Review tab |
| Case is filed but debtor education not uploaded | "Complete debtor education course and upload certificate" | Documents tab |
| No tasks remaining (pre-filing) | "Case is ready for filing" | — |
| No tasks remaining (post-filing) | "Awaiting discharge" | — |

---

### Documents View

Same component for all roles. Features toggled by role.

#### Role capabilities

| Feature | Client | Paralegal | Attorney |
|---|---|---|---|
| View document checklist with per-category progress | Yes | Yes | Yes |
| Upload files (drag-and-drop + browse) | Yes | Yes | Yes |
| See upload quality feedback (blurry/wrong/duplicate) | Yes | Yes | Yes |
| Download files | Yes | Yes | Yes |
| Delete own uploads | Yes | Yes | Yes |
| View processing status badges | Yes | Yes | Yes |
| Process documents (trigger extraction) | No | Yes | Yes |
| Manually set/change document type | No | Yes | Yes |
| Click document to open review | No | Yes | Yes |
| Batch process all uploaded docs | No | Yes | Yes |

#### Document checklist

Displayed at the top of the Documents view. Each category is a row with an icon showing progress state.

| # | Document | Required | Quantity | Complete when |
|---|----------|----------|---------|---|
| (a) | Signed fee agreement | Yes | 1 document | Uploaded and signed |
| (b) | Last 6 months of pay stubs (debtor + spouse), or P&L if self-employed | Yes — P&L required if self-employed (known from questionnaire) | Multiple — need 6 months coverage per earner | All months covered (via extraction date ranges) |
| (c) | Last 2 years of Federal tax returns | Yes | Multiple — need 2 years | Both years present (via extraction tax year) |
| (d) | Collection letters, summons, complaints, or other legal documents | Optional | Multiple | N/A — optional |
| (e) | Statement showing assignment of debts to collection companies | Optional | Multiple | N/A — optional |
| (f) | Last statement for any IRAs and bank accounts | Optional | Multiple — one per account | N/A — optional |
| (i) | Copy of ID and SSN Card, or W2 with full SSN | Yes | Multiple — need ID + SSN card (or W2) | Uploaded and classified (ID + SSN card or W2) |

#### Progress states per category

| State | Icon | Meaning |
|---|---|---|
| None | Empty circle | Nothing uploaded yet |
| Partial | Half-filled circle (amber) | Some files but coverage incomplete |
| Complete | Filled circle (green check) | All files uploaded and extracted |
| Blocked | Filled circle (red X) | Extraction failed or needs review on a required doc |

#### Progress blocking
- Required categories: extraction failure or needs-review status blocks "complete"
- Optional categories: never block overall progress
- Unclassifiable documents: flagged for manual type assignment by staff

#### Upload quality feedback (immediate, inline)

When a client or staff uploads a file, the system should provide immediate feedback:

| Issue | Message to user | Action |
|---|---|---|
| Blurry/unreadable image | "This image is too blurry to read. Please retake the photo." | File rejected, not saved |
| Wrong document type (if hint provided) | "This doesn't look like a [expected type]. Please check and re-upload." | File saved but flagged |
| Duplicate file (SHA-256 match) | "This file has already been uploaded." | File rejected, not saved |
| Unsupported format | "This file type is not supported. Please upload PDF, JPEG, or PNG." | File rejected |
| File too large | "This file exceeds the 100MB limit." | File rejected |
| Success | "Uploaded. Processing..." | File saved, pipeline starts |

---

### Questionnaire View

Same component for all roles. Features toggled by role. Documents section removed — handled by Documents view.

| Feature | Client | Paralegal | Attorney |
|---|---|---|---|
| View questionnaire sections | Yes | Yes | Yes |
| Edit/fill out fields | Yes | Yes | Yes |
| Jump between sections freely | Yes | Yes | Yes |
| View per-section progress (complete/incomplete) | Yes | Yes | Yes |
| Autofilled fields visible (labeled as auto-populated) | Yes | Yes | Yes |
| Auto-save (debounced, see below) | Yes | Yes | Yes |
| Manual save button | Yes | Yes | Yes |
| Autofill from documents button | No | Yes | Yes |
| Download PDF | No | Yes | Yes |
| Run AI Review | No | Yes | Yes |
| View AI Review panel (right sidebar) | No | Yes | Yes |

#### Section list (27 sections)

Each section is a collapsible panel. Section header shows: number, title, progress indicator (complete/incomplete).

1. Name & Residence
2. Prior Bankruptcy
3. Occupation & Income
4. Business & Employment
5. Financial Questions
6. Taxes
7. Debts Repaid
8. Suits
9. Garnishment & Sheriff's Sale
10. Repossessions & Returns
11. Property Held by Others
12. Gifts & Transfers
13. Losses
14. Attorneys & Consultants
15. Closed Bank Accounts
16. Safe Deposit Boxes
17. Property Held for Others
18. Leases & Cooperatives
19. Alimony, Child Support & Property Settlements
20. Accidents & Driver's License
21. Cosigners & Debts for Others
22. Credit Cards & Finance Company Debts
23. Evictions
24. Secured Debts
25. Unsecured Debts
26. Asset Listing
27. Vehicles

#### Key rules
- Unanswered fields are null — any null required field in a section means that section is incomplete
- Sections can be filled in any order
- Autofilled data (from extraction) counts toward section completeness same as manual entry
- Autofilled fields should have a subtle visual indicator (e.g., small icon or tinted background) so the user knows the value came from a document, not manual entry
- Questionnaire is editable until case status is "filed" — then it locks to read-only

#### Auto-save behavior
- **Debounced auto-save**: saves 2 seconds after the user stops typing/editing. No explicit "Save" click required for routine edits.
- **Save indicator**: subtle status text near the top of the form — "Saving...", "Saved", or "Save failed — retry". No modal or toast for auto-save; it should be quiet and non-disruptive.
- **Manual save button**: still available as a fallback. Useful for users who want explicit confirmation.
- **Conflict handling**: if the server rejects a save (e.g., version conflict from another session), show an inline warning: "This form was updated elsewhere. Please refresh to see the latest version."
- **Offline/disconnect**: if auto-save fails due to network, queue the change and retry when connection restores. Show "Unsaved changes" indicator until synced.

#### AI Review panel (staff only)

Collapsible right sidebar. Shows findings from the fraud detection / consistency review agent.

- Each finding shows: severity icon (error/warning/info), section name, message
- Click finding → expands that section, scrolls to it, highlights it briefly
- Summary footer: "X errors, Y warnings, Z info"

---

### Document Review Sub-View (staff only)

Accessed by clicking a document from the Documents tab. Opens as a focused review interface.

```
/staff/case/:id/documents/:docId/review
```

| Feature | Paralegal | Attorney |
|---|---|---|
| View original document (embedded viewer or image) | Yes | Yes |
| View extracted data fields with confidence scores | Yes | Yes |
| Accept extraction | Yes | Yes |
| Correct extracted data (inline edit) | Yes | Yes |
| View validation warnings for this document | Yes | Yes |
| Dismiss validation warnings | Yes | Yes |
| Change document type | Yes | Yes |
| Navigate to next/previous document needing review | Yes | Yes |

#### Layout

Split view:
- **Left panel**: Original document (PDF viewer or image)
- **Right panel**: Extracted data as a form, pre-filled with extracted values
  - Each field shows confidence score (color-coded: green ≥0.9, amber 0.7–0.89, red <0.7)
  - Low-confidence fields highlighted for attention
  - Editable — staff can correct values inline

#### Actions
- **Accept** — marks extraction as reviewed_accepted, updates document status to "reviewed"
- **Accept with corrections** — saves corrected values, marks as reviewed_corrected
- **Back** — returns to Documents tab

#### Navigation
- "← Previous" and "Next →" buttons to step through documents needing review without returning to the list

---

### Review Tab (staff only)

Aggregated view of everything that needs staff attention on a case. Three sections:

#### 1. Extraction Review Queue

| Column | Description |
|---|---|
| Document | Filename + document type |
| Status | needs_review / auto_accepted |
| Confidence | Overall extraction confidence |
| Action | "Review" button → opens Document Review |

Only shows documents with status `needs_review` or `extracted` (auto-accepted but not yet human-verified). Empty state: "All documents reviewed."

#### 2. Validation Warnings

| Column | Description |
|---|---|
| Type | Internal consistency / Cross-document / Temporal coverage |
| Severity | Error / Warning / Info (icon + color) |
| Message | Description of the issue |
| Document | Related document (if applicable) |
| Action | "Dismiss" button (with confirmation for errors) |

Only shows active (non-dismissed) warnings. Empty state: "No validation issues."

#### 3. Fraud Detection Findings

| Column | Description |
|---|---|
| Severity | Error / Warning / Info |
| Section | Questionnaire section name |
| Finding | Description of the flag |
| Action | Click to jump to questionnaire section |

Shows results from the AI fraud review agent. Empty state: "No fraud review run yet" with "Run Review" button, or "No findings" if review was clean.

---

### Staff Dashboard

| Feature | Paralegal | Attorney | Admin |
|---|---|---|---|
| Table of all open cases | Yes | Yes | Yes |
| Filter by case status (tab buttons) | Yes | Yes | Yes |
| Sort by column header | Yes | Yes | Yes |
| Search by client name | Yes | Yes | Yes |
| "New Client" button | Yes | Yes | Yes |
| Click case → navigate to Client Home | Yes | Yes | Yes |

#### Table columns

| Column | Content |
|---|---|
| Client | Full name (clickable → case) |
| Chapter | 7 or 13 |
| Status | Badge (color-coded) |
| Progress | Mini progress indicator (e.g., "3/5 docs, 18/27 sections") |
| Attention | Count of items needing review (red badge if > 0) |
| Filing Date | Date or "—" |
| Created | Date |

#### Status badges
- intake → blue
- documents → yellow
- review → purple
- ready_to_file → green
- filed → emerald
- discharged → gray
- dismissed → red
- closed → gray

---

### Admin View

| Feature | Admin |
|---|---|
| Create staff accounts (paralegal, attorney, admin) | Yes |
| List staff accounts | Yes |
| Edit staff accounts | Yes |
| Deactivate staff accounts (soft delete) | Yes |
| Firm settings (name, address, contact) | Yes |
| Reference data management (median income, IRS standards) | Planned |

---

## Notifications

In-app notification system for staff. Clients do not receive in-app notifications (they rely on the task list on their Case Home).

### Notification bell (staff layout)

Bell icon in the sidebar header, next to the user name. Shows unread count badge (red circle with number). Clicking opens a dropdown panel with recent notifications, most recent first.

### Notification events

| Event | Who receives | Message |
|---|---|---|
| Document finished processing (extracted) | Case owner (paralegal/attorney) | "[Client Name]: [filename] extracted successfully" |
| Document needs review (low confidence) | Case owner | "[Client Name]: [filename] needs review" |
| Document processing failed | Case owner | "[Client Name]: [filename] failed to process" |
| Client completed a questionnaire section | Case owner | "[Client Name] completed [section name]" |
| Client uploaded a document | Case owner | "[Client Name] uploaded [filename]" |
| All required documents uploaded | Case owner | "[Client Name]: all required documents received" |
| Questionnaire fully complete | Case owner | "[Client Name]: questionnaire complete" |
| Validation error detected | Case owner | "[Client Name]: new validation issue — [summary]" |
| Fraud review completed | Case owner | "[Client Name]: fraud review found [N] findings" |

### Notification behavior
- Notifications persist until dismissed (click "x") or marked as read
- Clicking a notification navigates to the relevant case/view (e.g., clicking "needs review" opens Document Review)
- "Mark all as read" button at top of dropdown
- Notifications are scoped to the user's law firm (tenant isolation)
- No email or SMS notifications in v1 — in-app only

### Notification storage
- `notifications` table: id, user_id, law_firm_id, case_id, type, message, link, is_read, created_at
- Query: unread notifications for current user, ordered by created_at desc, limit 50

---

## Responsive Behavior

| Breakpoint | Layout changes |
|---|---|
| Desktop (≥1024px) | Sidebar nav, split-view document review, right sidebar for AI review |
| Tablet (768–1023px) | Sidebar collapses to icons, document review stacks vertically, AI review becomes overlay |
| Mobile (<768px) | Top bar nav (hamburger menu) with left slide-out sidebar drawer + backdrop, full-width single column, card layouts for tables, AI review as bottom sheet |

---

## Open Questions

### Documents view
1. If joint filing, does the spouse need separate pay stubs / tax returns / ID tracked independently, or combined progress within the same category?
2. What does extraction look like for ID documents — is data pulled from them, or is classification enough?
3. Do optional categories show "none" state or stay collapsed until the client uploads something?
4. Can the client see extraction details on documents (read-only), or staff-only?

### Questionnaire view
5. Confirm: questionnaire locks to read-only when case status is "filed"?

### Staff Dashboard
6. Does the paralegal only see their assigned clients, or all firm clients?
7. Summary stats row above the table? (e.g., "12 awaiting documents, 3 ready to file")

### Admin view
8. Can admin create other admin accounts?
9. Can admin create client accounts, or only through the intake flow?
10. Is there anything beyond account management? (billing config, notification settings?)

### Cross-cutting
11. Should there be any distinction between paralegal and attorney capabilities? Current spec treats them identically except attorneys can change case status.
