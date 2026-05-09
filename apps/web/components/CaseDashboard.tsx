"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { EmptyState, FieldLabel, Notice, ShellHeader, StatusBadge } from "@/components/OpsPrimitives";

type AuthProfile = {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  org?: { id?: string; name?: string };
  organization?: { id?: string; name?: string };
  membership?: { role?: string };
};

type CaseSummary = {
  id: string;
  case_number?: string | null;
  caseNumber?: string | null;
  title?: string | null;
  incident_type?: string | null;
  incidentType?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  evidence_count?: number | null;
  report_status?: string | null;
};

type CreateCaseForm = {
  caseNumber: string;
  title: string;
  incidentType: string;
};

function readError(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") return payload.error;
  if (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string") return payload.message;
  return fallback;
}

function normalizeUser(payload: unknown): AuthProfile | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as { user?: AuthProfile; authUser?: AuthProfile; profile?: AuthProfile };
  return record.user ?? record.authUser ?? record.profile ?? (payload as AuthProfile);
}

function normalizeCases(payload: unknown): CaseSummary[] {
  if (Array.isArray(payload)) return payload as CaseSummary[];
  if (!payload || typeof payload !== "object") return [];
  const record = payload as { cases?: CaseSummary[]; items?: CaseSummary[]; data?: CaseSummary[] };
  return record.cases ?? record.items ?? record.data ?? [];
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function caseNumber(item: CaseSummary) {
  return item.case_number ?? item.caseNumber ?? item.id;
}

function incidentType(item: CaseSummary) {
  return item.incident_type ?? item.incidentType ?? "Incident";
}

export default function CaseDashboard() {
  const [user, setUser] = useState<AuthProfile | null>(null);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<{ tone: "info" | "error" | "success"; text: string } | null>(null);
  const [form, setForm] = useState<CreateCaseForm>({
    caseNumber: "",
    title: "",
    incidentType: "Field Incident"
  });

  async function loadDashboard() {
    setLoading(true);
    setNotice(null);
    try {
      const [authResponse, casesResponse] = await Promise.all([
        fetch("/api/auth/me", { cache: "no-store" }),
        fetch("/api/cases", { cache: "no-store" })
      ]);
      const authJson = (await authResponse.json().catch(() => ({}))) as unknown;
      const casesJson = (await casesResponse.json().catch(() => ({}))) as unknown;

      if (authResponse.status === 401) {
        window.location.assign("/login");
        return;
      }
      if (!authResponse.ok) throw new Error(readError(authJson, "Sign in is required to open the operations dashboard."));
      if (!casesResponse.ok) throw new Error(readError(casesJson, "Failed to load cases."));

      setUser(normalizeUser(authJson));
      setCases(normalizeCases(casesJson));
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Failed to load dashboard." });
      setCases([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function logout() {
    setNotice(null);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(readError(json, "Logout failed."));
      }
      window.location.assign("/");
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Logout failed." });
    }
  }

  async function createCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setNotice(null);
    try {
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseNumber: form.caseNumber.trim(),
          case_number: form.caseNumber.trim(),
          title: form.title.trim(),
          incidentType: form.incidentType,
          incident_type: form.incidentType
        })
      });
      const json = (await response.json().catch(() => ({}))) as unknown;
      if (!response.ok) throw new Error(readError(json, "Failed to create case."));

      const created = (json && typeof json === "object" && "case" in json ? (json as { case?: CaseSummary }).case : json) as CaseSummary | undefined;
      setForm({ caseNumber: "", title: "", incidentType: "Field Incident" });
      setNotice({ tone: "success", text: "Case created." });

      if (created?.id || created?.case_number || created?.caseNumber) {
        window.location.assign(`/cases/${encodeURIComponent(caseNumber(created))}`);
        return;
      }

      await loadDashboard();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Failed to create case." });
    } finally {
      setCreating(false);
    }
  }

  const org = user?.org ?? user?.organization;
  const role = user?.membership?.role ?? user?.role;
  const openCount = cases.filter((item) => !["approved", "closed"].includes((item.status ?? "").toLowerCase())).length;
  const reviewCount = cases.filter((item) => ["needs_review", "draft_ready"].includes((item.status ?? "").toLowerCase())).length;

  return (
    <main className="min-h-screen bg-paper text-ink">
      <ShellHeader
        eyebrow="FieldReport AI"
        org={[org?.name, role].filter(Boolean).join(" / ")}
        title="Case Operations"
        user={user?.name ?? user?.email}
        action={
          <button className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-bold text-ink hover:bg-ink hover:text-white" onClick={() => void logout()}>
            Logout
          </button>
        }
      />

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 md:px-6 lg:grid-cols-[1fr_23rem]">
        <section className="min-w-0 space-y-5">
          {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-ink/10 bg-white/80 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-ink/45">Open Cases</p>
              <p className="mt-2 text-3xl font-black">{loading ? "--" : openCount}</p>
            </div>
            <div className="rounded-md border border-ink/10 bg-white/80 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-ink/45">Needs Review</p>
              <p className="mt-2 text-3xl font-black">{loading ? "--" : reviewCount}</p>
            </div>
            <div className="rounded-md border border-ink/10 bg-white/80 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-ink/45">Total</p>
              <p className="mt-2 text-3xl font-black">{loading ? "--" : cases.length}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-md border border-ink/10 bg-white/85 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-4 py-3">
              <div>
                <h2 className="text-lg font-black">Cases</h2>
                <p className="text-sm text-ink/55">Evidence, drafting, and review status across active incidents.</p>
              </div>
              <button className="rounded-md border border-ink/15 px-3 py-2 text-sm font-bold hover:bg-paper" onClick={() => void loadDashboard()}>
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="space-y-3 p-4">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-16 animate-pulse rounded-md bg-ink/5" />
                ))}
              </div>
            ) : cases.length ? (
              <div className="divide-y divide-ink/10">
                {cases.map((item) => (
                  <Link
                    key={item.id}
                    className="grid gap-3 px-4 py-4 hover:bg-paper/70 md:grid-cols-[1fr_10rem_9rem_8rem]"
                    href={`/cases/${encodeURIComponent(caseNumber(item))}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-black">{item.title || caseNumber(item)}</p>
                      <p className="mt-1 text-sm text-ink/55">
                        {caseNumber(item)} / {incidentType(item)}
                      </p>
                    </div>
                    <div className="text-sm text-ink/65">
                      <p className="font-bold text-ink/80">Updated</p>
                      <p>{formatDate(item.updated_at ?? item.created_at)}</p>
                    </div>
                    <div className="text-sm text-ink/65">
                      <p className="font-bold text-ink/80">Evidence</p>
                      <p>{item.evidence_count ?? "Pending"}</p>
                    </div>
                    <div className="flex items-start md:justify-end">
                      <StatusBadge status={item.report_status ?? item.status} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-4">
                <EmptyState title="No cases yet" detail="Create the first incident case to start uploading evidence and generating grounded reports." />
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <form className="rounded-md border border-ink/10 bg-white/85 p-5 shadow-sm" onSubmit={(event) => void createCase(event)}>
            <h2 className="text-lg font-black">Create Case</h2>
            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <FieldLabel>Case Number</FieldLabel>
                <input
                  className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 outline-none focus:border-brass"
                  placeholder="FR-2026-0142"
                  required
                  value={form.caseNumber}
                  onChange={(event) => setForm((current) => ({ ...current, caseNumber: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Title</FieldLabel>
                <input
                  className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 outline-none focus:border-brass"
                  placeholder="Traffic stop at Main and 4th"
                  required
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Incident Type</FieldLabel>
                <select
                  className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 outline-none focus:border-brass"
                  value={form.incidentType}
                  onChange={(event) => setForm((current) => ({ ...current, incidentType: event.target.value }))}
                >
                  <option>Field Incident</option>
                  <option>DUI Investigation</option>
                  <option>Traffic Collision</option>
                  <option>Campus Safety</option>
                  <option>Insurance Field Claim</option>
                  <option>Compliance Incident</option>
                </select>
              </div>
              <button className="w-full rounded-md bg-ink px-4 py-3 text-sm font-black text-white disabled:opacity-50" disabled={creating}>
                {creating ? "Creating..." : "Create case"}
              </button>
            </div>
          </form>

          <div className="rounded-md border border-ink/10 bg-white/80 p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brass">Review Entry</p>
            <p className="mt-2 text-sm leading-6 text-ink/65">Open a case to upload evidence, generate a draft, and continue into the review workbench.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
