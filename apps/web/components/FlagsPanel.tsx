"use client";

import type { Flag } from "@/lib/types";

export default function FlagsPanel({ contradictions, missingInfo }: { contradictions: Flag[]; missingInfo: Flag[] }) {
  const flags = [...contradictions, ...missingInfo];
  return (
    <aside className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brass">Review Flags</p>
        <h2 className="font-display text-2xl text-ink">{flags.length} items</h2>
      </div>
      {flags.map((flag) => (
        <div key={`${flag.type}-${flag.title}`} className="rounded-2xl border border-signal/20 bg-white/85 p-4 shadow-sm">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-signal">{flag.type.replace("_", " ")}</p>
          <h3 className="mb-2 font-semibold text-ink">{flag.title}</h3>
          <p className="text-sm leading-6 text-ink/75">{flag.detail}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {flag.evidenceRefs.map((ref) => (
              <span key={ref} className="source-badge">
                {ref}
              </span>
            ))}
          </div>
        </div>
      ))}
      {!flags.length && <p className="rounded-2xl bg-white/75 p-4 text-sm text-ink/70">No flags found for this case.</p>}
    </aside>
  );
}
