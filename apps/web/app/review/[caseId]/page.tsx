"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AuditTrailView from "@/components/AuditTrailView";
import FlagsPanel from "@/components/FlagsPanel";
import ReportView from "@/components/ReportView";
import TimelineView from "@/components/TimelineView";
import type { AuditRecord, CaseRecord, DraftReport, ProcessedCaseState, ReportRecord } from "@/lib/types";
import { DEMO_USERS } from "@/lib/demo";

type Tab = "report" | "timeline" | "audit";

export default function ReviewPage({ params }: { params: { caseId: string } }) {
  const caseId = decodeURIComponent(params.caseId);
  const [tab, setTab] = useState<Tab>("report");
  const [user, setUser] = useState("Officer Chen");
  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null);
  const [state, setState] = useState<ProcessedCaseState | null>(null);
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [draft, setDraft] = useState<DraftReport | null>(null);
  const [audit, setAudit] = useState<AuditRecord[]>([]);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const activeUser = DEMO_USERS.find((item) => item.name === user) ?? DEMO_USERS[0];

  async function load() {
    const [evidenceResponse, reportResponse] = await Promise.all([
      fetch(`/api/evidence/upload?caseId=${caseId}`),
      fetch(`/api/reports/draft?caseId=${caseId}`)
    ]);
    const evidenceJson = await evidenceResponse.json();
    const reportJson = await reportResponse.json();
    setCaseRecord(reportJson.case ?? evidenceJson.case ?? null);
    setState(evidenceJson.state ?? reportJson.case?.evidence_json ?? null);
    setReport(reportJson.report ?? null);
    const currentDraft = reportJson.report?.final ?? reportJson.report?.human_edit ?? reportJson.report?.ai_draft ?? null;
    setDraft(currentDraft);
    if (reportJson.report?.id) {
      const auditResponse = await fetch(`/api/audit?reportId=${reportJson.report.id}`);
      const auditJson = await auditResponse.json();
      setAudit(auditJson.audit);
    }
  }

  useEffect(() => {
    setUser(localStorage.getItem("fieldreport-user") ?? "Officer Chen");
    load().catch((error) => setMessage(error instanceof Error ? error.message : "Failed to load review."));
  }, []);

  function changeUser(nextUser: string) {
    setUser(nextUser);
    localStorage.setItem("fieldreport-user", nextUser);
  }

  async function createDraft() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/reports/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, actor: "FieldReport AI" })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Draft failed");
      await load();
      setMessage("Draft generated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Draft failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!report || !draft) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/reports/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: report.id, actor: user, final: draft, action: "save_edit" })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Save failed");
      setEditing(false);
      await load();
      setMessage("Human edit saved to audit trail.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!report || !draft) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/reports/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: report.id, actor: user, final: draft, action: "approve" })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Approval failed");
      await load();
      setMessage("Report approved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Approval failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-brass">Review Workbench</p>
          <h1 className="font-display text-5xl text-ink">{caseRecord?.case_number ?? caseId}</h1>
          <p className="mt-2 text-sm text-ink/60">{caseRecord?.incident_type ?? "DUI Arrest"} report review</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select className="rounded-xl border border-ink/15 bg-white/80 px-3 py-2 text-sm" value={user} onChange={(event) => changeUser(event.target.value)}>
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
        {(["report", "timeline", "audit"] as const).map((item) => (
          <button
            key={item}
            className={`rounded-full px-4 py-2 text-sm font-bold capitalize ${tab === item ? "bg-ink text-white" : "bg-white/70 text-ink"}`}
            onClick={() => setTab(item)}
          >
            {item === "audit" ? "Audit Trail" : item}
          </button>
        ))}
      </nav>

      {message && <p className="mb-5 rounded-2xl bg-white/80 px-4 py-3 text-sm font-semibold text-ink">{message}</p>}

      <section className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div>
          {tab === "report" && (
            <div className="space-y-5">
              {!draft && (
                <div className="rounded-[2rem] border border-ink/10 bg-white/85 p-8 shadow-card">
                  <h2 className="font-display text-3xl">No draft yet</h2>
                  <p className="mt-2 text-sm text-ink/65">Process evidence in the demo flow, then generate a draft here.</p>
                  <button className="mt-5 rounded-full bg-ink px-5 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={busy} onClick={createDraft}>
                    Generate draft
                  </button>
                </div>
              )}
              {draft && <ReportView report={draft} editable={editing} onChange={setDraft} />}
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
                disabled={!draft || !activeUser.canEdit || busy}
                onClick={() => setEditing((current) => !current)}
              >
                {editing ? "Stop editing" : "Edit"}
              </button>
              <button
                className="w-full rounded-full bg-slateblue px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                disabled={!draft || !editing || busy}
                onClick={saveEdit}
              >
                Save edit
              </button>
              <button
                className="w-full rounded-full bg-ink px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                disabled={!draft || !activeUser.canApprove || busy}
                onClick={approve}
              >
                Approve final
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
