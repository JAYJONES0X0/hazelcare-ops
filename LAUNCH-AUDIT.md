# HAZELCARE OPS — OFFICIAL LAUNCH AUDIT
**Platform**: https://hazelcare-ops.vercel.app
**Audit Date**: 17 March 2026
**Prepared for**: Jay / Hazelcare Management
**Purpose**: Pre-launch test run — page-by-page operational readiness assessment

---

## SYSTEM OVERVIEW

Hazelcare Ops is a browser-based operational intelligence platform for supported living services. It ingests weekly Nourish CSV exports and transforms raw care diary data into actionable management intelligence — flags, reports, compliance tracking, templates, and AI-assisted documentation tools.

**Architecture**: React/TypeScript SPA | localStorage persistence | No backend | Vercel hosted
**Data source**: Nourish CSV exports (UTF-8, RFC 4180 format)
**Scale tested**: 637 entries | 48 clients | 10 houses | 38 red flags | 87 amber flags

---

## PAGE-BY-PAGE AUDIT

---

### 1. BRIEFING — Morning Briefing
**Route**: Default landing page
**Status**: ✅ Functional | ⚠️ Layout is basic

#### What it does
Generates an at-a-glance morning brief for the manager on shift. Shows: today's red/amber flag count, any incidents logged, actions due today, and a top-5 priority client list ranked by concern level.

#### When to use
- **Every morning** before handover or team briefing
- First thing a manager should see when opening the platform

#### How to use
1. Open https://hazelcare-ops.vercel.app — briefing loads automatically
2. Review red flag count and top priority clients
3. Use "View Details" links to jump directly to flagged entries
4. Check outstanding actions and incidents needing follow-up

#### Known limitations
- Layout is functional but sparse — no visual hierarchy for urgency levels
- Does not show today's date/shift summary header
- Priority client list is purely flag-count based (no weighting for severity)

#### Readiness: 7/10 — Good enough for test run

---

### 2. DASHBOARD — Weekly Intelligence Hub
**Route**: `dashboard`
**Status**: ✅ Functional | ⚠️ Entry text truncated

#### What it does
Full-week data view. Shows: total entries by house, red/amber breakdown, entry type distribution (pie/bar), most active clients, carer activity summary, and a scrollable recent flags feed.

#### When to use
- **Weekly**: After importing new Nourish data — first review stop
- **Mid-week**: Quick health check across all houses
- **Before CQC visits**: Overview of care activity patterns

#### How to use
1. After importing CSV (Upload page), you are redirected here automatically
2. Use house filter to drill into one location
3. Click any flag tile to jump to the Reports → Flag Report
4. Scroll to "Recent Flags" to spot overnight entries needing attention

#### Known limitations
- Flag entry text is shown truncated (40–60 chars) — full text only visible in Reports
- No date range selector — always shows the full import period
- House breakdown shows entry counts not unique clients

#### Readiness: 8/10 — Solid core view

---

### 3. IMPORT DATA — Upload / CSV Ingestion
**Route**: `upload`
**Status**: ✅ Fully functional

#### What it does
Accepts Nourish weekly CSV exports via drag-and-drop or file picker. Auto-processes immediately on drop — no button click needed. Shows a parsed summary: total entries, clients found, red flags, amber flags, and top 8 priority clients ranked by concern level.

#### When to use
- **Every Monday** (or whenever a new Nourish export is run)
- Any time you want to refresh the data from a new week's export

#### How to use
1. In Nourish: Reports → Export → Weekly Diary Entries → CSV
2. Go to Import Data page
3. Drag the `.csv` file onto the drop zone — OR click to pick file
4. Results appear instantly: flag summary + top priority clients
5. Platform redirects to Dashboard automatically

#### File format
- Nourish CSV export (UTF-8 encoded)
- Must include columns: Client Name, Entry Type, Entry Date, Carer, Entry Text
- TSV (tab-separated) also accepted

#### Known limitations
- Paste-text fallback is available under "Or paste manually" (collapsed by default)
- Large files (1000+ entries) may take 1–2 seconds to parse
- Previous week's data is fully replaced on new import

#### Readiness: 10/10 — Production ready

---

### 4. CLIENT DIARY — Per-Client Timeline
**Route**: `client-diary`
**Status**: ✅ Functional

#### What it does
Full diary timeline for individual clients. Filter by client name to see all their entries for the week, sorted chronologically. Each entry shows: date, type, carer, entry text, and any flags triggered. Expandable for full text.

#### When to use
- **Before key worker sessions** — review the client's full week
- **Before care reviews or MDT meetings** — compile timeline evidence
- **When a concern is raised** — trace full context across the week

#### How to use
1. Navigate to Client Diary
2. Use the client dropdown to select a resident
3. Scroll through chronological entries
4. Expand any entry for full text
5. Use the Print button to generate a printable client diary

#### Known limitations
- Client list is derived from import data — not a permanent register
- No date range filter (shows entire import period)
- Print view is functional but minimal styling

#### Readiness: 8/10 — Ready for test run

---

### 5. RISK SCORES — Client Risk Register
**Route**: `risk`
**Status**: ✅ Functional

#### What it does
Auto-generates a risk score for each client based on their entry data. Scores are calculated from: frequency of red/amber flags, safeguarding entries, incident mentions, medication concerns. Displays a ranked table with traffic light indicators.

#### When to use
- **Weekly**: Review after each import to catch deteriorating clients
- **Before team meetings**: Identify who needs immediate support planning
- **Audits**: Evidence of systematic risk monitoring

#### How to use
1. Import CSV data first
2. Navigate to Risk Scores
3. Table auto-populates ranked highest risk first
4. Click any client row to jump to their diary entries
5. Use Export button to download as CSV for records

#### Known limitations
- Risk algorithm is keyword-based — not clinically validated
- Does not account for baseline risk (new client vs. long-term stable)
- No historical trend (only shows current import period)

#### Readiness: 7/10 — Good operational tool, note algorithm is indicative not clinical

---

### 6. ACTIONS — Action Tracker
**Route**: `actions`
**Status**: ✅ Fully functional

#### What it does
Full CRUD action management. Log, assign, track, and close operational actions. Each action has: title, description, assigned staff member, due date, priority (High/Medium/Low), status (Open/In Progress/Closed), and linked house/client.

#### When to use
- **Continuously**: Log actions as they arise from any page
- **Daily handover**: Review open actions before shift change
- **Weekly management**: Audit open vs. closed actions

#### How to use
1. Click "+ New Action" to log an action
2. Fill: title, description, assigned to, due date, priority, house
3. Actions persist in localStorage — survive page refreshes
4. Filter by house, priority, or status using the filter bar
5. Click any action to update status or add notes

#### Data persistence
All actions saved to `localStorage` — survives browser close. Clear only if you manually clear browser data.

#### Readiness: 9/10 — Production ready

---

### 7. INCIDENTS — Incident Log
**Route**: `incidents`
**Status**: ✅ Fully functional

#### What it does
Formal incident recording system. Each incident has: incident type (Safeguarding/Behaviour/Medical/Property/Other), date/time, location, client, staff involved, description, immediate action taken, reported to (CQC/LA/Police), and status.

#### When to use
- **Immediately** when an incident occurs
- **Post-shift**: Log incidents from the shift before handover
- **Monthly**: Review incident patterns per house

#### How to use
1. Click "+ Log Incident"
2. Select incident type and fill all required fields
3. Mark "Reported to" checkboxes as applicable
4. Incidents are logged with timestamp
5. View incident log filtered by house, type, or date range
6. Each incident can be updated as investigation progresses

#### Readiness: 9/10 — Production ready

---

### 8. STAFF REGISTER — Staff Directory
**Route**: `staff`
**Status**: ⚠️ Partially built — display only

#### What it does
Shows a staff directory pulled from mock/imported data. Lists staff name, role, house, shift pattern.

#### What it DOESN'T do yet
- Cannot add/edit staff from this page
- Not linked to Compliance page's staff register
- No contact details, emergency contacts
- No supervision or DBS tracking (that's in Compliance)

#### When to use (current state)
- Quick reference for who is assigned to which house
- Overview of staffing levels per location

#### Known gap
Staff data in this page comes from mock data or CSV carers — not a live managed register. The Compliance page has a proper staff register with DBS/training dates. These two pages are not yet linked.

#### Readiness: 4/10 — Needs rebuild to link with CompliancePage staff register

---

### 9. NOTE ASSISTANT — Staff Note Builder
**Route**: `notes`
**Status**: ✅ Fully functional — all 43 Nourish types

#### What it does
Guided note-writing assistant. Select from all 43 Nourish diary entry types (matching the real platform dropdown exactly). Each type loads a structured prompt with guided fields: context, what happened, response, outcome, next steps. Generates a ready-to-paste Nourish-formatted entry.

#### Entry type groups
- **Client Notes**: Daily living, personal care, activity, behaviour, ABC chart, PBS, SALT, physio, OT, keyworker session, support planning, goal review, care review, positive behaviour, mental health, hospital visit, GP appointment, district nurse
- **Staff & Carer Notes**: Handover, supervision, probation review, return to work, PIP, exit interview, medication administration, medication refusal, PRN administration, controlled drug check, medication audit
- **Meeting Minutes**: Team meeting, house meeting, MDT, best interests, DOLS, safeguarding strategy, professionals meeting, family meeting, care and support review

#### When to use
- **Any time a carer needs to write a Nourish entry** and wants structure/prompting
- **Training**: Show new staff how to write quality notes
- **Supervision**: Demonstrate entry quality standards

#### How to use
1. Navigate to Note Assistant
2. Search or browse entry types by group
3. Select the type you need
4. Guided form appears — fill in the prompted fields
5. Copy the generated text → paste into Nourish

#### Readiness: 10/10 — Production ready

---

### 10. HANDOVER — Shift Handover
**Route**: `handover`
**Status**: ⚠️ Basic form — functional but limited

#### What it does
A form-based shift handover tool. Manager or senior fills in: outgoing shift summary, key events, medication administered, clients of concern, outstanding tasks, and what is being carried forward. Generates a printable handover document.

#### When to use
- **End of every shift**: Senior completes before leaving
- **Morning briefing**: Print and distribute to incoming team

#### How to use
1. Navigate to Handover
2. Fill in each section
3. Click Print to generate PDF
4. Hand to incoming shift leader

#### Known limitations
- Not pre-populated from diary data (manual entry only)
- No draft save between sessions
- Basic print styling

#### Readiness: 6/10 — Functional for test run, needs auto-population from diary data

---

### 11. TEMPLATES — Document Generator
**Route**: `templates`
**Status**: ✅ Fully functional — 8 generators

#### What it does
Generates 8 professional, print-ready documents from your imported data. Each template auto-populates with real client and entry data.

| Template | What it generates |
|----------|------------------|
| Weekly Summary Report | Full week overview: flag tables, house breakdown, entry type stats |
| Handover Report | Client-by-client update, outstanding tasks, medications |
| Supervision Form | Workload review, performance ratings, training expiry table |
| Safeguarding Report | All safeguarding entries, referral checkboxes, CONFIDENTIAL marking |
| Daily Quality Check | Overnight summary, today's priorities, flagged entries |
| Medication Audit | Per-house medication tables, discrepancy detection |
| Finance Audit | Per-house finance entries, petty cash blocks, client accounts |
| Incident Summary | All incidents with narrative format |

#### When to use
- **Weekly**: Generate Weekly Summary after each Monday import
- **Monthly**: Medication Audit, Finance Audit
- **As needed**: Safeguarding Report when a concern is raised
- **CQC preparation**: Print multiple templates as evidence bundle

#### How to use
1. Import CSV data first (templates use live data)
2. Navigate to Templates
3. Click any template card
4. Document opens in print preview (iframe)
5. Click Print — browser print dialog opens
6. Save as PDF or print physical copy

#### Readiness: 9/10 — Production ready

---

### 12. REPORTS — Data Analysis & Exports
**Route**: `reports`
**Status**: ✅ Fully functional — 5 report types

#### Report types

**1. Weekly Summary Report**
Full printable HTML report. Red/amber flag tables, house breakdown, entry type distribution.
*Use for: weekly management review, CQC evidence file*

**2. Flag Report**
Filter all red/amber flags. Expandable entry cards with full text, carer, date.
*Use for: daily risk review, safeguarding scanning*

**3. House Detail Report**
Select a house — see all entries broken into 8 categories: Incidents, Safeguarding, Medication, Behaviour, Activities, Personal Care, Communication, Other.
*Use for: house manager reviews, inspections*

**4. Entry Log Report**
Full searchable log. Filter by house, entry type, severity. Export up to 200 entries as CSV.
*Use for: data extraction, audit trails, commissioner reports*

**5. Staff Activity Report**
Grouped by carer. Expand to see every entry they made with severity indicators.
*Use for: supervisions, carer performance review*

#### When to use
- **Daily**: Flag Report — scan overnight entries
- **Weekly**: Weekly Summary + House Detail per house
- **Monthly**: Entry Log export for records
- **Supervisions**: Staff Activity report for the carer being reviewed

#### How to use
1. Select report type from the top tabs
2. Apply filters as needed
3. Use Print/Export buttons on each report
4. Flag Report: click any entry card to expand full text

#### Readiness: 9/10 — Production ready

---

### 13. COMPLIANCE — Compliance Tracker
**Route**: `compliance`
**Status**: ✅ Fully functional — 3 tabs

#### What it does
Tracks compliance across staff and houses. Three tabs:

**Overview tab**
Traffic light dashboard for all 10 houses × 5 audit types (Medication, Fire Safety, Finance, CQC Readiness, H&S). Also shows staff compliance summary: how many staff are overdue on DBS, training, or supervision.

**Staff Register tab**
Full staff compliance register. Add/edit each staff member with:
- DBS expiry date
- Mandatory training expiry date
- Next supervision date + frequency
- Role and house assignment

Auto-calculates status: Green (OK) / Amber (due within 30 days) / Red (overdue)

**Audit Log tab**
Record completed audits per house and type. Shows history with: completed date, due date, completed by, and notes. Auto-calculates when next audit is due based on frequency (4 weeks for most, 13 weeks for CQC).

#### When to use
- **Weekly**: Check Overview for any new reds
- **Monthly**: Log all completed audits in Audit Log
- **Staff changes**: Add new staff immediately when they join
- **CQC inspection**: Screenshot Overview as real-time compliance evidence

#### How to use
1. Navigate to Compliance
2. **Add staff**: Staff Register → "+ Add Staff Member" → fill DBS/training dates
3. **Log audit**: Audit Log → "+ Log Audit" → select house, type, dates
4. **Monitor**: Overview tab auto-updates based on your records

#### Data persistence
All compliance data saved to `localStorage` — survives page refresh. Separate from diary import data — not wiped on new CSV import.

#### Readiness: 9/10 — Production ready

---

### 14. CLIENT DOCS — Document Library
**Route**: `client-docs`
**Status**: ⚠️ Placeholder — display only

#### What it does currently
Shows a document library UI with category cards (Care Plans, Risk Assessments, PBS Plans, Consent Forms, etc.). Clicking a category shows a file list. Files are mock/static — cannot upload real documents.

#### What it DOESN'T do yet
- Cannot upload actual PDF/Word documents
- Files shown are placeholder names, not real content
- No link to client records or diary data
- No expiry tracking for documents

#### When to use (current state)
- Demonstration only — shows the intended structure
- Not suitable for storing real client documents yet

#### Roadmap
To make this production-ready: add file upload (Supabase Storage or similar), link documents to clients, add review dates, alert on expired documents.

#### Readiness: 2/10 — Placeholder only, do not use for real documents

---

## OVERALL SYSTEM READINESS

| Page | Status | Readiness |
|------|--------|-----------|
| Briefing | ✅ Functional | 7/10 |
| Dashboard | ✅ Functional | 8/10 |
| Import Data | ✅ Production ready | 10/10 |
| Client Diary | ✅ Functional | 8/10 |
| Risk Scores | ✅ Functional | 7/10 |
| Actions | ✅ Production ready | 9/10 |
| Incidents | ✅ Production ready | 9/10 |
| Staff Register | ⚠️ Partial | 4/10 |
| Note Assistant | ✅ Production ready | 10/10 |
| Handover | ⚠️ Basic | 6/10 |
| Templates | ✅ Production ready | 9/10 |
| Reports | ✅ Production ready | 9/10 |
| Compliance | ✅ Production ready | 9/10 |
| Client Docs | ❌ Placeholder | 2/10 |

**Overall system readiness: 8/10** — Production capable for core operations

---

## TEST RUN PROTOCOL

### Step 1 — Data import (5 mins)
1. Export this week's Nourish data as CSV
2. Go to https://hazelcare-ops.vercel.app → Import Data
3. Drop the CSV file — confirm entry count and flag totals match expectation

### Step 2 — Flag review (10 mins)
1. Dashboard → check red/amber totals
2. Reports → Flag Report → review all red flags, confirm they match Nourish
3. Note any flags that should have been caught by Nourish but weren't

### Step 3 — House drill-down (15 mins)
1. Reports → House Detail Report
2. Cycle through each house
3. Confirm entries are correctly categorised
4. Check for any entries in "Other" that should be in a specific category

### Step 4 — Compliance setup (20 mins)
1. Compliance → Staff Register
2. Add all staff with their real DBS and training expiry dates
3. Log the most recent audit for each house × type combination
4. Screenshot the Overview tab — confirm traffic lights look right

### Step 5 — Template test (10 mins)
1. Templates → Weekly Summary Report → Print
2. Verify data matches what you see in the Dashboard
3. Try Safeguarding Report — confirm it pulls correct entries

### Step 6 — Note Assistant test (5 mins)
1. Note Assistant → search "ABC Chart"
2. Fill in the guided form
3. Copy the output → paste into Nourish to confirm it's formatted correctly

### Step 7 — Actions and Incidents (5 mins)
1. Log one test action, assign to a staff member, set a due date
2. Log one test incident — confirm it saves and appears in the log

---

## KNOWN ISSUES FOR V2

| Priority | Issue | Page | Fix |
|----------|-------|------|-----|
| High | Staff Register not linked to Compliance | Staff / Compliance | Merge into single source of truth |
| High | Client Docs is placeholder only | Client Docs | Supabase Storage integration |
| Medium | Handover not auto-populated from diary | Handover | Pull client concerns from weekData |
| Medium | Briefing layout needs urgency hierarchy | Briefing | Visual redesign with severity tiers |
| Low | Dashboard entry text truncated | Dashboard | Add expandable cards |
| Low | Risk algorithm not clinically weighted | Risk Scores | Add configurable weight matrix |

---

## DATA AND PRIVACY NOTES

- **All data is stored locally** in the user's browser (localStorage)
- No data is transmitted to any server
- Clearing browser data clears all compliance records, actions, and incidents
- Diary entries only persist until the next CSV import (they are replaced)
- **Recommendation**: Export action and compliance records monthly for backup
- Not GDPR-registered as a data processor — running as an internal tool only

---

## SIGN-OFF

**Platform URL**: https://hazelcare-ops.vercel.app
**Build date**: 17 March 2026
**Audit by**: Arbigent / EXA
**Status**: APPROVED FOR TEST RUN

Pages ready for live use:
- Import Data ✅
- Note Assistant ✅
- Templates ✅
- Reports ✅
- Compliance ✅
- Actions ✅
- Incidents ✅

Pages ready with caveats:
- Dashboard ✅ (text truncation minor)
- Briefing ✅ (basic layout)
- Client Diary ✅ (no date filter)
- Risk Scores ✅ (algorithm indicative only)
- Handover ✅ (manual entry only)

Pages NOT ready for live use:
- Staff Register ❌ (use Compliance → Staff Register instead)
- Client Docs ❌ (placeholder only)

---

*This document should be reviewed and updated after each test run session.*
