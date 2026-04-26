# UI Validation Plan

> **Owner:** Engineering  
> **Last reviewed:** 2026-04-25  
> **Status:** Active — run after any UI changes  
> **Related:** [ui-patterns.md](ui-patterns.md) (component rules), [ui-requirements.md](ui-requirements.md) (behavior specs)

End-to-end validation sequence for the LegalEagle frontend. Run this after any UI changes to verify views render correctly.

## Browser Tooling

This plan supports three tiers of browser automation. Use the best available:

### Tier 1: Chrome DevTools MCP (full interactive)
- **Tools**: `mcp__chrome-devtools__*` (navigate, click, fill, screenshot, snapshot, evaluate, network)
- **Check availability**: `mcp__chrome-devtools__list_pages` — if it returns pages, use this tier
- **Setup**: Open Chrome with remote debugging: `open -a "Google Chrome" --args --remote-debugging-port=9222`
- **Capabilities**: Full DOM interaction, screenshots, network inspection, console logs

### Tier 2: Playwright MCP (headless interactive)
- **Tools**: `mcp__playwright__*` (navigate, click, fill, screenshot, evaluate)
- **Check availability**: search for tools matching `mcp__playwright`
- **Capabilities**: Headless browser, full DOM interaction, screenshots, assertions

### Tier 3: API-only validation (always available)
- **Tools**: `run_in_terminal` with `curl`, `open_browser_page` (VS Code simple browser, visual-only), `fetch_webpage`
- **Capabilities**: API response validation, visual spot-checks (no DOM interaction)
- **Limitation**: Cannot click, fill forms, or inspect CSS — only verifies server behavior

When running this plan, attempt tiers in order. Fall back gracefully and note which tier was used in results.

## Prerequisites

1. **Dev server running**: Client on `:5173`, server on `:3001`. If the server was restarted or code was changed, verify the server process is running the latest code:
   ```
   # Check if server is running
   ps aux | grep 'tsx.*server' | grep -v grep

   # If stale or not running, restart:
   kill <pid>
   cd server && npx tsx src/index.ts &
   ```

2. **Browser tooling**: Check which tier is available (see above). For Tier 3, only `curl` is needed.

3. **Test credentials** (dev mode — no passwords required):

   | Login page | Email | Name | Role |
   |---|---|---|---|
   | `/login` | `admin@hartfordlegal.com` | Sarah Chen | admin |
   | `/login` | `attorney@hartfordlegal.com` | James Wilson | attorney |
   | `/login` | `paralegal@hartfordlegal.com` | Maria Lopez | paralegal |
   | `/client-login` | `rmartinez78@gmail.com` | Robert Martinez | client |
   | `/client-login` | `athompson@email.com` | Angela Thompson | client |
   | `/client-login` | `dkim.bk@gmail.com` | David Kim | client |

---

## Validation Sequence

### 1. Staff Login

**Tier 1/2 (interactive)**:
```
navigate → http://localhost:5173/login
snapshot/screenshot → verify login form renders (email input, sign in button)
fill email → admin@hartfordlegal.com
click → Sign in
snapshot/screenshot → verify redirect to /staff/dashboard
```

**Tier 3 (API-only)**:
```bash
# Login via API
curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hartfordlegal.com","password":""}' | python3 -m json.tool
# Save token for subsequent requests
ADMIN_TOKEN="dev-user-admin-001"

# Visual spot-check (opens in VS Code simple browser)
open_browser_page → http://localhost:5173/login
```

**Check**: Login returns token + user object with role=admin. Page loads without errors.

---

### 2. Staff Dashboard (`/staff/dashboard`)

**Tier 1/2 (interactive)**:
```
screenshot → visual check
snapshot → structural check
```

**Tier 3 (API-only)**:
```bash
curl -s http://localhost:3001/api/cases -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -m json.tool
# Verify: returns array of cases with id, clientFirstName, clientLastName, chapter, status, filingDate, createdAt
# Verify: statuses include intake, documents, review, discharged
```

**Check**:
- `PageHeader` renders: "Cases" heading + total count + "New Client" button
- `DataTable` renders with columns: Client, Chapter, Status, Filing Date, Created
- `StatusBadge` colors correct: intake=blue, documents=yellow, review=purple, discharged=gray
- Status filter pills present and clickable
- Click a filter → table filters correctly
- Client names are links to `/staff/case/:id`

**Empty state test** (Tier 1/2 only):
- Filter to a status with 0 matching cases
- Verify `EmptyState` renders ("No cases found.") instead of empty table headers

---

### 3. Clients List (`/staff/clients`)

**Tier 1/2 (interactive)**:
```
click → "Clients" nav link
screenshot → visual check
```

**Tier 3 (API-only)**:
```bash
curl -s http://localhost:3001/api/clients -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -m json.tool
# Verify: returns array with id, firstName, lastName, email, phone, createdAt
```

**Check**:
- `PageHeader` renders: "Clients" heading + "New Client" button
- `DataTable` renders with columns: Name, Email, Phone, Created
- Names are links to `/staff/clients/:id`
- Nullish fields show "—" (not empty string or "null")

---

### 4. Client Detail (`/staff/clients/:id`)

**Tier 1/2 (interactive)**:
```
click → a client name (e.g., Angela Thompson, client-002)
screenshot → visual check
```

**Tier 3 (API-only)**:
```bash
# Client detail
curl -s http://localhost:3001/api/clients/client-002 -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -m json.tool
# Verify: Angela Thompson's details

# Server-side case filtering (CRITICAL)
curl -s 'http://localhost:3001/api/cases?clientId=client-002' -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -m json.tool
# Verify: exactly 2 cases (case-002 intake, case-004 discharged), NOT all cases
```

**Check**:
- "Back to Clients" link present
- `PageHeader` renders: client name + subtitle (email, phone, date joined with · separators)
- "New Case" button present
- Cases table shows ONLY this client's cases (server-side `?clientId=` filter)
  - Angela Thompson should have exactly 2 cases, not all cases
- `StatusBadge` colors correct in cases table

**Verify server-side filtering** (Tier 1 only):
```
list_network_requests → find GET /api/cases?clientId=client-002
get_network_request → verify response has only 2 cases
```

---

### 5. Admin Settings (`/admin/settings`)

**Tier 1/2 (interactive)**:
```
click → "Settings" nav link
screenshot → visual check
```

**Tier 3 (API-only)**:
```bash
# Verify admin identity
curl -s http://localhost:3001/api/auth/me -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -m json.tool
# Verify: returns userId, name, email, role=admin
```

**Check**:
- `PageHeader` renders: "Settings"
- Three `Card` components render with `CardHeader` titles:
  - "Current User" — shows name, email, role
  - "User Management" — placeholder text
  - "Firm Settings" — placeholder text
- Only visible for admin role (Tier 1/2: test with paralegal login to verify it's hidden)

---

### 6. Case View + Questionnaire (`/staff/case/:id`)

**Tier 1/2 (interactive)**:
```
navigate → http://localhost:5173/staff/case/case-001
screenshot → visual check
```

**Tier 3 (API-only)**:
```bash
# Case detail with embedded questionnaire
curl -s http://localhost:3001/api/cases/case-001 -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'Case: {data[\"id\"]} | Status: {data[\"status\"]} | Chapter: {data[\"chapter\"]}')
q = data.get('questionnaire', {})
if q:
    d = json.loads(q['data']) if isinstance(q.get('data'), str) else q.get('data', {})
    print(f'Questionnaire: {q[\"id\"]} | Fields: {len(d)} keys')
    print(f'Name: {d.get(\"fullName\", \"?\")}')
"
```

**Check**:
- "Back to Dashboard" link present
- "Bankruptcy Questionnaire" heading with Save, Download, Review buttons
- Documents panel (collapsible) with upload drop zone
- Section 1 expanded with form fields (Robert James Martinez pre-filled)
- All 27 section headers visible as collapsible buttons
- Sections without findings have standard `border` (no colored border)

---

### 7. AI Review + Severity Indicators

**Tier 1/2 (interactive)**:
```
click → "Review" button
wait for AI review to complete (screenshot to check progress)
screenshot → verify findings panel
```

**Tier 3 (API-only)**:
```bash
# Trigger AI review
curl -s -X POST http://localhost:3001/api/forms/quest-001/review \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" | python3 -c "
import sys, json
data = json.load(sys.stdin)
findings = data.get('findings', [])
errors = sum(1 for f in findings if f.get('severity') == 'error')
warnings = sum(1 for f in findings if f.get('severity') == 'warning')
info = sum(1 for f in findings if f.get('severity') == 'info')
print(f'Findings: {len(findings)} total ({errors} errors, {warnings} warnings, {info} info)')
for f in findings:
    print(f'  [{f[\"severity\"]}] Section: {f.get(\"section\",\"?\")} — {f.get(\"title\",\"?\")[:80]}')
"
# Verify: mix of error, warning, info findings with section references
```

**Check**:
- ReviewPanel opens on the right side
- Loading state: "Analyzing questionnaire..." with spinner
- Findings render with correct severity styling (from shared `SeverityIcon`/`SEVERITY_STYLES`):
  - **Error**: red icon, `bg-red-50` background, `border-red-200` border, `text-red-600` label
  - **Warning**: amber icon, `bg-amber-50` background, `border-amber-200` border, `text-amber-600` label
  - **Info**: blue icon, `bg-blue-50` background, `border-blue-200` border, `text-blue-600` label
- Footer summary: "X errors, Y warnings, Z info"
- "Click a finding to jump to that section" instruction text

**Scroll to verify all severities** (Tier 1/2 only):
```
evaluate_script → scroll the review panel to bottom
screenshot → verify warnings and info findings render
```

**Check section severity indicators** (Tier 1/2 only):
```
evaluate_script → scroll main content to see section list
screenshot → verify sections with findings have colored borders + severity dots
```
- Sections with error findings: `border-red-200 border-2` + red `SeverityIcon`
- Sections with warning findings: `border-amber-200 border-2` + amber `SeverityIcon`
- Sections without findings: standard `border` (no colored border, no dot)

---

### 8. Document Review Panel (if documents exist)

**Tier 3 (API-only)**:
```bash
curl -s 'http://localhost:3001/api/documents?caseId=case-001' \
  -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -m json.tool
# If empty array, skip visual checks — no documents uploaded for this case
```

**Tier 1/2 (interactive)** — if the case has uploaded documents:
```
click → Documents section to expand
click → a document row to open DocumentReviewPanel
screenshot → visual check
```

**Check**:
- Document classification badge renders
- `ProcessingStatusBadge` shows correct status
- `ConfidenceScore` renders with correct color (green ≥0.9, amber 0.7–0.89, red <0.7)
- Validation warnings use `SeverityIcon` (not hardcoded icons)
- Accept/Edit buttons render for `needs_review` status

---

### 9. Client Portal Login + Dashboard

**Tier 1/2 (interactive)**:
```
navigate → http://localhost:5173/client-login
fill email → rmartinez78@gmail.com
click → Sign in
screenshot → verify client dashboard
```

**Tier 3 (API-only)**:
```bash
# Client login
curl -s -X POST http://localhost:3001/api/auth/client/login \
  -H "Content-Type: application/json" \
  -d '{"email":"rmartinez78@gmail.com","password":""}' | python3 -m json.tool
CLIENT_TOKEN="dev-client-client-001"

# Client sees only own cases
curl -s http://localhost:3001/api/client-portal/cases \
  -H "Authorization: Bearer $CLIENT_TOKEN" | python3 -m json.tool
# Verify: returns ONLY Robert Martinez's case(s), not all cases

# Client CANNOT access staff endpoints (security check)
curl -s -w "\nHTTP %{http_code}" http://localhost:3001/api/cases \
  -H "Authorization: Bearer $CLIENT_TOKEN"
# Verify: returns 403 Forbidden
```

**Check**:
- Client layout: top bar with logo, user name, sign out
- Welcome message: "Welcome, Robert Martinez"
- Case cards with: Chapter, status label, View/Continue link
- Client sees only their own cases
- Client cannot access `/api/cases`, `/api/clients`, or `/api/documents` (403)

---

### 10. Client Case View

**Tier 1/2 (interactive)**:
```
click → a case card
screenshot → visual check
```

**Tier 3 (API-only)**:
```bash
# Client can view own case detail
curl -s http://localhost:3001/api/client-portal/cases/case-001 \
  -H "Authorization: Bearer $CLIENT_TOKEN" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'Case: {data.get(\"id\")} | Status: {data.get(\"status\")}')
q = data.get('questionnaire', {})
if q: print(f'Questionnaire: {q.get(\"id\")} | Name: {q.get(\"name\")}')
"

# Client CANNOT view other client's case (security check)
curl -s -w "\nHTTP %{http_code}" http://localhost:3001/api/client-portal/cases/case-002 \
  -H "Authorization: Bearer $CLIENT_TOKEN"
# Verify: returns 404 Not Found
```

**Check**:
- Questionnaire renders in client mode (no Review/Download buttons)
- Progress bar visible
- Form fields editable
- Documents panel accessible
- Client cannot access another client's case (404)

---

## Quick Smoke Test (Minimum)

If time is short, run only these steps:

1. **Login** → staff dashboard loads
2. **Dashboard** → table renders with status badges
3. **Client Detail** → server-side filtering works (correct case count)
4. **Admin Settings** → Card components render
5. **Case View** → questionnaire loads, AI review produces severity-colored findings

---

## Common Issues

| Symptom | Likely cause | Fix |
|---|---|---|
| All cases show under one client | Server running stale code | Restart: `kill <pid> && cd server && npx tsx src/index.ts &` |
| Status badges are plain gray | `StatusBadge` not imported, using raw text | Check import from `@/components/ui/status-badge` |
| Severity colors wrong or missing | Hardcoded colors instead of shared `SEVERITY_STYLES` | Use `SeverityIcon`/`SeverityCard` from `@/components/ui/severity-indicator` |
| Empty table shows headers with no rows | `emptyState` prop not passed to `DataTable` | Pass `emptyState={<EmptyState message="..." />}` |
| Login redirects back to login | Server not running or token expired | Check server process, clear localStorage |
| Page is blank white | Build error or runtime crash | Check browser console (Tier 1: `mcp__chrome-devtools__list_console_messages`) |
| Schema error on server start | DB out of sync with Drizzle schema | `rm -f server/data/legaleagle.db && cd server && npx drizzle-kit push` then restart |
| Client sees all cases at `/api/cases` | Missing `requireStaff` middleware | Ensure `/api/cases`, `/api/clients`, `/api/documents` use `requireStaff` in `server/src/index.ts` |
| Chrome MCP tools not found | Chrome not open or no `--remote-debugging-port` | `open -a "Google Chrome" --args --remote-debugging-port=9222` |
| Playwright MCP tools not found | Playwright MCP server not configured | Add to VS Code MCP settings; fall back to Tier 3 |
