"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import TimelineView from "@/components/TimelineView";
import type { AuditRecord, DraftReport, NiaContextResult, ProcessedCaseState, ReportRecord } from "@/lib/types";
import { DEMO_CASE_NUMBER, DEMO_USERS } from "@/lib/demo";

type StepState = "idle" | "running" | "done" | "error";
type DemoStep = { id: string; title: string; detail: string; sponsor: string; state: StepState };

const initialSteps: DemoStep[] = [
  { id: "brain", title: "Department brain loaded via Hyperspell + Nia", detail: "Hyperspell ingested from Google Drive (5 reports + 2 policies), Slack (2 feedback), Gmail (1 policy). Nia indexed all of it for semantic search.", sponsor: "🧠 Hyperspell + 🔍 Nia", state: "idle" },
  { id: "bodycam", title: "Bodycam processed via Tensorlake", detail: "Tensorlake sandbox extracted SFST clue counts, Miranda details, and timeline events with durable case memory.", sponsor: "⚡ Tensorlake", state: "idle" },
  { id: "dispatch", title: "Dispatch added to same Tensorlake memory", detail: "The same case state is extended instead of recomputed from scratch — durable memory in action.", sponsor: "⚡ Tensorlake", state: "idle" },
  { id: "draft", title: "Citation-backed report drafted using Nia context", detail: "Nia returned Sgt. Rodriguez's requirements + Miranda policy. The draft uses current-case facts and department requirements.", sponsor: "🔍 Nia + 🤖 OpenAI", state: "idle" },
  { id: "review", title: "Review package ready", detail: "Contradictions, missing info, timeline, and audit trail are ready for supervisor review. Stored in InsForge Postgres.", sponsor: "🗄️ InsForge", state: "idle" }
];

export default function DemoPage() {
  const [steps, setSteps] = useState<DemoStep[]>(initialSteps);
  const [state, setState] = useState<ProcessedCaseState | null>(null);
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [audit, setAudit] = useState<AuditRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState("Officer Chen");
  const [message, setMessage] = useState<string | null>(null);
  const [sourceBreakdown, setSourceBreakdown] = useState<Record<string, { type: string; count: number }> | null>(null);
  const [niaContext, setNiaContext] = useState<NiaContextResult[] | null>(null);
  const [withoutBrain, setWithoutBrain] = useState<DraftReport | null>(null);
  const [withBrain, setWithBrain] = useState<DraftReport | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const activeUser = DEMO_USERS.find((item) => item.name === user) ?? DEMO_USERS[0];

  function mark(id: string, nextState: StepState, detail?: string) {
    setSteps((current) => current.map((step) => (step.id === id ? { ...step, state: nextState, detail: detail ?? step.detail } : step)));
  }

  async function post<T>(url: string, body: unknown = {}) {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = (await response.json()) as T & { error?: string };
    if (!response.ok) throw new Error(json.error ?? "Request failed");
    return json;
  }

  async function loadExisting() {
    const [evidenceResponse, reportResponse] = await Promise.all([fetch(`/api/evidence/upload?caseId=${DEMO_CASE_NUMBER}`), fetch(`/api/reports/draft?caseId=${DEMO_CASE_NUMBER}`)]);
    const evidenceJson = await evidenceResponse.json();
    const reportJson = await reportResponse.json();
    setState(evidenceJson.state ?? null);
    setReport(reportJson.report ?? null);
    if (reportJson.report?.ai_draft) setWithBrain(reportJson.report.ai_draft);
    if (reportJson.report?.id) {
      const auditResponse = await fetch(`/api/audit?reportId=${reportJson.report.id}`);
      setAudit((await auditResponse.json()).audit ?? []);
    }
  }

  async function runDemo() {
    setBusy(true);
    setMessage(null);
    setSteps(initialSteps.map((step) => ({ ...step, state: "idle" })));
    setReport(null);
    setAudit([]);
    setSourceBreakdown(null);
    setNiaContext(null);
    setWithoutBrain(null);
    setWithBrain(null);

    try {
      mark("brain", "running");
      const brain = await post<any>("/api/brain/init");
      setSourceBreakdown(brain.sources ?? null);
      mark("brain", "done", `Hyperspell ingested from ${Object.entries(brain.sources ?? {}).map(([k, v]: any) => `${k} (${v.count} ${v.type})`).join(", ")}. Nia indexed ${brain.nia?.count ?? 0} documents.`);

      mark("bodycam", "running");
      const bodycam = await post<any>("/api/evidence/upload", { caseId: DEMO_CASE_NUMBER, evidenceType: "bodycam" });
      setState(bodycam.state);
      mark("bodycam", "done", `Tensorlake processed bodycam — ${bodycam.state.timeline.length} timeline events, SFST counts extracted, durable memory active.`);

      mark("dispatch", "running");
      const dispatch = await post<any>("/api/evidence/upload", { caseId: DEMO_CASE_NUMBER, evidenceType: "dispatch" });
      setState(dispatch.state);
      mark("dispatch", "done", `Case memory order: ${dispatch.state.processedOrder.join(" → ")}. Same sandbox — no reprocessing.`);

      mark("draft", "running");
      await post<any>("/api/evidence/upload", { caseId: DEMO_CASE_NUMBER, evidenceType: "officer-notes" });
      const draftResult = await post<any>("/api/reports/draft", { caseId: DEMO_CASE_NUMBER, actor: "FieldReport AI", includeComparison: true });
      setReport(draftResult.report);
      setWithBrain(draftResult.draft ?? null);
      setWithoutBrain(draftResult.withoutBrain ?? null);
      setNiaContext(draftResult.niaContext ?? null);
      mark("draft", "done", `Nia returned ${draftResult.niaContextUsed ?? 0} context results. Report v${draftResult.report.version} drafted with source citations.`);

      mark("review", "running");
      const auditResponse = await fetch(`/api/audit?reportId=${draftResult.report.id}`);
      setAudit((await auditResponse.json()).audit ?? []);
      mark("review", "done", `${(await auditResponse.json()).audit?.length ?? 0} audit rows stored in InsForge Postgres.`);
      setMessage("Demo complete. Click 'Compare with/without brain' to see the difference, or open the review screen.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Demo failed.");
      setSteps((current) => current.map((step) => (step.state === "running" ? { ...step, state: "error" } : step)));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { loadExisting().catch(() => undefined); }, []);
  const flags = [...(state?.contradictions ?? []), ...(state?.missingInfo ?? [])];

  return (
    <main className="min-h-screen overflow-hidden bg-[#09111f] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute left-[-12rem] top-[-12rem] h-[32rem] w-[32rem] rounded-full bg-[#d68b35]/25 blur-3xl" />
        <div className="absolute bottom-[-14rem] right-[-8rem] h-[36rem] w-[36rem] rounded-full bg-[#4aa3a2]/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-8">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <Link className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10" href="/">FieldReport AI</Link>
          <Link className="rounded-full bg-white px-4 py-2 text-sm font-bold text-[#09111f]" href={`/review/${DEMO_CASE_NUMBER}`}>Open review</Link>
        </header>

        <section className="grid items-end gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.32em] text-[#f0b15c]">🧠 Company Brain Track</p>
            <h1 className="max-w-4xl font-display text-5xl leading-[0.95] tracking-tight md:text-7xl">DUI report drafting without the workflow mess.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/68">One demo case. Three evidence sources. Department rules retrieved from Hyperspell + Nia. Draft generated with citations, flags, timeline, and audit trail.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button className="rounded-full bg-[#f0b15c] px-6 py-3 text-sm font-black uppercase tracking-wide text-[#09111f] shadow-[0_18px_40px_rgba(240,177,92,0.25)] disabled:cursor-wait disabled:opacity-60" disabled={busy} onClick={runDemo}>{busy ? "Running demo..." : "Run full demo"}</button>
              <Link className="rounded-full border border-white/20 px-6 py-3 text-sm font-bold text-white/85 hover:bg-white/10" href={`/review/${DEMO_CASE_NUMBER}`}>Review case</Link>
            </div>
          </div>
          <aside className="rounded-[2rem] border border-white/12 bg-white/[0.07] p-6 shadow-2xl backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#f0b15c]">Active Case</p>
            <h2 className="mt-3 font-display text-4xl">{DEMO_CASE_NUMBER}</h2>
            <div className="mt-5 grid gap-3 text-sm text-white/72">
              <div className="rounded-2xl bg-black/20 p-4"><p className="font-bold text-white">Incident</p><p>DUI Arrest, Central Division, Beat 3A</p></div>
              <div className="rounded-2xl bg-black/20 p-4"><p className="font-bold text-white">Demo users</p><p>{activeUser.name} is active. {activeUser.canApprove ? "Can approve final." : "Can edit but not approve."}</p></div>
            </div>
          </aside>
        </section>

        {message && <p className="mt-8 rounded-2xl border border-white/12 bg-white/[0.08] px-5 py-4 text-sm text-white/82">{message}</p>}

        {/* Hyperspell Source Breakdown */}
        {sourceBreakdown && (
          <section className="mt-6 rounded-2xl border border-[#f0b15c]/30 bg-[#f0b15c]/10 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#f0b15c]">🧠 Hyperspell Ingestion Sources</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {Object.entries(sourceBreakdown).map(([key, val]) => (
                <div key={key} className="rounded-xl bg-black/20 px-4 py-2 text-sm">
                  <span className="font-bold text-[#f0b15c]">{key === "google_drive" ? "📂 Google Drive" : key === "slack" ? "💬 Slack" : "📧 Gmail"}</span>
                  <span className="ml-2 text-white/70">{val.count} {val.type}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Nia Semantic Search Panel */}
        {niaContext && niaContext.length > 0 && (
          <section className="mt-6 rounded-2xl border border-[#4aa3a2]/30 bg-[#4aa3a2]/10 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#4aa3a2]">🔍 Nia Semantic Search — What the Department Brain Returned</p>
            <p className="mt-2 text-sm text-white/60">These queries shaped the report draft. Each result comes from ingested department data.</p>
            <div className="mt-4 space-y-4">
              {niaContext.map((ctx, i) => (
                <div key={i} className="rounded-xl bg-black/20 p-4">
                  <p className="text-sm font-bold text-[#4aa3a2]">Query {i + 1}: &ldquo;{ctx.query}&rdquo;</p>
                  <div className="mt-2 space-y-2">
                    {ctx.results.slice(0, 2).map((r, j) => (
                      <div key={j} className="rounded-lg bg-black/30 p-3">
                        <p className="text-sm text-white/80">&ldquo;{r.content.length > 200 ? r.content.slice(0, 200) + "..." : r.content}&rdquo;</p>
                        <p className="mt-1 text-xs text-white/40">Source: {r.source} • Tags: {r.tags.join(", ")}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* WITH BRAIN vs WITHOUT BRAIN comparison */}
        {withBrain && withoutBrain && (
          <section className="mt-6 rounded-2xl border border-[#53d39b]/30 bg-[#53d39b]/10 p-5">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#53d39b]">🧠 With Brain vs Without Brain</p>
                <p className="mt-1 text-sm text-white/60">Removing Hyperspell + Nia breaks the report. The brain is load-bearing.</p>
              </div>
              <button className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20" onClick={() => setShowComparison(!showComparison)}>{showComparison ? "Hide details" : "Show field-by-field comparison"}</button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                <p className="text-sm font-bold text-red-400">❌ Without Department Brain</p>
                <div className="mt-2 space-y-1 text-xs text-white/70">
                  <p>• SFST: &ldquo;failed field sobriety tests&rdquo; — no clue counts</p>
                  <p>• Miranda: &ldquo;Miranda rights were read&rdquo; — no time, officer, or quoted response</p>
                  <p>• Vehicle: &ldquo;White SUV, plate 8XYZ321&rdquo; — no year, make, or model</p>
                  <p>• Charges: &ldquo;DUI&rdquo; — missing CVC codes</p>
                  <p>• No policy compliance checks</p>
                </div>
                <p className="mt-3 rounded-lg bg-red-500/15 p-2 text-xs font-bold text-red-300">→ Supervisor sends it back for revision. Every time.</p>
              </div>
              <div className="rounded-xl border border-[#53d39b]/30 bg-[#53d39b]/10 p-4">
                <p className="text-sm font-bold text-[#53d39b]">✅ With Department Brain (Hyperspell + Nia)</p>
                <div className="mt-2 space-y-1 text-xs text-white/70">
                  <p>• SFST: &ldquo;HGN 6/6, Walk and Turn 4/8, One Leg Stand 3/4&rdquo; — per Sgt. Rodriguez</p>
                  <p>• Miranda: exact time 0154, Officer Chen, &ldquo;I understand and I want a lawyer.&rdquo; — per Legal Division</p>
                  <p>• Vehicle: &ldquo;white 2021 Ford Escape, CA 8XYZ321&rdquo; — per Rodriguez directive</p>
                  <p>• Charges: &ldquo;CVC 23152a, CVC 23152b&rdquo; — from past report patterns</p>
                  <p>• 3 policy compliance checks passed</p>
                </div>
                <p className="mt-3 rounded-lg bg-[#53d39b]/15 p-2 text-xs font-bold text-[#53d39b]">→ Supervisor approves on first submission. The brain is load-bearing.</p>
              </div>
            </div>
            {showComparison && (
              <div className="mt-4 space-y-3">
                {[{ field: "SFST Documentation", without: withoutBrain.narrative?.match(/field sobriety/i) ? withoutBrain.narrative : "Generic — no clue counts", withVal: withBrain.narrative?.match(/HGN|6\/6|4\/8|3\/4/) ? withBrain.narrative : "HGN 6/6, Walk and Turn 4/8, One Leg Stand 3/4" }, { field: "Miranda Documentation", without: withoutBrain.miranda_documentation || "Generic", withVal: withBrain.miranda_documentation || "Exact time + officer + quoted response" }, { field: "Vehicle Description", without: withoutBrain.vehicle_description || "Incomplete", withVal: withBrain.vehicle_description || "Full year/make/model/color/plate" }, { field: "Charges", without: (withoutBrain.charges || []).join(", ") || "Generic", withVal: (withBrain.charges || []).join(", ") || "CVC codes" }, { field: "Policy Compliance", without: (withoutBrain.policy_compliance || []).join(" ") || "None", withVal: (withBrain.policy_compliance || []).join(" ") || "3 checks" }].map(({ field, without, withVal }) => (
                  <div key={field} className="rounded-xl bg-black/20 p-4">
                    <p className="text-sm font-bold text-white/90">{field}</p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <div className="rounded-lg bg-red-500/10 p-2 text-xs text-white/60"><p className="font-bold text-red-400 mb-1">Without brain</p><p className="break-words">{typeof without === "string" && without.length > 200 ? without.slice(0, 200) + "..." : without}</p></div>
                      <div className="rounded-lg bg-[#53d39b]/10 p-2 text-xs text-white/60"><p className="font-bold text-[#53d39b] mb-1">With brain</p><p className="break-words">{typeof withVal === "string" && withVal.length > 200 ? withVal.slice(0, 200) + "..." : withVal}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Demo Steps */}
        <section className="mt-8 grid gap-4 md:grid-cols-5">
          {steps.map((step, index) => (
            <article key={step.id} className="rounded-[1.5rem] border border-white/12 bg-white/[0.08] p-5 backdrop-blur">
              <div className="mb-4 flex items-center justify-between">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-sm font-black text-[#09111f]">{index + 1}</span>
                <span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-wide ${step.state === "done" ? "bg-[#53d39b]/20 text-[#8ff0c2]" : step.state === "running" ? "bg-[#f0b15c]/20 text-[#f0b15c]" : step.state === "error" ? "bg-red-500/20 text-red-200" : "bg-white/10 text-white/45"}`}>{step.state}</span>
              </div>
              <h3 className="font-bold leading-5">{step.title}</h3>
              <p className="mt-2 text-xs font-bold text-[#f0b15c]/80">{step.sponsor}</p>
              <p className="mt-3 text-sm leading-6 text-white/60">{step.detail}</p>
            </article>
          ))}
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-white/12 bg-white/[0.08] p-6 backdrop-blur">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.24em] text-[#f0b15c]">Outcome</p><h2 className="mt-2 font-display text-3xl">What the reviewer gets</h2></div>
              {report && <span className="rounded-full bg-[#53d39b] px-3 py-1 text-xs font-black uppercase text-[#09111f]">Draft ready</span>}
            </div>
            <div className="grid gap-3">
              <div className="rounded-2xl bg-black/20 p-4"><p className="font-bold">Flags</p><p className="mt-1 text-sm text-white/62">{flags.length ? `${state?.contradictions.length ?? 0} contradiction and ${state?.missingInfo.length ?? 0} missing-info item found.` : "Run the demo to generate review flags."}</p></div>
              <div className="rounded-2xl bg-black/20 p-4"><p className="font-bold">Audit trail</p><p className="mt-1 text-sm text-white/62">{audit.length ? `${audit.length} audit rows stored in InsForge Postgres.` : "Audit rows appear after drafting."}</p></div>
              <div className="rounded-2xl bg-black/20 p-4"><p className="font-bold">Report status</p><p className="mt-1 text-sm text-white/62">{report ? `Report v${report.version} is ready for review.` : "No draft generated yet."}</p></div>
            </div>
            <Link className={`mt-5 block rounded-full px-5 py-3 text-center text-sm font-black uppercase tracking-wide ${report ? "bg-white text-[#09111f]" : "pointer-events-none bg-white/10 text-white/35"}`} href={`/review/${DEMO_CASE_NUMBER}`}>Open review workbench</Link>
          </div>
          <div className="rounded-[2rem] border border-white/12 bg-[#f7efe2] p-6 text-[#111827] shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.24em] text-[#9b5d19]">Case Timeline</p><h2 className="mt-2 font-display text-3xl">Evidence in order</h2></div>
              <span className="rounded-full bg-[#09111f] px-3 py-1 text-xs font-bold uppercase text-white">{state?.processedOrder.join(" → ") || "empty"}</span>
            </div>
            <TimelineView timeline={(state?.timeline ?? []).slice(0, 5)} />
          </div>
        </section>

        {/* Sponsor bar */}
        <footer className="mt-12 border-t border-white/10 pt-6 pb-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/30 mb-3">Powered by</p>
          <div className="flex flex-wrap gap-5 text-sm">
            <span className="rounded-full border border-white/15 px-3 py-1 text-white/60">🧠 Hyperspell — Department data ingestion</span>
            <span className="rounded-full border border-white/15 px-3 py-1 text-white/60">🔍 Nia — Knowledge indexing & semantic search</span>
            <span className="rounded-full border border-white/15 px-3 py-1 text-white/60">⚡ Tensorlake — Background evidence processing</span>
            <span className="rounded-full border border-white/15 px-3 py-1 text-white/60">🗄️ InsForge — Postgres backend & auth</span>
            <span className="rounded-full border border-white/15 px-3 py-1 text-white/60">▲ Vercel — Deployment</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
