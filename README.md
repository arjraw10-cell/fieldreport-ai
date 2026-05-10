# FieldReport AI

**Evidence-grounded incident documentation agent that automates public-safety report drafting by combining current-case evidence with learned department report patterns.**

Built for the 🧠 **Company Brain** track at the Nozomio Hackathon.

---

## What it does

FieldReport AI takes raw evidence from a police incident — bodycam transcripts, dispatch logs, officer field notes — and drafts a complete, citation-backed incident report that matches how that specific department writes reports.

The critical insight: **every police department has a brain.** It lives in thousands of past reports, supervisor feedback on Slack, policy emails, and SOPs. But when an officer writes a report at 2 AM, they can't access any of it. FieldReport AI connects to those sources, indexes them, and uses that institutional knowledge to draft reports that supervisors actually approve — not generic templates that get sent back for revision.

### The core loop

1. **Ingest** — Hyperspell connects to Google Drive (past reports), Slack (supervisor feedback), Gmail (policy emails) and pulls everything into one place
2. **Index** — Nia indexes all ingested data so the agent can run semantic searches like "what does Sgt. Rodriguez require in DUI reports?"
3. **Process** — Tensorlake processes current-case evidence in background sandboxes with durable memory (new evidence integrates into the same case state, no reprocessing)
4. **Draft** — The agent queries Nia for department context, then drafts a report using current-case facts shaped by department style, policy, and supervisor preferences
5. **Review** — Officer reviews, edits, approves. Every change is tracked in an audit trail
6. **Export** — Supervisor-ready case packet with the final report, evidence index, citations, flags, and full audit trail

### What makes this a "company brain"

**Removing the brain breaks the demo.** Without Hyperspell + Nia, the agent writes a generic report:

| Field | Without Brain | With Brain |
|-------|--------------|------------|
| SFST | "failed field sobriety tests" | "HGN 6/6, Walk and Turn 4/8, One Leg Stand 3/4" — per Sgt. Rodriguez |
| Miranda | "Miranda rights were read" | "Administered at 0154 hours by Officer Chen. Suspect stated: 'I understand and I want a lawyer.'" — per Legal Division |
| Vehicle | "White SUV, plate 8XYZ321" | "white 2021 Ford Escape, CA 8XYZ321" — per Rodriguez vehicle directive |
| Charges | "DUI" | "CVC 23152a, CVC 23152b" — from past report patterns |
| Policy checks | None | 3 compliance checks passed |

The brain is load-bearing. It's not a logo on the page — it's what makes the report approvable.

---

## Features

### Evidence-grounded drafting
Every factual claim in the draft links back to a specific evidence source — bodycam transcript timestamp, dispatch log entry, or officer notes. Click any citation marker to see the original text.

### Contradiction detection
Cross-references all evidence sources and flags conflicts. Demo: dispatch classified the call as "Hit and Run" but bodycam shows the driver remained at the scene.

### Missing-info detection
Checks the draft against department requirements and flags what's missing — with a suggested follow-up question for the officer and the specific policy or supervisor preference that requires it.

### Policy compliance
Automatically checks the draft against current department policies. Verifies SFST clue counts per Sgt. Rodriguez's Slack feedback, Miranda documentation per Legal Division email, vehicle descriptions per Rodriguez's directive.

### With/without brain comparison
Runs two drafts side-by-side: one with Hyperspell + Nia context (department-aware), one without (generic). Demonstrates that removing the brain produces a report that would be sent back for revision.

### Cross-session context (Nia)
Evidence processing (Tensorlake) saves findings to Nia. Report drafting retrieves those findings so it knows what evidence exists. This is how agents share context across sessions.

### Audit trail
Logs every action: what the AI drafted for each field, what evidence supported it, what the human edited, and what was approved. Shows AI → human diffs per field with color-coded badges.

### Case packet export
One-click export of a supervisor-ready case packet with the final report, evidence index, citations, flags, and full audit trail.

---

## Tech Stack

| Layer | Tool | Role |
|-------|------|------|
| Data ingestion | **Hyperspell** | Connects to Google Drive, Slack, Gmail — ingests past reports, supervisor feedback, policy emails |
| Knowledge index | **Nia** | Indexes all ingested data for semantic search. 15+ MCP tools, proven 11.3% hallucination reduction. Cross-session context |
| Evidence processing | **Tensorlake** | Background sandbox processing with durable case memory. New evidence integrates into existing state |
| Backend | **InsForge** | Postgres database, auth, storage, edge functions. `DATABASE_URL` connects to InsForge Postgres |
| Frontend | **Vercel** | Next.js 14 app deployed on Vercel edge |
| LLM | **OpenAI GPT-4o** | Report drafting with Nia context. Falls back to deterministic local provider without API key |

---

## Demo

One case: **MPD-2025-0519** — DUI Arrest, Central Division, Beat 3A.

Three evidence sources:
- 📹 Bodycam transcript (Officer Chen, 9 entries)
- 📡 Dispatch log (CAD-2025-0519-0087)
- 📝 Officer field notes

Department brain contains:
- 📂 5 past DUI reports from Google Drive
- 💬 2 supervisor feedback messages from Slack (Sgt. Rodriguez)
- 📧 1 policy email from Gmail (Legal Division)
- 📂 2 policy documents (Miranda + SFST)

### What you'll see

1. **Hyperspell ingestion** — Sources broken down: Google Drive (7), Slack (2), Gmail (1)
2. **Tensorlake processing** — Bodycam processed first, dispatch added second to the same memory (no reprocessing)
3. **Nia context** — 3 semantic search queries returned department requirements
4. **With/without brain comparison** — Side-by-side showing what the brain adds
5. **Report draft** — Inline citations, policy compliance checks, contradiction + missing-info flags
6. **Audit trail** — Per-field diffs showing AI draft → human edit → approval

---

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000/demo`.

### Environment variables

```bash
NIA_API_KEY=           # Nia semantic search API (optional — local fallback works)
HYPERSPELL_API_KEY=    # Hyperspell data ingestion API (optional — local fallback works)
TENSORLAKE_API_KEY=    # Tensorlake sandbox API (optional — local processing works)
TENSORLAKE_API_URL=    # Tensorlake API base URL
INSFORGE_API_KEY=      # InsForge backend API (optional — local memory fallback works)
DATABASE_URL=          # InsForge Postgres connection string (optional — in-memory fallback)
OPENAI_API_KEY=        # OpenAI GPT-4o for drafting (optional — deterministic local provider)
APP_URL=http://localhost:3000
```

**The demo works end-to-end without any API keys.** Set them to upgrade from local fallbacks to real sponsor APIs.

---

## Demo Users

| User | Role | Can Edit | Can Approve |
|------|------|----------|-------------|
| Officer Chen | Officer | ✅ | ❌ |
| Sgt. Rodriguez | Supervisor | ✅ | ✅ |

---

## One-line pitch

FieldReport AI is an evidence-grounded incident documentation agent that automates public-safety report drafting by combining current-case evidence with learned department report patterns.
