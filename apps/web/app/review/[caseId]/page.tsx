"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import AuditTrailView from "@/components/AuditTrailView";
import FlagsPanel from "@/components/FlagsPanel";
import ReportView from "@/components/ReportView";
import TimelineView from "@/components/TimelineView";
import type { AuditRecord, CaseRecord, DraftReport, NiaContextResult, ProcessedCaseState, ReportRecord } from "@/lib/types";
import { DEMO_USERS } from "@/lib/demo";

type Tab = "report" | "brain" | "timeline" | "audit";
type LoadStatus = "loading" | "ready" | "error";
type BusyAction = "session" | "draft" | "save" | "approve" | null;
type Notice = { tone: "info" | "error" | "success"; text: string };

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

export default function ReviewPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId: encodedCaseId } = use(params);
  const caseId = decodeURIComponent(encodedCaseId);
  const [tab, setTab] = useState<Tab>("report");
  const [user, setUser] = useState("Officer Chen");
  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null);
  const [state, setState] = useState<ProcessedCaseState | null>(null);
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [draft, setDraft] = useState<DraftReport | null>(null);
  const [audit, setAudit] = useState<AuditRecord[]>([]);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [niaContext, setNiaContext] = useState<NiaContextResult[] | null>(null);

  const activeUser = DEMO_USERS.find((item) => item.name === user) ?? DEMO_USERS[0];
  const isBusy = busyAction !== null;
  const isApproved = report?.status === "approved" || Boolean(report?.final);
  const hasEvidence = Boolean(state && ((state.processedOrder?.length ?? 0) > 0 || (state.timeline?.length ?? 0) > 0));
  const exportHref = `/api/reports/export?caseId=${encodeURIComponent(caseId)}`;

  const load = useCallback(async () => {
    setLoadStatus((current) => (current === "ready" ? current : "loading"));
    const [evidenceResponse, reportResponse, sessionResponse] = await Promise.all([
      fetch(`/api/evidence/upload?caseId=${encodeURIComponent(caseId)}`, { cache: "no-store" }),
      fetch(`/api/reports/draft?caseId=${encodeURIComponent(caseId)}`, { cache: "no-store" }),
      fetch("/api/demo-session", { cache: "no-store" })
    ]);

    const evidenceJson = await readJson<{ error?: string; case?: CaseRecord; state?: ProcessedCaseState | null }>(evidenceResponse);
    const reportJson = await readJson<{ error?: string; case?: CaseRecord; report?: ReportRecord | null }>(reportResponse);
    const sessionJson = await readJson<{ error?: string; user?: { name?: string } }>(sessionResponse);

    if (!sessionResponse.ok) throw new Error(sessionJson.error ?? "Failed to load demo session.");
    if (!evidenceResponse.ok && evidenceResponse.status !== 404) throw new Error(evidenceJson.error ?? "Failed to load evidence.");
    if (!reportResponse.ok && reportResponse.status !== 404) throw new Error(reportJson.error ?? "Failed to load report.");

    const nextReport = reportJson.report ?? null;
    setUser(sessionJson.user?.name ?? DEMO_USERS[0].name);
    setCaseRecord(reportJson.case ?? evidenceJson.case ?? null);
    setState(evidenceJson.state ?? reportJson.case?.evidence_json ?? null);
    setReport(nextReport);
    setDraft(nextReport?.final ?? nextReport?.human_edit ?? nextReport?.ai_draft ?? null);
    setEditing(false);

    // Load Nia context from the draft if available
    const draftWithNia = nextReport?.ai_draft as DraftReport & { niaContext?: NiaContextResult[] } | null;
    if (draftWithNia?.niaContext) {
      setNiaContext(draftWithNia.niaContext);
    }

    if (nextReport?.id) {
      const auditResponse = await fetch(`/api/audit?reportId=${encodeURIComponent(nextReport.id)}`, { cache: "no-store" });
      const auditJson = await readJson<{ error?: string; audit?: AuditRecord[] }>(auditResponse);
      if (!auditResponse.ok) throw new Error(auditJson.error ?? "Failed to load audit trail.");
      setAudit(auditJson.audit ?? []);
    } else {
      setAudit([]);
    }

    setLoadStatus("ready");
  }, [caseId]);

  useEffect(() => {
    async function loadReviewPage() {
      try {
        await load();
      } catch (error) {
        setLoadStatus("error");
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "Failed to load review." });
      }
    }

    void loadReviewPage();
  }, [load]);

  async function changeUser(nextUser: string) {
    setBusyAction("session");
    setNotice(null);
    try {
      const response = await fetch("/api/demo-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: nextUser })
      });
      const json = await readJson<{ error?: string; user?: { name?: string } }>(response);
      if (!response.ok) throw new Error(json.error ?? "Failed to switch demo user.");
      setUser(json.user?.name ?? DEMO_USERS[0].name);
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Failed to switch demo user." });
    } finally {
      setBusyAction(null);
    }
  }

  async function createDraft() {
    setBusyAction("draft");
    setNotice(null);
    try {
      const response = await fetch("/api/reports/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, actor: "FieldReport AI" })
      });
      const json = await readJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(json.error ?? "Draft failed");
      await load();
      setNotice({ tone: "success", text: "Draft generated." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Draft failed." });
    } finally {
      setBusyAction(null);
    }
  }

  async function retryLoad() {
    setNotice(null);
    try {
      await load();
    } catch (error) {
      setLoadStatus("error");
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Failed to load review." });
    }
  }

  async function saveEdit() {
    if (!report || !draft || isApproved) return;
    setBusyAction("save");
    setNotice(null);
    try {
      const response = await fetch("/api/reports/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: report.id, final: draft, action: "save_edit" })
      });
      const json = await readJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(json.error ?? "Save failed");
      setEditing(false);
      await load();
      setNotice({ tone: "success", text: "Human edit saved to audit trail." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Save failed." });
    } finally {
      setBusyAction(null);
    }
  }

  async function approve() {
    if (!report || !draft || isApproved) return;
    setBusyAction("approve");
    setNotice(null);
    try {
      const response = await fetch("/api/reports/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: report.id, final: draft, action: "approve" })
      });
      const json = await readJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(json.error ?? "Approval failed");
      await load();
      setNotice({ tone: "success", text: "Report approved." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Approval failed." });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-brass">Review Workbench</p>
          <h1 className="font-display text-5xl text-ink">{caseRecord?.case_number ?? caseId}</h1>
          <p className="mt-2 text-sm text-ink/60">{caseRecord?.incident_type ?? "Incident"} report review</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="rounded-xl border border-ink/15 bg-white/80 px-3 py-2 text-sm disabled:opacity-60"
            disabled={isBusy}
            value={user}
            onChange={(event) => void changeUser(event.target.value)}
          >
            {DEMO_USERS.map((demoUser) => (
              <option key={demoUser.name}>{demoUser.name}</option>
            ))}
          </select>
          <Link className="rounded-full border border-ink/20 bg-white/70 px-4 py-2 text-sm font-bold" href="/demo">
            Demo
          </Link>
        </div>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2">
        {(["report", "brain", "timeline", "audit"] as const).map((item) => (
          <button
            key={item}
            className={`rounded-full px-4 py-2 text-sm font-bold capitalize ${tab === item ? "bg-ink text-white" : "bg-white/70 text-ink"}`}
            onClick={() => setTab(item)}
          >
            {item === "audit" ? "Audit Trail" : item === "brain" ? "🧠 Brain Context" : item}
          </button>
        ))}
      </nav>

      {notice && (
        <p
          className={`mb-5 rounded-2xl px-4 py-3 text-sm font-semibold ${
            notice.tone === "error" ? "border border-signal/25 bg-signal/10 text-signal" : "bg-white/80 text-ink"
          }`}
        >
          {notice.text}
        </p>
      )}

      {loadStatus === "loading" && (
        <div className="rounded-[2rem] border border-ink/10 bg-white/85 p-8 shadow-card">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-brass">Loading</p>
          <h2 className="mt-2 font-display text-3xl text-ink">Opening review workspace</h2>
          <p className="mt-2 text-sm text-ink/65">Fetching case evidence, report status, and audit history.</p>
        </div>
      )}

      {loadStatus === "error" && (
        <div className="rounded-[2rem] border border-signal/20 bg-white/85 p-8 shadow-card">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-signal">Review unavailable</p>
          <h2 className="mt-2 font-display text-3xl text-ink">This case could not be loaded</h2>
          <button className="mt-5 rounded-full bg-ink px-5 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={isBusy} onClick={() => void retryLoad()}>
            Retry
          </button>
        </div>
      )}

      {loadStatus === "ready" && <section className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div>
          {tab === "report" && (
            <div className="space-y-5">
              {!draft && (
                <div className="rounded-[2rem] border border-ink/10 bg-white/85 p-8 shadow-card">
                  <h2 className="font-display text-3xl">No draft yet</h2>
                  <p className="mt-2 text-sm text-ink/65">
                    {hasEvidence
                      ? "Evidence is available for this case. Generate a grounded draft when ready."
                      : "No processed evidence is available yet. Upload or process evidence before generating a report."}
                  </p>
                  <button
                    className="mt-5 rounded-full bg-ink px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                    disabled={isBusy || !hasEvidence}
                    onClick={createDraft}
                  >
                    {busyAction === "draft" ? "Generating..." : "Generate draft"}
                  </button>
                </div>
              )}
              {draft && (
                <>
                  {isApproved && (
                    <div className="rounded-2xl border border-ink/10 bg-white/85 p-5 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-brass">Approved</p>
                      <p className="mt-2 text-sm text-ink/70">
                        Finalized by {report?.approved_by ?? "reviewer"}
                        {report?.approved_at ? ` on ${new Date(report.approved_at).toLocaleString()}` : ""}. Editing is locked for this report.
                      </p>
                    </div>
                  )}
                  <ReportView report={draft} editable={editing && !isApproved} onChange={setDraft} />
                </>
              )}
            </div>
          )}
          {tab === "brain" && (
            <div className="rounded-[2rem] border border-ink/10 bg-white/80 p-6 shadow-card">
              <h2 className="mb-4 font-display text-2xl text-ink">🔍 Nia Semantic Search Results</h2>
              <p className="mb-4 text-sm text-ink/65">These are the department brain queries that shaped the report draft. Each result comes from data ingested by Hyperspell and indexed by Nia.</p>
              {niaContext && niaContext.length > 0 ? (
                <div className="space-y-4">
                  {niaContext.map((ctx, i) => (
                    <div key={i} className="rounded-xl border border-ink/10 bg-paper/50 p-4">
                      <p className="text-sm font-bold text-slateblue">Query {i + 1}: &ldquo;{ctx.query}&rdquo;</p>
                      <div className="mt-2 space-y-2">
                        {ctx.results.slice(0, 2).map((r, j) => (
                          <div key={j} className="rounded-lg bg-white p-3 shadow-sm">
                            <p className="text-sm text-ink/80">&ldquo;{r.content.length > 250 ? r.content.slice(0, 250) + "..." : r.content}&rdquo;</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="source-badge">{r.source}</span>
                              {r.tags.map((tag) => (<span key={tag} className="rounded-full bg-slateblue/10 px-2 py-0.5 text-xs text-slateblue">{tag}</span>))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-ink/50">No Nia context stored for this draft. Generate a new draft to see the brain queries.</p>
                  <div className="rounded-xl border border-slateblue/20 bg-slateblue/5 p-4">
                    <p className="text-sm font-bold text-slateblue">Example Nia queries that shape a DUI draft:</p>
                    <ul className="mt-2 space-y-1 text-sm text-ink/70">
                      <li>• &ldquo;Sgt. Rodriguez DUI report requirements SFST vehicle description&rdquo; → Slack feedback about SFST clue counts</li>
                      <li>• &ldquo;Miranda policy requirements exact time officer response&rdquo; → Legal Division email about Miranda documentation</li>
                      <li>• &ldquo;past Metro PD DUI report patterns&rdquo; → Past DUI reports for style reference</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
          {tab === "timeline" && (
            <div className="rounded-[2rem] border border-ink/10 bg-white/80 p-6 shadow-card">
              <TimelineView timeline={state?.timeline ?? []} />
            </div>
          )}
          {tab === "audit" && (
            <div className="rounded-[2rem] border border-ink/10 bg-white/80 p-6 shadow-card">
              <AuditTrailView audit={audit} />
            </div>
          )}
        </div>

        <div className="space-y-5">
          <FlagsPanel contradictions={state?.contradictions ?? draft?.contradictions ?? []} missingInfo={state?.missingInfo ?? draft?.missing_info ?? []} />
          <div className="rounded-2xl border border-ink/10 bg-white/85 p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brass">Actions</p>
            <p className="mt-2 text-sm text-ink/65">
              {activeUser.name} can {activeUser.canApprove ? "edit and approve final." : "review and edit, but cannot approve final."}
            </p>
            <div className="mt-4 space-y-3">
              <button
                className="w-full rounded-full border border-ink/20 px-4 py-3 text-sm font-bold text-ink disabled:opacity-50"
                disabled={!draft || !activeUser.canEdit || isBusy || isApproved}
                onClick={() => setEditing((current) => !current)}
              >
                {editing ? "Stop editing" : "Edit"}
              </button>
              <button
                className="w-full rounded-full bg-slateblue px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                disabled={!draft || !editing || isBusy || isApproved}
                onClick={saveEdit}
              >
                {busyAction === "save" ? "Saving..." : "Save edit"}
              </button>
              <button
                className="w-full rounded-full bg-ink px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                disabled={!draft || !activeUser.canApprove || isBusy || isApproved}
                onClick={approve}
              >
                {busyAction === "approve" ? "Approving..." : isApproved ? "Approved" : "Approve final"}
              </button>
              {report ? (
                <a
                  className="block w-full rounded-full border border-ink/20 bg-white/70 px-4 py-3 text-center text-sm font-bold text-ink"
                  href={exportHref}
                >
                  Export packet
                </a>
              ) : (
                <button className="w-full rounded-full border border-ink/20 px-4 py-3 text-sm font-bold text-ink opacity-50" disabled>
                  Export packet
                </button>
              )}
            </div>
          </div>
        </div>
      </section>}

      <footer className="mt-12 border-t border-ink/10 pt-6 pb-8">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-ink/30 mb-3">Powered by</p>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="rounded-full border border-ink/15 px-3 py-1 text-ink/50">🧠 Hyperspell — Data ingestion</span>
          <span className="rounded-full border border-ink/15 px-3 py-1 text-ink/50">🔍 Nia — Knowledge search & cross-session context</span>
          <span className="rounded-full border border-ink/15 px-3 py-1 text-ink/50">⚡ Tensorlake — Evidence processing</span>
          <span className="rounded-full border border-ink/15 px-3 py-1 text-ink/50">🗄️ InsForge — Postgres backend</span>
          <span className="rounded-full border border-ink/15 px-3 py-1 text-ink/50">▲ Vercel — Deployment</span>
        </div>
      </footer>
    </main>
  );
}
