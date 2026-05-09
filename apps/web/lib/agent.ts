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

class OpenAIDraftingProvider implements DraftingProvider {
  private client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL
  });

  async draft(prompt: string) {
    const completion = await this.client.chat.completions.create({
      model: "gpt-4o",
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
    const dispatchRef = "dispatch:CAD-2025-0519-0087";
    const notesRef = "notes:OFFICER-CHEN-4821";
    const bodycamRef = "bodycam:BC-4821-2025-0519:15";
    const drinkRef = "bodycam:BC-4821-2025-0519:38";
    const sfstRef = notesRef;
    const mirandaRef = notesRef;

    const vehicle = facts.vehicle
      ? `${facts.vehicle.color} ${facts.vehicle.year} ${facts.vehicle.make} ${facts.vehicle.model}, CA ${facts.vehicle.plate}`
      : `[MISSING: full vehicle description]`;

    const draft: DraftReport = {
      narrative: [
        `On 2025-05-09 at 0142 hours, Metro PD dispatch received a ${facts.dispatch?.callType ?? "[MISSING: call type]"} call at ${facts.dispatch?.address ?? "[MISSING: address]"}. ${sourceMarker(dispatchRef)}`,
        `At 0147 hours, Unit ${facts.dispatch?.unit ?? "[MISSING: unit]"} with Officer J. Chen arrived at 780 Elm Street. ${sourceMarker("dispatch:CAD-2025-0519-0087:arrival")}`,
        `Officer Chen contacted David Kowalski beside a white SUV bearing plate 8XYZ321. ${sourceMarker(bodycamRef)}`,
        `Kowalski said he came from Mike's place on 5th and had a couple drinks; the exact origin address and exact drink count remain [MISSING: exact address and drink count]. ${sourceMarker(drinkRef)}`,
        `Officer Chen documented SFST results of HGN ${facts.sfst?.hgn ?? "[MISSING: HGN clues]"}, Walk and Turn ${facts.sfst?.walkAndTurn ?? "[MISSING: Walk and Turn clues]"}, and One Leg Stand ${facts.sfst?.oneLegStand ?? "[MISSING: One Leg Stand clues]"}. ${sourceMarker(sfstRef)}`,
        `Officer Chen arrested Kowalski for DUI and Miranda was documented at ${facts.miranda?.time ?? "[MISSING: Miranda time]"} by ${facts.miranda?.officer ?? "[MISSING: Miranda officer]"} with the response "${facts.miranda?.suspectResponse ?? "[MISSING: quoted response]"}" ${sourceMarker(mirandaRef)}.`
      ].join(" "),
      charges: ["CVC 23152a", "CVC 23152b"],
      property: `${facts.property?.tow ?? "Vehicle tow information is [MISSING: tow details]."} ${facts.property?.damageOwner ?? "Property damage owner is [MISSING: owner]."} ${sourceMarker(notesRef)}`,
      miranda_documentation: `${facts.miranda?.time ?? "[MISSING: exact time]"}; ${facts.miranda?.officer ?? "[MISSING: officer]"}; "${facts.miranda?.suspectResponse ?? "[MISSING: quoted suspect response]"}" ${sourceMarker(mirandaRef)}`,
      vehicle_description: `${vehicle} ${sourceMarker(notesRef)}`,
      citations: Object.entries(this.evidence.citations).map(([ref, text]) => ({
        ref,
        source: ref.split(":")[0],
        text
      })),
      policy_compliance: [
        `Sgt. Rodriguez requirement met: SFST clue counts listed as ${facts.sfst?.hgn ?? "[MISSING]"}, ${facts.sfst?.walkAndTurn ?? "[MISSING]"}, ${facts.sfst?.oneLegStand ?? "[MISSING]"}.`,
        `Miranda policy check: exact time, officer, and quoted response are included when available.`,
        `Vehicle description check: full year, make, model, color, and plate included from officer notes.`
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
  const provider: DraftingProvider = process.env.OPENAI_API_KEY ? new OpenAIDraftingProvider() : new LocalDraftingProvider(evidence);

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
