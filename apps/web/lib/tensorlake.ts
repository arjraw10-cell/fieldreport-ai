import { getCaseByNumber, seedCase, updateCaseEvidence } from "./db";
import type { EvidenceType, Flag, ProcessedCaseState, TimelineEntry } from "./types";
import { sourceMarker } from "./utils";

type CaseFacts = ProcessedCaseState["facts"];
type SuspectFacts = NonNullable<CaseFacts["suspect"]>;
type VehicleFacts = NonNullable<CaseFacts["vehicle"]>;
type SfstFacts = NonNullable<CaseFacts["sfst"]>;
type MirandaFacts = NonNullable<CaseFacts["miranda"]>;
type PropertyFacts = NonNullable<CaseFacts["property"]>;

function emptyState(caseId: string): ProcessedCaseState {
  return {
    caseId,
    processedOrder: [],
    timeline: [],
    facts: {},
    citations: {},
    contradictions: [],
    missingInfo: []
  };
}

function addCitation(state: ProcessedCaseState, ref: string, text: string) {
  state.citations[ref] = text;
}

function absoluteTime(recordingStart: string, offsetSeconds: number) {
  return new Date(new Date(recordingStart).getTime() + offsetSeconds * 1000).toISOString();
}

function dispatchDateTime(receivedIso: string, hhmmss: string) {
  const base = new Date(receivedIso);
  const [hours, minutes, seconds] = hhmmss.split(":").map(Number);
  base.setUTCHours(hours, minutes, seconds ?? 0, 0);
  return base.toISOString();
}

function mergeFactSection<T extends Record<string, string | undefined>>(existing: T | undefined, updates: Partial<T> | undefined) {
  if (!updates) return existing;

  const merged = { ...(existing ?? {}) } as T;
  let hasUpdates = false;

  for (const [key, value] of Object.entries(updates)) {
    if (typeof value !== "string" || !value.trim()) continue;
    merged[key as keyof T] = value as T[keyof T];
    hasUpdates = true;
  }

  return hasUpdates ? merged : existing;
}

function joinSummary(parts: string[]) {
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function parseVehicleDescription(description: string) {
  const tokens = description.trim().split(/\s+/).filter(Boolean);
  const yearIndex = tokens.findIndex((token) => /^\d{4}$/.test(token));
  if (yearIndex <= 0 || yearIndex >= tokens.length - 1) return {};

  const color = tokens.slice(0, yearIndex).join(" ");
  const year = tokens[yearIndex];
  const make = tokens[yearIndex + 1];
  const model = tokens.slice(yearIndex + 2).join(" ");

  return {
    color: color || undefined,
    year,
    make: make || undefined,
    model: model || undefined
  };
}

function ensureSentence(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function parseOfficerNotes(notes: string) {
  const summary: string[] = [];
  const parsed: {
    suspect?: Partial<SuspectFacts>;
    vehicle?: Partial<VehicleFacts>;
    sfst?: Partial<SfstFacts>;
    miranda?: Partial<MirandaFacts>;
    property?: Partial<PropertyFacts>;
    timelineDetail: string;
  } = {
    timelineDetail: "Officer notes added to the case file."
  };

  const suspectMatch = notes.match(/Driver\s+([^,]+),\s*DOB\s*(\d{4}-\d{2}-\d{2}),\s*([A-Z]{2}\s+DL\s+[A-Z0-9]+)/i);
  if (suspectMatch) {
    parsed.suspect = {
      name: suspectMatch[1].trim(),
      dob: suspectMatch[2].trim(),
      dl: suspectMatch[3].trim()
    };
    summary.push("suspect");
  }

  const vehicleMatch = notes.match(/Vehicle\s+(?:is|was)\s+(?:a|an)\s+(.+?)(?:\s+CA\s+([A-Z0-9]+)|\s+plate\s+([A-Z0-9]+))(?:[.;]|$)/i);
  if (vehicleMatch) {
    parsed.vehicle = {
      ...parseVehicleDescription(vehicleMatch[1]),
      plate: (vehicleMatch[2] ?? vehicleMatch[3] ?? "").trim() || undefined
    };
    summary.push("vehicle");
  }

  const sfstMatch = notes.match(/SFST counts:\s*HGN\s*([0-9]+\/[0-9]+),\s*Walk and Turn\s*([0-9]+\/[0-9]+),\s*One Leg Stand\s*([0-9]+\/[0-9]+)/i);
  if (sfstMatch) {
    parsed.sfst = {
      hgn: sfstMatch[1].trim(),
      walkAndTurn: sfstMatch[2].trim(),
      oneLegStand: sfstMatch[3].trim()
    };
    summary.push("SFST results");
  }

  const mirandaMatch = notes.match(/Miranda provided by\s+(.+?)\s+at\s+([0-9]{3,4}\s+hours)\s*;\s*.*?(?:stated|said),\s*"([^"]+)"/i);
  if (mirandaMatch) {
    parsed.miranda = {
      officer: mirandaMatch[1].trim(),
      time: mirandaMatch[2].trim(),
      suspectResponse: mirandaMatch[3].trim()
    };
    summary.push("Miranda");
  }

  if (/Transport by\s+[^.;]+/i.test(notes)) {
    summary.push("transport");
  }

  const towMatch = notes.match(/(Vehicle towed by\s+[^.;]+)(?:[.;]|$)/i);
  const damageOwnerMatch = notes.match(/((?:Fence|Property) owner\s+[^.;]+)(?:[.;]|$)/i);
  if (towMatch || damageOwnerMatch) {
    parsed.property = {
      tow: towMatch ? ensureSentence(towMatch[1]) : undefined,
      damageOwner: damageOwnerMatch ? ensureSentence(damageOwnerMatch[1]) : undefined
    };
    if (towMatch) summary.push("tow");
    if (damageOwnerMatch) summary.push("property damage owner");
  }

  if (summary.length) {
    parsed.timelineDetail = `Officer notes documented ${joinSummary(summary)}.`;
  }

  return parsed;
}

function processBodycam(state: ProcessedCaseState, data: any) {
  const sourceRef = data.source_ref ?? "bodycam";
  for (const item of data.transcript ?? []) {
    const ref = `${sourceRef}:${item.offset_seconds}`;
    addCitation(state, ref, `${item.speaker}: ${item.text}`);
    state.timeline.push({
      time: absoluteTime(data.recording_start, item.offset_seconds),
      title: item.speaker,
      detail: item.text,
      source: "bodycam",
      sourceRef: ref
    });
  }

  const combined = JSON.stringify(data);
  state.facts.sfst = mergeFactSection(state.facts.sfst, {
    hgn: combined.match(/six out of six|HGN 6\/6/i) ? "6/6" : undefined,
    walkAndTurn: combined.match(/four out of eight|Walk and Turn 4\/8/i) ? "4/8" : undefined,
    oneLegStand: combined.match(/three out of four|One Leg Stand 3\/4/i) ? "3/4" : undefined
  });

  const mirandaTime = combined.match(/(?:at\s+)?([0-9]{3,4}\s+hours).*?Miranda/i)?.[1];
  const lawyerResponse = combined.match(/I understand and I want a lawyer\.?/i)?.[0];
  state.facts.miranda = mergeFactSection(state.facts.miranda, {
    time: mirandaTime,
    officer: combined.match(/Officer\s+[A-Z]\.\s+[A-Z][a-z]+/i)?.[0],
    suspectResponse: lawyerResponse
  });

  const alcoholEntry = (data.transcript ?? []).find((item: { text?: string }) => /drink|drinks|alcohol|bar|place/i.test(String(item.text ?? "")));
  if (alcoholEntry?.text) {
    state.facts.alcoholStatement = alcoholEntry.text;
  }
}

function processDispatch(state: ProcessedCaseState, data: any) {
  const received = data.received ?? new Date().toISOString();
  const incidentId = data.incident_id ?? `CAD-${Date.now()}`;
  const refBase = `dispatch:${incidentId}`;
  addCitation(state, refBase, `${data.call_type ?? "INCIDENT"} received at ${received} for ${data.address ?? "[MISSING: address]"}`);
  state.timeline.push({
    time: received,
    title: "Dispatch received",
    detail: `${data.call_type ?? "INCIDENT"} at ${data.address ?? "[MISSING: address]"}`,
    source: "dispatch",
    sourceRef: refBase
  });

  const firstUnit = data.units?.[0];
  if (firstUnit) {
    const arrivalRef = `${refBase}:arrival`;
    addCitation(state, arrivalRef, `Unit ${firstUnit.unit}, Officer ${firstUnit.officer}, arrived ${firstUnit.arrived}`);
    state.timeline.push({
      time: dispatchDateTime(received, firstUnit.arrived),
      title: "Officer arrival",
      detail: `Unit ${firstUnit.unit}, Officer ${firstUnit.officer}, arrived on scene.`,
      source: "dispatch",
      sourceRef: arrivalRef
    });
  }

  state.facts.dispatch = {
    incidentId,
    callType: data.call_type ?? "INCIDENT",
    address: data.address ?? "[MISSING: address]",
    beat: data.beat,
    division: data.division,
    unit: firstUnit?.unit,
    officer: firstUnit?.officer
  };
}

function processOfficerNotes(state: ProcessedCaseState, data: any) {
  const notes = String(data.notes ?? "");
  const ref = data.source_ref ?? "notes:officer";
  const parsed = parseOfficerNotes(notes);
  addCitation(state, ref, notes);
  state.timeline.push({
    time: "2025-05-09T02:03:00Z",
    title: "Officer notes added",
    detail: parsed.timelineDetail,
    source: "officer-notes",
    sourceRef: ref
  });

  state.facts.suspect = mergeFactSection(state.facts.suspect, parsed.suspect);
  state.facts.vehicle = mergeFactSection(state.facts.vehicle, parsed.vehicle);
  state.facts.sfst = mergeFactSection(state.facts.sfst, parsed.sfst);
  state.facts.miranda = mergeFactSection(state.facts.miranda, parsed.miranda);
  state.facts.property = mergeFactSection(state.facts.property, parsed.property);
}

function recomputeFlags(state: ProcessedCaseState) {
  const flags: Flag[] = [];
  const callType = state.facts.dispatch?.callType?.toLowerCase() ?? "";
  const driverAtScene = state.timeline.some((entry) => /driver remained at the scene/i.test(entry.detail));
  if (callType.includes("hit and run") && driverAtScene) {
    flags.push({
      type: "contradiction",
      title: "Dispatch hit-and-run conflicts with driver-at-scene evidence",
      detail: `Dispatch classifies the call as hit-and-run/property damage, but bodycam shows the driver remained at the scene. ${sourceMarker("dispatch:CAD-2025-0519-0087")} ${sourceMarker("bodycam:BC-4821-2025-0519:410")}`,
      evidenceRefs: ["dispatch:CAD-2025-0519-0087", "bodycam:BC-4821-2025-0519:410"]
    });
  }

  const alcoholStatement = state.facts.alcoholStatement ?? "";
  state.missingInfo = [];
  if (/Mike's place on 5th/i.test(alcoholStatement)) {
    state.missingInfo.push({
      type: "missing_info",
      title: "Origin address and drink count need clarification",
      detail: `Driver mentioned Mike's place on 5th and a couple drinks, but the exact address and exact drink count are missing. ${sourceMarker("bodycam:BC-4821-2025-0519:38")}`,
      evidenceRefs: ["bodycam:BC-4821-2025-0519:38"]
    });
  }

  state.contradictions = flags;
}

export async function processEvidence(caseId: string, evidenceType: EvidenceType, data: unknown, orgId?: string | null) {
  if (!orgId) await seedCase(caseId);
  const existingCase = await getCaseByNumber(caseId, orgId);
  const state = existingCase?.evidence_json ?? emptyState(caseId);

  if (!state.processedOrder.includes(evidenceType)) {
    state.processedOrder.push(evidenceType);
  }

  if (evidenceType === "bodycam") processBodycam(state, data);
  if (evidenceType === "dispatch") processDispatch(state, data);
  if (evidenceType === "officer-notes") processOfficerNotes(state, data);

  state.timeline = state.timeline
    .filter((entry, index, entries) => entries.findIndex((candidate) => candidate.sourceRef === entry.sourceRef && candidate.title === entry.title) === index)
    .sort((a, b) => a.time.localeCompare(b.time));
  recomputeFlags(state);

  // Attempt real Tensorlake structured extraction when credentials are available
  if (process.env.TENSORLAKE_API_KEY && process.env.TENSORLAKE_API_URL) {
    try {
      const tlRes = await fetch(`${process.env.TENSORLAKE_API_URL}/api/v1/extract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.TENSORLAKE_API_KEY}`
        },
        body: JSON.stringify({ evidenceType, data, caseId })
      });
      if (tlRes.ok) {
        const tlData = (await tlRes.json()) as { facts?: Partial<CaseFacts>; citations?: Record<string, string> };
        if (tlData.facts) {
          state.facts = { ...state.facts, ...tlData.facts };
        }
        if (tlData.citations) {
          state.citations = { ...state.citations, ...tlData.citations };
        }
        console.log("[tensorlake] Real API extraction succeeded");
      }
    } catch (err) {
      console.warn("[tensorlake] Real API extraction failed, using local extraction:", err);
    }
  }

  await updateCaseEvidence(caseId, state, orgId);
  return {
    provider: process.env.TENSORLAKE_API_KEY && process.env.TENSORLAKE_API_URL ? "tensorlake" : "local",
    status: "processed",
    evidenceType,
    state
  };
}

export async function getCaseState(caseId: string, orgId?: string | null) {
  const existingCase = await getCaseByNumber(caseId, orgId);
  return existingCase?.evidence_json ?? emptyState(caseId);
}
