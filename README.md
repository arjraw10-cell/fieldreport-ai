# FieldReport AI

FieldReport AI is a localhost MVP for a department-aware DUI incident report drafting workflow. It processes current-case evidence, retrieves Metro PD requirements, drafts a citation-backed report, flags one contradiction and one missing-info issue, and supports review/edit/approval with audit rows.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment

Set these when available:

```bash
NIA_API_KEY=
HYPERSPELL_API_KEY=
TENSORLAKE_API_KEY=
TENSORLAKE_API_URL=
INSFORGE_API_KEY=
DATABASE_URL=
OPENAI_API_KEY=
OPENAI_BASE_URL=
APP_URL=http://localhost:3000
```

If `DATABASE_URL` is unset, the demo uses an in-process database fallback. If `OPENAI_API_KEY` is unset, deterministic local drafting keeps the end-to-end demo working. Set `OPENAI_BASE_URL` in `.env.local` when using an OpenAI-compatible endpoint.

## Demo Flow

1. Open `/demo`.
2. Click `Initialize brain` to load sample reports, feedback, and policies into the Nia and Hyperspell adapters.
3. Click `Process bodycam`.
4. Click `Process dispatch second` to show the same case state being extended.
5. Click `Draft report`; officer notes are appended before drafting so full vehicle, tow, and suspect facts are available.
6. Open `/review/MPD-2025-0519`, inspect citations, flags, timeline, and audit trail.
7. Select `Officer Chen` to edit/save. Select `Sgt. Rodriguez` to approve final.

## Sponsor Integration Status

- Nia: wrapper is implemented in `apps/web/lib/nia.ts`. It currently uses local indexed search over seeded reports, feedback, and policies, preserving `niaIndex` and `niaSearch`.
- Hyperspell: wrapper is implemented in `apps/web/lib/hyperspell.ts`. It uses local in-memory ingestion/search for the ingestion story, preserving `hsIngest` and `hsSearch`.
- Tensorlake: wrapper is implemented in `apps/web/lib/tensorlake.ts`. It simulates stateful evidence processing per case and preserves `processEvidence` and `getCaseState`. The Python reference is in `tensorlake/process_evidence.py`.
- InsForge: `DATABASE_URL` is treated as the InsForge-backed Postgres path. Without it, the app uses local memory so the localhost demo does not block on proprietary SDK setup.

## Notes

OpenAI `gpt-4o` is used first when `OPENAI_API_KEY` is configured. The drafting provider boundary in `apps/web/lib/agent.ts` is intentionally small so Qwen or another open-weight model can replace it later without rewiring the app.
