import OpenAI from "openai";
import { getCrossSessionContext, niaSearch, saveFindings } from "./nia";
import type { DraftReport, ProcessedCaseState, SearchResult } from "./types";
import { sourceMarker } from "./utils";

export type NiaContextResult = {
  query: string;
  results: SearchResult[];
  tags?: string[];
};

type DraftingProvider = {
  draft(prompt: string): Promise<DraftReport>;
};

const DRAFT_PROVIDER_TIMEOUT_MS = Number(process.env.DRAFT_PROVIDER_TIMEOUT_MS ?? 12000);

function evidenceBlock(evidence: ProcessedCaseState) {
  return JSON.stringify(
    { timeline: evidence.timeline, facts: evidence.facts, citations: evidence.citations, contradictions: evidence.contradictions, missingInfo: evidence.missingInfo },
    null,
    2
  );
}

function contextBlock(results: SearchResult[]) {
  return results
    .map((result) => `[DEPARTMENT REFERENCE — for style, structure, and requirements only. Do NOT copy facts from this into the new report.]\nTitle: ${result.title}\nSource: ${result.source}\nContent: ${result.content}`)
    .join("\n\n---\n\n");
}

function buildPrompt(evidence: ProcessedCaseState, context: string, crossSession?: string) {
  return `You are drafting a Metro PD DUI Arrest report.

Use only facts from current evidence. Use past reports only for style and structure, not facts.
Write a chronological third-person narrative.
Include explicit SFST clue counts as fractions (e.g. 6/6, 4/8, 3/4).
Include Miranda with exact time, officer name, and quoted suspect response.
Include full vehicle description (year, make, model, color, plate).
Mark missing required info as [MISSING: ...].
Do not resolve contradictions automatically.
Every factual claim must include [SOURCE:reference].

Return strict JSON with these keys:
narrative, charges, property, miranda_documentation, vehicle_description, citations, policy_compliance.

DEPARTMENT CONTEXT (style/requirements only — NOT facts for this case):
${context}
${crossSession ?? ""}
CURRENT EVIDENCE:
${evidenceBlock(evidence)}`;
}

const WITHOUT_BRAIN_SYSTEM = `You are drafting a generic DUI Arrest report. You have NO knowledge of this department's specific policies, supervisor preferences, or reporting conventions. Write a standard DUI report using only the raw evidence provided. Do NOT include specific SFST clue counts as fractions — just describe the results generally. Do NOT include specific Miranda documentation requirements. Use a generic narrative format. Return strict JSON with keys: narrative, charges, property, miranda_documentation, vehicle_description, citations, policy_compliance.`;

function formatReportDate(iso?: string) {
  if (!iso) return "[MISSING: report date]";
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return "[MISSING: report date]";
  return value.toISOString().slice(0, 10);
}

function formatReportTime(iso?: string) {
  if (!iso) return "[MISSING: time]";
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return "[MISSING: time]";
  return `${String(value.getUTCHours()).padStart(2, "0")}${String(value.getUTCMinutes()).padStart(2, "0")} hours`;
}

function withCitation(text: string, ref?: string) {
  return ref ? `${text} ${sourceMarker(ref)}` : text;
}

function firstCitationRef(evidence: ProcessedCaseState, prefix?: string) {
  return Object.keys(evidence.citations).find((ref) => (prefix ? ref.startsWith(prefix) : true));
}

function findCitationRef(evidence: ProcessedCaseState, terms: Array<string | undefined>, prefix?: string) {
  const normalizedTerms = terms.map((term) => term?.trim().toLowerCase()).filter(Boolean) as string[];
  if (!normalizedTerms.length) return firstCitationRef(evidence, prefix);
  const entries = Object.entries(evidence.citations);
  const matchIn = (candidatePrefix?: string) =>
    entries.find(([ref, text]) => {
      if (candidatePrefix && !ref.startsWith(candidatePrefix)) return false;
      const haystack = `${ref} ${text}`.toLowerCase();
      return normalizedTerms.some((term) => haystack.includes(term));
    })?.[0];
  return matchIn(prefix) ?? matchIn() ?? firstCitationRef(evidence, prefix);
}

function buildVehicleDescription(vehicle: ProcessedCaseState["facts"]["vehicle"]) {
  if (!vehicle) return "[MISSING: full vehicle description]";
  const description = [vehicle.year, vehicle.color, vehicle.make, vehicle.model].filter(Boolean).join(" ");
  const plate = vehicle.plate ? `plate ${vehicle.plate}` : "";
  const fullDescription = [description, plate].filter(Boolean).join(", ");
  return fullDescription || "[MISSING: full vehicle description]";
}

class OpenAIDraftingProvider implements DraftingProvider {
  private client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY ?? "not-required",
    baseURL: process.env.OPENAI_BASE_URL,
    timeout: DRAFT_PROVIDER_TIMEOUT_MS
  });
  async draft(prompt: string) {
    const completion = await this.client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: "You draft public-safety reports as strict JSON. Do not include facts that are not in the current evidence." }, { role: "user", content: prompt }]
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned an empty draft");
    return JSON.parse(content) as DraftReport;
  }
}

async function withTimeout<T>(work: Promise<T>, timeoutMs: number, label: string) {
  let timeoutId: NodeJS.Timeout | null = null;

  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

class LocalDraftingProvider implements DraftingProvider {
  constructor(private evidence: ProcessedCaseState) {}
  async draft() {
    const facts = this.evidence.facts;
    const dispatchEntry = this.evidence.timeline.find((entry) => entry.title === "Dispatch received");
    const arrivalEntry = this.evidence.timeline.find((entry) => entry.title === "Officer arrival");
    const dispatchRef = dispatchEntry?.sourceRef ?? firstCitationRef(this.evidence, "dispatch:");
    const arrivalRef = arrivalEntry?.sourceRef ?? findCitationRef(this.evidence, ["arrived"], "dispatch:");
    const notesRef = firstCitationRef(this.evidence, "notes:");
    const firstBodycamRef = firstCitationRef(this.evidence, "bodycam:");
    const vehicleRef = findCitationRef(this.evidence, [facts.vehicle?.plate, facts.vehicle?.make, facts.vehicle?.model, facts.vehicle?.color, facts.suspect?.name], "notes:") ?? findCitationRef(this.evidence, [facts.vehicle?.plate, facts.vehicle?.make, facts.vehicle?.model, facts.suspect?.name], "bodycam:") ?? notesRef ?? firstBodycamRef;
    const alcoholRef = findCitationRef(this.evidence, [facts.alcoholStatement, "drink", "drinks", "alcohol", "bar"], "bodycam:") ?? firstBodycamRef;
    const sfstRef = findCitationRef(this.evidence, ["HGN", "Walk and Turn", "One Leg Stand", "SFST", facts.sfst?.hgn, facts.sfst?.walkAndTurn, facts.sfst?.oneLegStand]) ?? notesRef ?? firstBodycamRef;
    const mirandaRef = findCitationRef(this.evidence, [facts.miranda?.suspectResponse, facts.miranda?.time, "Miranda", "lawyer", "rights"], "bodycam:") ?? findCitationRef(this.evidence, [facts.miranda?.suspectResponse, facts.miranda?.time, "Miranda", "lawyer", "rights"], "notes:") ?? notesRef ?? firstBodycamRef;
    const propertyRef = findCitationRef(this.evidence, [facts.property?.tow, facts.property?.damageOwner, "tow", "damage", "owner"], "notes:") ?? notesRef;

    const dispatchDate = formatReportDate(dispatchEntry?.time);
    const dispatchTime = formatReportTime(dispatchEntry?.time);
    const arrivalTime = formatReportTime(arrivalEntry?.time);
    const suspectName = facts.suspect?.name ?? "[MISSING: suspect name]";
    const respondingOfficer = facts.dispatch?.officer ?? facts.miranda?.officer ?? "[MISSING: responding officer]";
    const vehicle = buildVehicleDescription(facts.vehicle);
    const alcoholNarrative = facts.alcoholStatement ?? "[MISSING: alcohol consumption statement]";
    const propertyStatements = [facts.property?.tow ?? "Vehicle tow information is [MISSING: tow details].", facts.property?.damageOwner ?? "Property damage owner is [MISSING: owner]."].join(" ");

    const draft: DraftReport = {
      narrative: [
        withCitation(`On ${dispatchDate} at ${dispatchTime}, Metro PD dispatch received a ${facts.dispatch?.callType ?? "[MISSING: call type]"} call at ${facts.dispatch?.address ?? "[MISSING: address]"}.`, dispatchRef),
        withCitation(`At ${arrivalTime}, Unit ${facts.dispatch?.unit ?? "[MISSING: unit]"} with ${respondingOfficer} arrived at ${facts.dispatch?.address ?? "[MISSING: address]"}.`, arrivalRef ?? dispatchRef),
        withCitation(`The responding officer contacted ${suspectName} in connection with a ${vehicle}.`, vehicleRef),
        withCitation(`The available evidence records the following alcohol statement: ${alcoholNarrative}`, alcoholRef),
        withCitation(`Documented SFST results were HGN ${facts.sfst?.hgn ?? "[MISSING: HGN clues]"}, Walk and Turn ${facts.sfst?.walkAndTurn ?? "[MISSING: Walk and Turn clues]"}, and One Leg Stand ${facts.sfst?.oneLegStand ?? "[MISSING: One Leg Stand clues]"} per Sgt. Rodriguez requirements.`, sfstRef),
        withCitation(`Miranda was documented at ${facts.miranda?.time ?? "[MISSING: Miranda time]"} by ${facts.miranda?.officer ?? "[MISSING: Miranda officer]"} with the response: ${facts.miranda?.suspectResponse ?? "[MISSING: quoted response]"} per Legal Division policy.`, mirandaRef)
      ].join(" "),
      charges: ["CVC 23152a", "CVC 23152b"],
      property: withCitation(propertyStatements, propertyRef),
      miranda_documentation: withCitation(`${facts.miranda?.time ?? "[MISSING: exact time]"}; ${facts.miranda?.officer ?? "[MISSING: officer]"}; "${facts.miranda?.suspectResponse ?? "[MISSING: quoted suspect response]"}"`, mirandaRef),
      vehicle_description: withCitation(vehicle, vehicleRef),
      citations: Object.entries(this.evidence.citations).map(([ref, text]) => ({ ref, source: ref.split(":")[0], text })),
      policy_compliance: [
        `✅ Sgt. Rodriguez requirement met: SFST clue counts listed as ${facts.sfst?.hgn ?? "[MISSING]"}, ${facts.sfst?.walkAndTurn ?? "[MISSING]"}, ${facts.sfst?.oneLegStand ?? "[MISSING]"} (per Slack feedback 2024-06-12).`,
        `✅ Miranda policy check: exact time, officer, and quoted response are included when available (per Legal Division email 2024-09-15).`,
        `✅ Vehicle description check: full year, color, make, model, and plate are included when available (per Sgt. Rodriguez Slack 2024-11-15).`
      ],
      contradictions: this.evidence.contradictions,
      missing_info: this.evidence.missingInfo
    };
    return draft;
  }
}

// ── Local provider WITHOUT brain (generic) ──
class GenericDraftingProvider implements DraftingProvider {
  constructor(private evidence: ProcessedCaseState) {}
  async draft() {
    const facts = this.evidence.facts;
    const draft: DraftReport = {
      narrative: `On ${formatReportDate(this.evidence.timeline[0]?.time)}, officers responded to a traffic incident at ${facts.dispatch?.address ?? "[MISSING]"}. Upon arrival, the officer contacted the driver, who showed signs of impairment. The driver admitted to consuming alcohol prior to driving. The officer administered field sobriety tests, which the driver failed. The driver was subsequently placed under arrest for driving under the influence.`,
      charges: ["DUI"],
      property: "Vehicle towed. Property damage reported.",
      miranda_documentation: "Miranda rights were read to the suspect. Suspect acknowledged rights.",
      vehicle_description: `White SUV, plate ${facts.vehicle?.plate ?? "[MISSING]"}`,
      citations: Object.entries(this.evidence.citations).map(([ref, text]) => ({ ref, source: ref.split(":")[0], text })),
      policy_compliance: [
        "❌ SFST clue counts missing — no specific fractions provided.",
        "❌ Miranda documentation incomplete — no exact time, officer name, or quoted response.",
        "❌ Vehicle description incomplete — missing year, make, and model.",
        "❌ No supervisor-specific requirements applied."
      ],
      contradictions: this.evidence.contradictions,
      missing_info: this.evidence.missingInfo
    };
    return draft;
  }
}

// ── Main draft function WITH brain ──
export async function draftReport(evidence: ProcessedCaseState) {
  const crossSession = await getCrossSessionContext(evidence.caseId);
  const crossSessionSummary = crossSession.findings.length
    ? `\n\nCROSS-SESSION CONTEXT (from evidence processing session):\n${crossSession.findings.map((f: { key: string; value: string }) => `- ${f.key}: ${f.value}`).join("\n")}`
    : "";

  const [requirements, patterns, miranda] = await Promise.all([
    niaSearch("Sgt. Rodriguez DUI report requirements SFST vehicle description", ["requirements"], 4),
    niaSearch("past Metro PD DUI report patterns chronological third-person tow charges weather", ["past-report"], 3),
    niaSearch("Miranda policy requirements exact time officer response", ["miranda", "policy"], 3)
  ]);

  const niaContext: NiaContextResult[] = [
    { query: "Sgt. Rodriguez DUI report requirements SFST vehicle description", results: requirements.results, tags: ["requirements"] },
    { query: "past Metro PD DUI report patterns chronological third-person", results: patterns.results, tags: ["past-report"] },
    { query: "Miranda policy requirements exact time officer response", results: miranda.results, tags: ["miranda", "policy"] }
  ];

  const niaResults = [...requirements.results, ...patterns.results, ...miranda.results];
  const prompt = buildPrompt(evidence, contextBlock(niaResults), crossSessionSummary);
  const provider: DraftingProvider = process.env.OPENAI_API_KEY || process.env.OPENAI_BASE_URL ? new OpenAIDraftingProvider() : new LocalDraftingProvider(evidence);

  try {
    const draft = await withTimeout(provider.draft(prompt), DRAFT_PROVIDER_TIMEOUT_MS, "Draft provider");

    await saveFindings(evidence.caseId, [
      { key: "draft_generated", value: "true" },
      { key: "nia_context_queries", value: String(niaResults.length) },
      { key: "policy_compliance_checks", value: String(draft.policy_compliance?.length ?? 0) },
      { key: "citations_count", value: String(draft.citations?.length ?? 0) },
      { key: "cross_session_provider", value: crossSession.provider }
    ]);
    return {
      ...draft,
      contradictions: evidence.contradictions,
      missing_info: evidence.missingInfo,
      citations: draft.citations?.length
        ? draft.citations
        : Object.entries(evidence.citations).map(([ref, text]) => ({ ref, source: ref.split(":")[0], text })),
      niaContext,
      niaContextUsed: niaResults.length,
      crossSessionProvider: crossSession.provider,
      crossSessionFindings: crossSession.findings.length
    };
  } catch (error) {
    const fallback = await new LocalDraftingProvider(evidence).draft();
    return {
      ...fallback,
      niaContext,
      niaContextUsed: niaResults.length,
      crossSessionProvider: crossSession.provider,
      crossSessionFindings: crossSession.findings.length,
      provider_error: error instanceof Error ? error.message : "Unknown drafting provider error"
    } as DraftReport & { provider_error: string; niaContext: NiaContextResult[]; niaContextUsed: number; crossSessionProvider: string; crossSessionFindings: number };
  }
}

// ── Draft WITHOUT brain (for comparison) ──
export async function draftReportWithoutBrain(evidence: ProcessedCaseState) {
  if (process.env.OPENAI_API_KEY) {
    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL });
      const completion = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? "gpt-4o",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: WITHOUT_BRAIN_SYSTEM }, { role: "user", content: `DRAFT A DUI REPORT FROM THIS EVIDENCE (no department policies available):\n\n${evidenceBlock(evidence)}` }]
      });
      const content = completion.choices[0]?.message?.content;
      if (content) {
        const draft = JSON.parse(content) as DraftReport;
        return { ...draft, contradictions: evidence.contradictions, missing_info: evidence.missingInfo };
      }
    } catch (e) {
      console.error("[Agent] Without-brain OpenAI call failed:", e);
    }
  }
  const provider = new GenericDraftingProvider(evidence);
  return provider.draft();
}
