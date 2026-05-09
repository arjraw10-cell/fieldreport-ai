"use client";

import { useState } from "react";
import type { DraftReport } from "@/lib/types";
import CitationPopup from "./CitationPopup";

function renderWithCitations(text: string, onCitation: (ref: string) => void) {
  const parts = text.split(/(\[SOURCE:[^\]]+\])/g);
  return parts.map((part, index) => {
    const match = part.match(/^\[SOURCE:([^\]]+)\]$/);
    if (!match) return <span key={index}>{part}</span>;
    return (
      <button key={index} className="source-badge mx-1" onClick={() => onCitation(match[1])}>
        {match[1]}
      </button>
    );
  });
}

export default function ReportView({
  report,
  editable = false,
  onChange
}: {
  report: DraftReport;
  editable?: boolean;
  onChange?: (draft: DraftReport) => void;
}) {
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const selectedCitation = report.citations.find((citation) => citation.ref === selectedRef) ?? null;

  function update<K extends keyof DraftReport>(key: K, value: DraftReport[K]) {
    onChange?.({ ...report, [key]: value });
  }

  return (
    <div className="space-y-5">
      <CitationPopup citation={selectedCitation} onClose={() => setSelectedRef(null)} />

      <section className="rounded-2xl border border-ink/10 bg-white/80 p-5 shadow-sm">
        <h2 className="mb-3 font-display text-2xl text-ink">Narrative</h2>
        {editable ? (
          <textarea
            className="min-h-56 w-full rounded-xl border border-ink/15 bg-paper/60 p-3 text-sm leading-6"
            value={report.narrative}
            onChange={(event) => update("narrative", event.target.value)}
          />
        ) : (
          <p className="text-sm leading-7 text-ink/80">{renderWithCitations(report.narrative, setSelectedRef)}</p>
        )}
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border border-ink/10 bg-white/80 p-5 shadow-sm">
          <h3 className="mb-2 font-display text-xl">Charges</h3>
          {editable ? (
            <textarea
              className="min-h-24 w-full rounded-xl border border-ink/15 bg-paper/60 p-3 text-sm"
              value={report.charges.join("\n")}
              onChange={(event) => update("charges", event.target.value.split("\n").filter(Boolean))}
            />
          ) : (
            <ul className="space-y-2 text-sm text-ink/80">
              {report.charges.map((charge) => (
                <li key={charge}>{charge}</li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-2xl border border-ink/10 bg-white/80 p-5 shadow-sm">
          <h3 className="mb-2 font-display text-xl">Vehicle</h3>
          {editable ? (
            <textarea
              className="min-h-24 w-full rounded-xl border border-ink/15 bg-paper/60 p-3 text-sm"
              value={report.vehicle_description}
              onChange={(event) => update("vehicle_description", event.target.value)}
            />
          ) : (
            <p className="text-sm leading-6 text-ink/80">{renderWithCitations(report.vehicle_description, setSelectedRef)}</p>
          )}
        </section>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border border-ink/10 bg-white/80 p-5 shadow-sm">
          <h3 className="mb-2 font-display text-xl">Miranda</h3>
          {editable ? (
            <textarea
              className="min-h-24 w-full rounded-xl border border-ink/15 bg-paper/60 p-3 text-sm"
              value={report.miranda_documentation}
              onChange={(event) => update("miranda_documentation", event.target.value)}
            />
          ) : (
            <p className="text-sm leading-6 text-ink/80">{renderWithCitations(report.miranda_documentation, setSelectedRef)}</p>
          )}
        </section>
        <section className="rounded-2xl border border-ink/10 bg-white/80 p-5 shadow-sm">
          <h3 className="mb-2 font-display text-xl">Property</h3>
          {editable ? (
            <textarea
              className="min-h-24 w-full rounded-xl border border-ink/15 bg-paper/60 p-3 text-sm"
              value={report.property}
              onChange={(event) => update("property", event.target.value)}
            />
          ) : (
            <p className="text-sm leading-6 text-ink/80">{renderWithCitations(report.property, setSelectedRef)}</p>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-ink/10 bg-white/80 p-5 shadow-sm">
        <h3 className="mb-3 font-display text-xl">Policy Compliance</h3>
        <ul className="space-y-2 text-sm text-ink/80">
          {report.policy_compliance.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
