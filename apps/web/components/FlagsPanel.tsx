"use client";

import type { Flag } from "@/lib/types";

function flagKey(flag: Flag, index: number) {
  return `${flag.type}-${flag.title}-${index}`;
}

export default function FlagsPanel({ contradictions, missingInfo }: { contradictions: Flag[]; missingInfo: Flag[] }) {
  const flags = [...(Array.isArray(contradictions) ? contradictions : []), ...(Array.isArray(missingInfo) ? missingInfo : [])];

  return (
    <aside className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brass">Review Flags</p>
        <h2 className="font-display text-2xl text-ink">{flags.length} items</h2>
      </div>
      {flags.map((flag, index) => {
        const evidenceRefs = Array.isArray(flag.evidenceRefs) ? flag.evidenceRefs : [];

        return (
          <div key={flagKey(flag, index)} className="rounded-2xl border border-signal/20 bg-white/85 p-4 shadow-sm">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-signal">{flag.type.replace("_", " ")}</p>
            <h3 className="mb-2 font-semibold text-ink">{flag.title || "Untitled flag"}</h3>
            <p className="text-sm leading-6 text-ink/75">{flag.detail || "No detail was provided for this flag."}</p>
            {evidenceRefs.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {evidenceRefs.map((ref) => (
                  <span key={ref} className="source-badge">
                    {ref}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink/40">No evidence refs attached</p>
            )}
          </div>
        );
      })}
      {!flags.length && <p className="rounded-2xl bg-white/75 p-4 text-sm text-ink/70">No flags found for this case.</p>}
    </aside>
  );
}
