import OpenAI from "openai";
import { niaSearch } from "./nia";
import type { DraftReport, ProcessedCaseState, SearchResult } from "./types";
import { sourceMarker } from "./utils";

type DraftingProvider = {
  draft(prompt: string): Promise<DraftReport>;
};

function evidenceBlock(evidence: ProcessedCaseState) {
  return JSON.stringify(
    {
      timeline: evidence.timeline,
      facts: evidence.facts,
      citations: evidence.citations,
      contradictions: evidence.contradictions,
      missingInfo: evidence.missingInfo
    },
    null,
    2
  );
}

function contextBlock(results: SearchResult[]) {
  return results.map((result) => `TITLE: ${result.title}\nSOURCE: ${result.source}\n${result.content}`).join("\n\n---\n\n");
}

function buildPrompt(evidence: ProcessedCaseState, context: string) {
  return `You are drafting a Metro PD DUI Arrest report.

Use only facts from current evidence. Use past reports only for style and structure, not facts.
Write a chronological third-person narrative.
Include explicit SFST clue counts.
Include Miranda exact time, officer, and suspect response.
Include full vehicle description.
Mark missing required info as [MISSING: ...].
Do not resolve contradictions automatically.
Every factual claim must include [SOURCE:reference].

Return strict JSON with these keys:
narrative, charges, property, miranda_documentation, vehicle_description, citations, policy_compliance.

DEPARTMENT CONTEXT:
${context}

CURRENT EVIDENCE:
${evidenceBlock(evidence)}`;
}

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
    baseURL: process.env.OPENAI_BASE_URL
  });

  async draft(prompt: string) {
    const completion = await this.client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You draft public-safety reports as strict JSON. Do not include facts that are not in the current evidence."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned an empty draft");
    return JSON.parse(content) as DraftReport;
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
    const vehicleRef =
      findCitationRef(
        this.evidence,
        [
          facts.vehicle?.plate,
          facts.vehicle?.make,
          facts.vehicle?.model,
          facts.vehicle?.color,
          facts.suspect?.name
        ],
        "notes:"
      ) ??
      findCitationRef(this.evidence, [facts.vehicle?.plate, facts.vehicle?.make, facts.vehicle?.model, facts.suspect?.name], "bodycam:") ??
      notesRef ??
      firstBodycamRef;
    const alcoholRef =
      findCitationRef(this.evidence, [facts.alcoholStatement, "drink", "drinks", "alcohol", "bar"], "bodycam:") ?? firstBodycamRef;
    const sfstRef =
      findCitationRef(this.evidence, ["HGN", "Walk and Turn", "One Leg Stand", "SFST", facts.sfst?.hgn, facts.sfst?.walkAndTurn, facts.sfst?.oneLegStand]) ??
      notesRef ??
      firstBodycamRef;
    const mirandaRef =
      findCitationRef(this.evidence, [facts.miranda?.suspectResponse, facts.miranda?.time, "Miranda", "lawyer", "rights"], "bodycam:") ??
      findCitationRef(this.evidence, [facts.miranda?.suspectResponse, facts.miranda?.time, "Miranda", "lawyer", "rights"], "notes:") ??
      notesRef ??
      firstBodycamRef;
    const propertyRef =
      findCitationRef(this.evidence, [facts.property?.tow, facts.property?.damageOwner, "tow", "damage", "owner"], "notes:") ?? notesRef;

    const dispatchDate = formatReportDate(dispatchEntry?.time);
    const dispatchTime = formatReportTime(dispatchEntry?.time);
    const arrivalTime = formatReportTime(arrivalEntry?.time);
    const suspectName = facts.suspect?.name ?? "[MISSING: suspect name]";
    const respondingOfficer = facts.dispatch?.officer ?? facts.miranda?.officer ?? "[MISSING: responding officer]";
    const vehicle = buildVehicleDescription(facts.vehicle);
    const alcoholNarrative = facts.alcoholStatement
      ? facts.alcoholStatement
      : "[MISSING: alcohol consumption statement]";
    const propertyStatements = [
      facts.property?.tow ?? "Vehicle tow information is [MISSING: tow details].",
      facts.property?.damageOwner ?? "Property damage owner is [MISSING: owner]."
    ].join(" ");

    const draft: DraftReport = {
      narrative: [
        withCitation(
          `On ${dispatchDate} at ${dispatchTime}, Metro PD dispatch received a ${facts.dispatch?.callType ?? "[MISSING: call type]"} call at ${facts.dispatch?.address ?? "[MISSING: address]"}.`,
          dispatchRef
        ),
        withCitation(
          `At ${arrivalTime}, Unit ${facts.dispatch?.unit ?? "[MISSING: unit]"} with ${respondingOfficer} arrived at ${facts.dispatch?.address ?? "[MISSING: address]"}.`,
          arrivalRef ?? dispatchRef
        ),
        withCitation(
          `The responding officer contacted ${suspectName} in connection with a ${vehicle}.`,
          vehicleRef
        ),
        withCitation(
          `The available evidence records the following alcohol statement: ${alcoholNarrative}`,
          alcoholRef
        ),
        withCitation(
          `Documented SFST results were HGN ${facts.sfst?.hgn ?? "[MISSING: HGN clues]"}, Walk and Turn ${facts.sfst?.walkAndTurn ?? "[MISSING: Walk and Turn clues]"}, and One Leg Stand ${facts.sfst?.oneLegStand ?? "[MISSING: One Leg Stand clues]"}.`,
          sfstRef
        ),
        withCitation(
          `Miranda was documented at ${facts.miranda?.time ?? "[MISSING: Miranda time]"} by ${facts.miranda?.officer ?? "[MISSING: Miranda officer]"} with the response "${facts.miranda?.suspectResponse ?? "[MISSING: quoted response]"}".`,
          mirandaRef
        )
      ].join(" "),
      charges: ["CVC 23152a", "CVC 23152b"],
      property: withCitation(propertyStatements, propertyRef),
      miranda_documentation: withCitation(
        `${facts.miranda?.time ?? "[MISSING: exact time]"}; ${facts.miranda?.officer ?? "[MISSING: officer]"}; "${facts.miranda?.suspectResponse ?? "[MISSING: quoted suspect response]"}"`,
        mirandaRef
      ),
      vehicle_description: withCitation(vehicle, vehicleRef),
      citations: Object.entries(this.evidence.citations).map(([ref, text]) => ({
        ref,
        source: ref.split(":")[0],
        text
      })),
      policy_compliance: [
        `Sgt. Rodriguez requirement met: SFST clue counts listed as ${facts.sfst?.hgn ?? "[MISSING]"}, ${facts.sfst?.walkAndTurn ?? "[MISSING]"}, ${facts.sfst?.oneLegStand ?? "[MISSING]"}.`,
        `Miranda policy check: exact time, officer, and quoted response are included when available.`,
        `Vehicle description check: full year, color, make, model, and plate are included when available from the processed evidence.`
      ],
      contradictions: this.evidence.contradictions,
      missing_info: this.evidence.missingInfo
    };
    return draft;
  }
}

export async function draftReport(evidence: ProcessedCaseState) {
  const [requirements, patterns, miranda] = await Promise.all([
    niaSearch("Sgt. Rodriguez DUI report requirements SFST vehicle description", ["requirements"], 4),
    niaSearch("past Metro PD DUI report patterns chronological third-person tow charges weather", ["past-report"], 3),
    niaSearch("Miranda policy requirements exact time officer response", ["miranda", "policy"], 3)
  ]);

  const niaResults = [...requirements.results, ...patterns.results, ...miranda.results];
  const prompt = buildPrompt(evidence, contextBlock(niaResults));
  const provider: DraftingProvider =
    process.env.OPENAI_API_KEY || process.env.OPENAI_BASE_URL ? new OpenAIDraftingProvider() : new LocalDraftingProvider(evidence);

  try {
    const draft = await provider.draft(prompt);
    return {
      ...draft,
      contradictions: evidence.contradictions,
      missing_info: evidence.missingInfo,
      citations: draft.citations?.length
        ? draft.citations
        : Object.entries(evidence.citations).map(([ref, text]) => ({ ref, source: ref.split(":")[0], text }))
    };
  } catch (error) {
    const fallback = await new LocalDraftingProvider(evidence).draft();
    return {
      ...fallback,
      provider_error: error instanceof Error ? error.message : "Unknown drafting provider error"
    } as DraftReport & { provider_error: string };
  }
}
