"use client";

import type { TimelineEntry } from "@/lib/types";

const colorBySource = {
  bodycam: "border-brass bg-brass/10",
  dispatch: "border-slateblue bg-slateblue/10",
  "officer-notes": "border-signal bg-signal/10"
};

export default function TimelineView({ timeline }: { timeline: TimelineEntry[] }) {
  return (
    <div className="space-y-3">
      {timeline.map((entry) => (
        <div key={`${entry.time}-${entry.sourceRef}-${entry.title}`} className={`rounded-2xl border-l-4 bg-white/80 p-4 shadow-sm ${colorBySource[entry.source]}`}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-ink">{entry.title}</h3>
            <time className="text-xs font-bold uppercase tracking-wide text-ink/55">{new Date(entry.time).toLocaleString()}</time>
          </div>
          <p className="text-sm leading-6 text-ink/75">{entry.detail}</p>
          <span className="source-badge mt-3">{entry.sourceRef}</span>
        </div>
      ))}
      {!timeline.length && <p className="rounded-2xl bg-white/75 p-5 text-sm text-ink/65">No processed evidence yet.</p>}
    </div>
  );
}
