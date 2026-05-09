"use client";

import { useState } from "react";
import type { DraftReport } from "@/lib/types";
import CitationPopup from "./CitationPopup";

function renderWithCitations(text: string | undefined, citations: DraftReport["citations"], onCitation: (ref: string) => void) {
  if (!text?.trim()) return <span className="text-ink/45">No content provided.</span>;

  const parts = text.split(/(\[SOURCE:[^\]]+\])/g);
  return parts.map((part, index) => {
    const match = part.match(/^\[SOURCE:([^\]]+)\]$/);
    if (!match) return <span key={index}>{part}</span>;

    const ref = match[1];
    const citationExists = citations.some((citation) => citation.ref === ref);
    if (!citationExists) {
      return (
        <span key={index} className="mx-1 rounded-full border border-ink/15 bg-paper px-2 py-1 text-[0.68rem] font-bold uppercase tracking-wide text-ink/45">
          {ref} missing
        </span>
      );
    }

    return (
      <button key={index} className="source-badge mx-1" onClick={() => onCitation(ref)}>
        {ref}
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
  const citations = Array.isArray(report.citations) ? report.citations : [];
  const charges = Array.isArray(report.charges) ? report.charges : [];
  const policyCompliance = Array.isArray(report.policy_compliance) ? report.policy_compliance : [];
  const selectedCitation = citations.find((citation) => citation.ref === selectedRef) ?? null;

  function update<K extends keyof DraftReport>(key: K, value: DraftReport[K]) {
    onChange?.({ ...report, [key]: value });
  }

  return (
    <div className="space-y-5">
      <CitationPopup citation={selectedCitation} onClose={() => setSelectedRef(null)} />
      {selectedRef && !selectedCitation && (
        <div className="rounded-2xl border border-signal/20 bg-white/85 p-4 text-sm text-ink/70 shadow-sm">
          Source <span className="font-semibold text-ink">{selectedRef}</span> was referenced by this draft, but the citation text is not available.
          <button className="ml-3 font-bold text-signal" onClick={() => setSelectedRef(null)}>
            Dismiss
          </button>
        </div>
      )}

      <section className="rounded-2xl border border-ink/10 bg-white/80 p-5 shadow-sm">
        <h2 className="mb-3 font-display text-2xl text-ink">Narrative</h2>
        {editable ? (
          <textarea
            className="min-h-56 w-full rounded-xl border border-ink/15 bg-paper/60 p-3 text-sm leading-6"
            value={report.narrative ?? ""}
            onChange={(event) => update("narrative", event.target.value)}
          />
        ) : (
          <p className="text-sm leading-7 text-ink/80">{renderWithCitations(report.narrative, citations, setSelectedRef)}</p>
        )}
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border border-ink/10 bg-white/80 p-5 shadow-sm">
          <h3 className="mb-2 font-display text-xl">Charges</h3>
          {editable ? (
            <textarea
              className="min-h-24 w-full rounded-xl border border-ink/15 bg-paper/60 p-3 text-sm"
              value={charges.join("\n")}
              onChange={(event) => update("charges", event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))}
            />
          ) : charges.length ? (
            <ul className="space-y-2 text-sm text-ink/80">
              {charges.map((charge, index) => (
                <li key={`${charge}-${index}`}>{charge}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink/45">No charges listed.</p>
          )}
        </section>
        <section className="rounded-2xl border border-ink/10 bg-white/80 p-5 shadow-sm">
          <h3 className="mb-2 font-display text-xl">Vehicle</h3>
          {editable ? (
            <textarea
              className="min-h-24 w-full rounded-xl border border-ink/15 bg-paper/60 p-3 text-sm"
              value={report.vehicle_description ?? ""}
              onChange={(event) => update("vehicle_description", event.target.value)}
            />
          ) : (
            <p className="text-sm leading-6 text-ink/80">{renderWithCitations(report.vehicle_description, citations, setSelectedRef)}</p>
          )}
        </section>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border border-ink/10 bg-white/80 p-5 shadow-sm">
          <h3 className="mb-2 font-display text-xl">Miranda</h3>
          {editable ? (
            <textarea
              className="min-h-24 w-full rounded-xl border border-ink/15 bg-paper/60 p-3 text-sm"
              value={report.miranda_documentation ?? ""}
              onChange={(event) => update("miranda_documentation", event.target.value)}
            />
          ) : (
            <p className="text-sm leading-6 text-ink/80">{renderWithCitations(report.miranda_documentation, citations, setSelectedRef)}</p>
          )}
        </section>
        <section className="rounded-2xl border border-ink/10 bg-white/80 p-5 shadow-sm">
          <h3 className="mb-2 font-display text-xl">Property</h3>
          {editable ? (
            <textarea
              className="min-h-24 w-full rounded-xl border border-ink/15 bg-paper/60 p-3 text-sm"
              value={report.property ?? ""}
              onChange={(event) => update("property", event.target.value)}
            />
          ) : (
            <p className="text-sm leading-6 text-ink/80">{renderWithCitations(report.property, citations, setSelectedRef)}</p>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-ink/10 bg-white/80 p-5 shadow-sm">
        <h3 className="mb-3 font-display text-xl">Policy Compliance</h3>
        {policyCompliance.length ? (
          <ul className="space-y-2 text-sm text-ink/80">
            {policyCompliance.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink/45">No policy checks were returned with this draft.</p>
        )}
      </section>

      <section className="rounded-2xl border border-ink/10 bg-white/80 p-5 shadow-sm">
        <h3 className="mb-3 font-display text-xl">Citations</h3>
        {citations.length ? (
          <ul className="space-y-2 text-sm text-ink/80">
            {citations.map((citation) => (
              <li key={citation.ref}>
                <button className="source-badge mr-2" onClick={() => setSelectedRef(citation.ref)}>
                  {citation.ref}
                </button>
                <span>{citation.source}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink/45">No citation details are attached to this draft.</p>
        )}
      </section>
    </div>
  );
}
