"use client";

import type { AuditRecord } from "@/lib/types";

function compact(value: string | null) {
  if (!value) return "None";
  return value.length > 220 ? `${value.slice(0, 220)}...` : value;
}

export default function AuditTrailView({ audit }: { audit: AuditRecord[] }) {
  return (
    <div className="space-y-3">
      {audit.map((row) => (
        <article key={row.id} className="rounded-2xl border border-ink/10 bg-white/80 p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brass">{row.action}</p>
              <h3 className="font-semibold text-ink">{row.field ?? "report"}</h3>
            </div>
            <div className="text-right text-xs text-ink/55">
              <p>{row.actor}</p>
              <p>{new Date(row.created_at).toLocaleString()}</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-paper/70 p-3">
              <p className="mb-1 text-xs font-bold uppercase text-ink/45">Before</p>
              <p className="break-words text-xs leading-5 text-ink/70">{compact(row.before)}</p>
            </div>
            <div className="rounded-xl bg-paper/70 p-3">
              <p className="mb-1 text-xs font-bold uppercase text-ink/45">After</p>
              <p className="break-words text-xs leading-5 text-ink/70">{compact(row.after)}</p>
            </div>
          </div>
        </article>
      ))}
      {!audit.length && <p className="rounded-2xl bg-white/75 p-5 text-sm text-ink/65">No audit rows yet.</p>}
    </div>
  );
}
