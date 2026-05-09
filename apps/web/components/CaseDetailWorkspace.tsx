"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import FlagsPanel from "@/components/FlagsPanel";
import { EmptyState, FieldLabel, Notice, ShellHeader, StatusBadge } from "@/components/OpsPrimitives";
import ReportView from "@/components/ReportView";
import TimelineView from "@/components/TimelineView";
import type { CaseRecord, DraftReport, EvidenceType, ProcessedCaseState, ReportRecord } from "@/lib/types";

type CaseDetailPayload = {
  case?: CaseRecord | null;
  report?: ReportRecord | null;
  draft?: DraftReport | null;
  state?: ProcessedCaseState | null;
  evidence?: Array<{ id?: string; type?: string; title?: string; status?: string; created_at?: string }>;
};

type UploadForm = {
  evidenceType: EvidenceType;
  title: string;
  raw: string;
};

function readError(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") return payload.error;
  if (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string") return payload.message;
  return fallback;
}

function normalizeDetail(payload: unknown): CaseDetailPayload {
  if (!payload || typeof payload !== "object") return {};
  const record = payload as CaseDetailPayload & {
    data?: CaseDetailPayload;
    caseRecord?: CaseRecord;
    processed?: ProcessedCaseState;
  };
  const nested = record.data ?? {};
  return {
    case: record.case ?? record.caseRecord ?? nested.case ?? null,
    report: record.report ?? nested.report ?? null,
    draft: record.draft ?? nested.draft ?? null,
    state: record.state ?? record.processed ?? nested.state ?? record.case?.evidence_json ?? null,
    evidence: record.evidence ?? nested.evidence ?? []
  };
}

function currentDraft(report?: ReportRecord | null, explicit?: DraftReport | null) {
  return explicit ?? report?.final ?? report?.human_edit ?? report?.ai_draft ?? null;
}

function parseEvidenceInput(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return { text: trimmed };
  }
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function CaseDetailWorkspace({ caseId }: { caseId: string }) {
  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null);
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [draft, setDraft] = useState<DraftReport | null>(null);
  const [state, setState] = useState<ProcessedCaseState | null>(null);
  const [evidence, setEvidence] = useState<CaseDetailPayload["evidence"]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "info" | "error" | "success"; text: string } | null>(null);
  const [upload, setUpload] = useState<UploadForm>({
    evidenceType: "dispatch",
    title: "",
    raw: ""
  });

  const loadCase = useCallback(async function loadCase() {
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}`, { cache: "no-store" });
      const json = (await response.json().catch(() => ({}))) as unknown;
      if (!response.ok) throw new Error(readError(json, "Failed to load case."));
      const detail = normalizeDetail(json);
      setCaseRecord(detail.case ?? null);
      setReport(detail.report ?? null);
      setDraft(currentDraft(detail.report, detail.draft));
      setState(detail.state ?? null);
      setEvidence(detail.evidence ?? []);
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Failed to load case." });
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void loadCase();
  }, [loadCase]);

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setUpload((current) => ({ ...current, title: current.title || file.name, raw: text }));
  }

  async function uploadEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/evidence/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          evidenceType: upload.evidenceType,
          title: upload.title.trim(),
          data: parseEvidenceInput(upload.raw)
        })
      });
      const json = (await response.json().catch(() => ({}))) as unknown;
      if (!response.ok) throw new Error(readError(json, "Evidence upload failed."));
      setUpload({ evidenceType: upload.evidenceType, title: "", raw: "" });
      setNotice({ tone: "success", text: "Evidence uploaded and queued for processing." });
      await loadCase();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Evidence upload failed." });
    } finally {
      setBusy(false);
    }
  }

  async function generateDraft() {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/reports/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId })
      });
      const json = (await response.json().catch(() => ({}))) as { report?: ReportRecord; draft?: DraftReport };
      if (!response.ok) throw new Error(readError(json, "Draft generation failed."));
      setReport(json.report ?? null);
      setDraft(currentDraft(json.report, json.draft));
      setNotice({ tone: "success", text: "Draft generated." });
      await loadCase();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Draft generation failed." });
    } finally {
      setBusy(false);
    }
  }

  const caseNumber = caseRecord?.case_number ?? caseId;
  const timeline = state?.timeline ?? [];
  const contradictions = state?.contradictions ?? draft?.contradictions ?? [];
  const missingInfo = state?.missingInfo ?? draft?.missing_info ?? [];

  return (
    <main className="min-h-screen bg-paper text-ink">
      <ShellHeader
        backHref="/"
        eyebrow="Case Workspace"
        org={caseRecord?.incident_type ?? "Incident documentation"}
        title={caseRecord?.title ?? caseNumber}
        action={
          <div className="flex flex-wrap gap-2">
            <Link className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-bold text-ink hover:bg-paper" href={`/review/${encodeURIComponent(caseNumber)}`}>
              Review
            </Link>
            <button className="rounded-md bg-ink px-3 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={busy || !timeline.length} onClick={() => void generateDraft()}>
              {busy ? "Working..." : "Generate draft"}
            </button>
          </div>
        }
      />

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 md:px-6 lg:grid-cols-[1fr_23rem]">
        <section className="min-w-0 space-y-5">
          {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-md border border-ink/10 bg-white/80 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-ink/45">Status</p>
              <div className="mt-3">
                <StatusBadge status={caseRecord?.status ?? report?.status ?? "open"} />
              </div>
            </div>
            <div className="rounded-md border border-ink/10 bg-white/80 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-ink/45">Evidence</p>
              <p className="mt-2 text-3xl font-black">{loading ? "--" : evidence?.length || state?.processedOrder.length || 0}</p>
            </div>
            <div className="rounded-md border border-ink/10 bg-white/80 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-ink/45">Timeline</p>
              <p className="mt-2 text-3xl font-black">{loading ? "--" : timeline.length}</p>
            </div>
            <div className="rounded-md border border-ink/10 bg-white/80 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-ink/45">Flags</p>
              <p className="mt-2 text-3xl font-black">{loading ? "--" : contradictions.length + missingInfo.length}</p>
            </div>
          </div>

          <section className="rounded-md border border-ink/10 bg-white/85 p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">Report Draft</h2>
                <p className="text-sm text-ink/55">Grounded report output, ready for review when generated.</p>
              </div>
              <Link className="rounded-md border border-ink/15 px-3 py-2 text-sm font-bold hover:bg-paper" href={`/review/${encodeURIComponent(caseNumber)}`}>
                Open review
              </Link>
            </div>
            {draft ? (
              <ReportView report={draft} />
            ) : (
              <EmptyState
                title="No draft generated"
                detail={timeline.length ? "Generate a draft from the processed timeline and extracted facts." : "Upload and process evidence before drafting the report."}
                action={
                  <button className="rounded-md bg-ink px-4 py-2.5 text-sm font-black text-white disabled:opacity-50" disabled={busy || !timeline.length} onClick={() => void generateDraft()}>
                    Generate draft
                  </button>
                }
              />
            )}
          </section>

          <section className="rounded-md border border-ink/10 bg-white/85 p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-black">Timeline</h2>
              <p className="text-sm text-ink/55">Events extracted from processed evidence.</p>
            </div>
            <TimelineView timeline={timeline} />
          </section>
        </section>

        <aside className="space-y-5">
          <form className="rounded-md border border-ink/10 bg-white/85 p-5 shadow-sm" onSubmit={(event) => void uploadEvidence(event)}>
            <h2 className="text-lg font-black">Upload Evidence</h2>
            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <FieldLabel>Evidence Type</FieldLabel>
                <select
                  className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 outline-none focus:border-brass"
                  value={upload.evidenceType}
                  onChange={(event) => setUpload((current) => ({ ...current, evidenceType: event.target.value as EvidenceType }))}
                >
                  <option value="dispatch">Dispatch log</option>
                  <option value="bodycam">Bodycam transcript</option>
                  <option value="officer-notes">Officer notes</option>
                </select>
              </div>
              <div className="space-y-2">
                <FieldLabel>Title</FieldLabel>
                <input
                  className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 outline-none focus:border-brass"
                  placeholder="Initial dispatch log"
                  value={upload.title}
                  onChange={(event) => setUpload((current) => ({ ...current, title: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>File</FieldLabel>
                <input className="w-full text-sm" type="file" accept=".json,.txt,.md,.csv" onChange={(event) => void readFile(event)} />
              </div>
              <div className="space-y-2">
                <FieldLabel>Evidence Content</FieldLabel>
                <textarea
                  className="min-h-40 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-brass"
                  placeholder='Paste JSON or plain text. Empty content lets the backend use its default processor if supported.'
                  value={upload.raw}
                  onChange={(event) => setUpload((current) => ({ ...current, raw: event.target.value }))}
                />
              </div>
              <button className="w-full rounded-md bg-ink px-4 py-3 text-sm font-black text-white disabled:opacity-50" disabled={busy}>
                {busy ? "Uploading..." : "Upload evidence"}
              </button>
            </div>
          </form>

          <FlagsPanel contradictions={contradictions} missingInfo={missingInfo} />

          <div className="rounded-md border border-ink/10 bg-white/80 p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brass">Case Metadata</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="font-bold text-ink/60">Case number</dt>
                <dd className="font-semibold">{caseNumber}</dd>
              </div>
              <div>
                <dt className="font-bold text-ink/60">Created</dt>
                <dd>{formatDate(caseRecord?.created_at)}</dd>
              </div>
              <div>
                <dt className="font-bold text-ink/60">Updated</dt>
                <dd>{formatDate(caseRecord?.updated_at)}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </main>
  );
}
