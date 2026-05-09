"use client";

import type { DraftReport } from "@/lib/types";

export default function CitationPopup({
  citation,
  onClose
}: {
  citation: DraftReport["citations"][number] | null;
  onClose: () => void;
}) {
  if (!citation) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4" onClick={onClose}>
      <div className="max-w-xl rounded-2xl border border-ink/15 bg-paper p-6 shadow-card" onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brass">Citation</p>
            <h3 className="font-display text-2xl text-ink">{citation.ref}</h3>
          </div>
          <button className="rounded-full border border-ink/20 px-3 py-1 text-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-slateblue">{citation.source}</p>
        <p className="whitespace-pre-wrap rounded-xl bg-white/70 p-4 text-sm leading-6 text-ink/80">{citation.text}</p>
      </div>
    </div>
  );
}
