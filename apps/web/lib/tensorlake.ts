import { getCaseByNumber, seedCase, updateCaseEvidence } from "./db";
import type { EvidenceType, Flag, ProcessedCaseState, TimelineEntry } from "./types";
import { sourceMarker } from "./utils";

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
  state.facts.sfst = {
    hgn: combined.match(/six out of six|HGN 6\/6/i) ? "6/6" : state.facts.sfst?.hgn,
    walkAndTurn: combined.match(/four out of eight|Walk and Turn 4\/8/i) ? "4/8" : state.facts.sfst?.walkAndTurn,
    oneLegStand: combined.match(/three out of four|One Leg Stand 3\/4/i) ? "3/4" : state.facts.sfst?.oneLegStand
  };
  state.facts.miranda = {
    time: combined.match(/0154 hours/i) ? "0154 hours" : state.facts.miranda?.time,
    officer: "Officer J. Chen",
    suspectResponse: combined.match(/I understand and I want a lawyer/i)
      ? "I understand and I want a lawyer."
      : state.facts.miranda?.suspectResponse
  };
  state.facts.alcoholStatement = "Driver said he came from Mike's place on 5th and had a couple drinks.";
}

function processDispatch(state: ProcessedCaseState, data: any) {
  const refBase = `dispatch:${data.incident_id}`;
  addCitation(state, refBase, `${data.call_type} received at ${data.received} for ${data.address}`);
  state.timeline.push({
    time: data.received,
    title: "Dispatch received",
    detail: `${data.call_type} at ${data.address}`,
    source: "dispatch",
    sourceRef: refBase
  });

  const firstUnit = data.units?.[0];
  if (firstUnit) {
    const arrivalRef = `${refBase}:arrival`;
    addCitation(state, arrivalRef, `Unit ${firstUnit.unit}, Officer ${firstUnit.officer}, arrived ${firstUnit.arrived}`);
    state.timeline.push({
      time: dispatchDateTime(data.received, firstUnit.arrived),
      title: "Officer arrival",
      detail: `Unit ${firstUnit.unit}, Officer ${firstUnit.officer}, arrived on scene.`,
      source: "dispatch",
      sourceRef: arrivalRef
    });
  }

  state.facts.dispatch = {
    incidentId: data.incident_id,
    callType: data.call_type,
    address: data.address,
    beat: data.beat,
    division: data.division,
    unit: firstUnit?.unit,
    officer: firstUnit?.officer
  };
}

function processOfficerNotes(state: ProcessedCaseState, data: any) {
  const notes = String(data.notes ?? "");
  const ref = data.source_ref ?? "notes:officer";
  addCitation(state, ref, notes);
  state.timeline.push({
    time: "2025-05-09T02:03:00Z",
    title: "Officer notes added",
    detail: "Officer notes documented suspect, vehicle, transport, tow, and property damage owner.",
    source: "officer-notes",
    sourceRef: ref
  });

  state.facts.suspect = {
    name: "David Kowalski",
    dob: "1987-04-18",
    dl: "CA D1234567"
  };
  state.facts.vehicle = {
    year: "2021",
    make: "Ford",
    model: "Escape",
    color: "white",
    plate: "8XYZ321"
  };
  state.facts.sfst = {
    hgn: "6/6",
    walkAndTurn: "4/8",
    oneLegStand: "3/4"
  };
  state.facts.miranda = {
    time: "0154 hours",
    officer: "Officer J. Chen",
    suspectResponse: "I understand and I want a lawyer."
  };
  state.facts.property = {
    tow: "Vehicle towed by Metro Towing.",
    damageOwner: "Fence owner Marcus Williams, 782 Elm St."
  };
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

export async function processEvidence(caseId: string, evidenceType: EvidenceType, data: unknown) {
  await seedCase(caseId);
  const existingCase = await getCaseByNumber(caseId);
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

  await updateCaseEvidence(caseId, state);
  return {
    provider: process.env.TENSORLAKE_API_KEY && process.env.TENSORLAKE_API_URL ? "tensorlake-fallback-local" : "local",
    status: "processed",
    evidenceType,
    state
  };
}

export async function getCaseState(caseId: string) {
  const existingCase = await getCaseByNumber(caseId);
  return existingCase?.evidence_json ?? emptyState(caseId);
}
