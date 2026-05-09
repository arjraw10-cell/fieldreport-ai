"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import TimelineView from "@/components/TimelineView";
import type { AuditRecord, ProcessedCaseState, ReportRecord } from "@/lib/types";
import { DEMO_CASE_NUMBER } from "@/lib/demo";

type StepState = "idle" | "running" | "done" | "error";

type DemoStep = {
  id: string;
  title: string;
  detail: string;
  state: StepState;
};

const initialSteps: DemoStep[] = [
  {
    id: "brain",
    title: "Department brain loaded",
    detail: "Past Metro PD DUI reports, supervisor feedback, and policies are indexed.",
    state: "idle"
  },
  {
    id: "bodycam",
    title: "Bodycam processed first",
    detail: "SFST clue counts, Miranda details, timeline events, and citations are extracted.",
    state: "idle"
  },
  {
    id: "dispatch",
    title: "Dispatch added to same memory",
    detail: "The same case state is extended instead of recomputed from scratch.",
    state: "idle"
  },
  {
    id: "draft",
    title: "Citation-backed report drafted",
    detail: "The draft uses current-case facts and department requirements.",
    state: "idle"
  },
  {
    id: "review",
    title: "Review package ready",
    detail: "Contradictions, missing info, timeline, and audit trail are ready for supervisor review.",
    state: "idle"
  }
];

export default function DemoPage() {
  const [steps, setSteps] = useState<DemoStep[]>(initialSteps);
  const [state, setState] = useState<ProcessedCaseState | null>(null);
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [audit, setAudit] = useState<AuditRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function mark(id: string, nextState: StepState, detail?: string) {
    setSteps((current) => current.map((step) => (step.id === id ? { ...step, state: nextState, detail: detail ?? step.detail } : step)));
  }

  async function post<T>(url: string, body: unknown = {}) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const json = (await response.json()) as T & { error?: string };
    if (!response.ok) throw new Error(json.error ?? "Request failed");
    return json;
  }

  async function loadExisting() {
    const [evidenceResponse, reportResponse] = await Promise.all([
      fetch(`/api/evidence/upload?caseId=${DEMO_CASE_NUMBER}`),
      fetch(`/api/reports/draft?caseId=${DEMO_CASE_NUMBER}`)
    ]);
    const evidenceJson = await evidenceResponse.json();
    const reportJson = await reportResponse.json();
    setState(evidenceJson.state ?? null);
    setReport(reportJson.report ?? null);
    if (reportJson.report?.id) {
      const auditResponse = await fetch(`/api/audit?reportId=${reportJson.report.id}`);
      const auditJson = await auditResponse.json();
      setAudit(auditJson.audit ?? []);
    }
  }

  async function runDemo() {
    setBusy(true);
    setMessage(null);
    setSteps(initialSteps.map((step) => ({ ...step, state: "idle" })));
    setReport(null);
    setAudit([]);

    try {
      mark("brain", "running");
      const brain = await post<any>("/api/brain/init");
      mark("brain", "done", `${brain.ingestedCount} documents indexed. Using ${brain.database.provider}.`);

      mark("bodycam", "running");
      const bodycam = await post<any>("/api/evidence/upload", { caseId: DEMO_CASE_NUMBER, evidenceType: "bodycam" });
      setState(bodycam.state);
      mark("bodycam", "done", `${bodycam.state.timeline.length} timeline events extracted from bodycam.`);

      mark("dispatch", "running");
      const dispatch = await post<any>("/api/evidence/upload", { caseId: DEMO_CASE_NUMBER, evidenceType: "dispatch" });
      setState(dispatch.state);
      mark("dispatch", "done", `Case memory order: ${dispatch.state.processedOrder.join(" -> ")}.`);

      mark("draft", "running");
      await post<any>("/api/evidence/upload", { caseId: DEMO_CASE_NUMBER, evidenceType: "officer-notes" });
      const draft = await post<any>("/api/reports/draft", { caseId: DEMO_CASE_NUMBER, actor: "FieldReport AI" });
      setReport(draft.report);
      mark("draft", "done", `Report v${draft.report.version} drafted with source citations.`);

      mark("review", "running");
      const auditResponse = await fetch(`/api/audit?reportId=${draft.report.id}`);
      const auditJson = await auditResponse.json();
      const evidenceResponse = await fetch(`/api/evidence/upload?caseId=${DEMO_CASE_NUMBER}`);
      const evidenceJson = await evidenceResponse.json();
      setAudit(auditJson.audit ?? []);
      setState(evidenceJson.state ?? dispatch.state);
      mark("review", "done", `${auditJson.audit?.length ?? 0} audit rows created for AI-drafted fields.`);
      setMessage("Demo is ready. Open the review screen to edit as Officer Chen or approve as Sgt. Rodriguez.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Demo failed.");
      setSteps((current) => current.map((step) => (step.state === "running" ? { ...step, state: "error" } : step)));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadExisting().catch(() => undefined);
  }, []);

  const flags = [...(state?.contradictions ?? []), ...(state?.missingInfo ?? [])];

  return (
    <main className="min-h-screen overflow-hidden bg-[#09111f] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute left-[-12rem] top-[-12rem] h-[32rem] w-[32rem] rounded-full bg-[#d68b35]/25 blur-3xl" />
        <div className="absolute bottom-[-14rem] right-[-8rem] h-[36rem] w-[36rem] rounded-full bg-[#4aa3a2]/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-8">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <Link className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10" href="/">
            FieldReport AI
          </Link>
          <Link className="rounded-full bg-white px-4 py-2 text-sm font-bold text-[#09111f]" href={`/review/${DEMO_CASE_NUMBER}`}>
            Open review
          </Link>
        </header>

        <section className="grid items-end gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.32em] text-[#f0b15c]">Localhost MVP</p>
            <h1 className="max-w-4xl font-display text-5xl leading-[0.95] tracking-tight md:text-7xl">
              DUI report drafting without the workflow mess.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/68">
              One demo case. Three evidence sources. Department rules retrieved. Draft generated with citations, flags, timeline, and audit trail.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                className="rounded-full bg-[#f0b15c] px-6 py-3 text-sm font-black uppercase tracking-wide text-[#09111f] shadow-[0_18px_40px_rgba(240,177,92,0.25)] disabled:cursor-wait disabled:opacity-60"
                disabled={busy}
                onClick={runDemo}
              >
                {busy ? "Running demo..." : "Run full demo"}
              </button>
              <Link className="rounded-full border border-white/20 px-6 py-3 text-sm font-bold text-white/85 hover:bg-white/10" href={`/review/${DEMO_CASE_NUMBER}`}>
                Review case
              </Link>
            </div>
          </div>

          <aside className="rounded-[2rem] border border-white/12 bg-white/[0.07] p-6 shadow-2xl backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#f0b15c]">Active Case</p>
            <h2 className="mt-3 font-display text-4xl">{DEMO_CASE_NUMBER}</h2>
            <div className="mt-5 grid gap-3 text-sm text-white/72">
              <div className="rounded-2xl bg-black/20 p-4">
                <p className="font-bold text-white">Incident</p>
                <p>DUI Arrest, Central Division, Beat 3A</p>
              </div>
              <div className="rounded-2xl bg-black/20 p-4">
                <p className="font-bold text-white">Demo users</p>
                <p>Officer Chen edits. Sgt. Rodriguez approves.</p>
              </div>
            </div>
          </aside>
        </section>

        {message && <p className="mt-8 rounded-2xl border border-white/12 bg-white/[0.08] px-5 py-4 text-sm text-white/82">{message}</p>}

        <section className="mt-10 grid gap-4 md:grid-cols-5">
          {steps.map((step, index) => (
            <article key={step.id} className="rounded-[1.5rem] border border-white/12 bg-white/[0.08] p-5 backdrop-blur">
              <div className="mb-4 flex items-center justify-between">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-sm font-black text-[#09111f]">{index + 1}</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-wide ${
                    step.state === "done"
                      ? "bg-[#53d39b]/20 text-[#8ff0c2]"
                      : step.state === "running"
                        ? "bg-[#f0b15c]/20 text-[#f0b15c]"
                        : step.state === "error"
                          ? "bg-red-500/20 text-red-200"
                          : "bg-white/10 text-white/45"
                  }`}
                >
                  {step.state}
                </span>
              </div>
              <h3 className="font-bold leading-5">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/60">{step.detail}</p>
            </article>
          ))}
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-white/12 bg-white/[0.08] p-6 backdrop-blur">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#f0b15c]">Outcome</p>
                <h2 className="mt-2 font-display text-3xl">What the reviewer gets</h2>
              </div>
              {report && <span className="rounded-full bg-[#53d39b] px-3 py-1 text-xs font-black uppercase text-[#09111f]">Draft ready</span>}
            </div>

            <div className="grid gap-3">
              <div className="rounded-2xl bg-black/20 p-4">
                <p className="font-bold">Flags</p>
                <p className="mt-1 text-sm text-white/62">
                  {flags.length ? `${state?.contradictions.length ?? 0} contradiction and ${state?.missingInfo.length ?? 0} missing-info item found.` : "Run the demo to generate review flags."}
                </p>
              </div>
              <div className="rounded-2xl bg-black/20 p-4">
                <p className="font-bold">Audit trail</p>
                <p className="mt-1 text-sm text-white/62">{audit.length ? `${audit.length} audit rows created.` : "Audit rows appear after drafting."}</p>
              </div>
              <div className="rounded-2xl bg-black/20 p-4">
                <p className="font-bold">Report status</p>
                <p className="mt-1 text-sm text-white/62">{report ? `Report v${report.version} is ready for review.` : "No draft generated yet."}</p>
              </div>
            </div>

            <Link
              className={`mt-5 block rounded-full px-5 py-3 text-center text-sm font-black uppercase tracking-wide ${
                report ? "bg-white text-[#09111f]" : "pointer-events-none bg-white/10 text-white/35"
              }`}
              href={`/review/${DEMO_CASE_NUMBER}`}
            >
              Open review workbench
            </Link>
          </div>

          <div className="rounded-[2rem] border border-white/12 bg-[#f7efe2] p-6 text-[#111827] shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#9b5d19]">Case Timeline</p>
                <h2 className="mt-2 font-display text-3xl">Evidence in order</h2>
              </div>
              <span className="rounded-full bg-[#09111f] px-3 py-1 text-xs font-bold uppercase text-white">
                {state?.processedOrder.join(" -> ") || "empty"}
              </span>
            </div>
            <TimelineView timeline={(state?.timeline ?? []).slice(0, 5)} />
          </div>
        </section>
      </div>
    </main>
  );
}
