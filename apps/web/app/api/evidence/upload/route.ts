import { NextRequest, NextResponse } from "next/server";
import { getCaseByIdOrNumber, getCaseByNumber, seedCase, createEvidenceItem, updateEvidenceStatus } from "@/lib/db";
import { processEvidence } from "@/lib/tensorlake";
import type { EvidenceType } from "@/lib/types";
import { DEMO_CASE_NUMBER } from "@/lib/demo";
import { EVIDENCE } from "@/lib/sample-data";
import { getAuthContext } from "@/lib/auth";

function loadSampleEvidence(evidenceType: EvidenceType) {
  return EVIDENCE[evidenceType];
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    caseId?: string;
    evidenceType?: EvidenceType;
    title?: string;
    data?: unknown;
    text?: string;
  };
  const auth = await getAuthContext(request);
  const caseId = body.caseId ?? DEMO_CASE_NUMBER;
  const evidenceType = body.evidenceType;
  if (!evidenceType) {
    return NextResponse.json({ error: "evidenceType is required" }, { status: 400 });
  }

  const caseRecord = auth ? await getCaseByIdOrNumber(caseId, auth.org.id) : await seedCase(caseId);
  if (!caseRecord) return NextResponse.json({ error: "Case not found." }, { status: 404 });

  const bodyData = normalizeSubmittedEvidence(evidenceType, body.data, body.title);
  if (auth && !bodyData && !body.text?.trim()) {
    return NextResponse.json({ error: "Evidence content is required." }, { status: 400 });
  }
  const data = bodyData ?? (body.text ? textToEvidence(evidenceType, body.text, body.title) : loadSampleEvidence(evidenceType));
  const evidence = auth
    ? await createEvidenceItem({
        caseId: caseRecord.id,
        orgId: auth.org.id,
        type: evidenceType,
        title: body.title?.trim() || labelForEvidence(evidenceType),
        sourceRef: sourceRefForEvidence(evidenceType, data),
        content: data
      })
    : null;

  try {
    const result = await processEvidence(caseRecord.case_number, evidenceType, data, auth?.org.id);
    if (evidence) await updateEvidenceStatus(evidence.id, "processed");
    return NextResponse.json({ ...result, evidence });
  } catch (error) {
    if (evidence) await updateEvidenceStatus(evidence.id, "failed", error instanceof Error ? error.message : "Processing failed.");
    return NextResponse.json({ error: error instanceof Error ? error.message : "Processing failed." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const caseId = request.nextUrl.searchParams.get("caseId") ?? DEMO_CASE_NUMBER;
  const auth = await getAuthContext(request);
  const record = auth ? await getCaseByIdOrNumber(caseId, auth.org.id) : await getCaseByNumber(caseId);
  return NextResponse.json({ case: record, state: record?.evidence_json ?? null });
}

function labelForEvidence(evidenceType: EvidenceType) {
  if (evidenceType === "bodycam") return "Bodycam transcript";
  if (evidenceType === "dispatch") return "Dispatch log";
  return "Officer notes";
}

function sourceRefForEvidence(evidenceType: EvidenceType, data: unknown) {
  const sourceRef = typeof data === "object" && data && "source_ref" in data ? String((data as { source_ref?: string }).source_ref) : "";
  if (sourceRef) return sourceRef;
  if (evidenceType === "dispatch" && typeof data === "object" && data && "incident_id" in data) {
    return `dispatch:${String((data as { incident_id?: string }).incident_id)}`;
  }
  return `${evidenceType}:${Date.now()}`;
}

function textToEvidence(evidenceType: EvidenceType, text: string, title?: string) {
  if (evidenceType === "dispatch") {
    return {
      incident_id: title || `CAD-${Date.now()}`,
      call_type: inferCallType(text),
      received: new Date().toISOString(),
      address: inferAddress(text),
      beat: "unassigned",
      division: "unassigned",
      units: []
    };
  }

  if (evidenceType === "bodycam") {
    return {
      evidence_type: "bodycam",
      recording_start: new Date().toISOString(),
      source_ref: `bodycam:${Date.now()}`,
      transcript: text
        .split(/\n+/)
        .map((line, index) => line.trim())
        .filter(Boolean)
        .map((line, index) => ({ offset_seconds: index * 30, speaker: "Unknown", text: line }))
    };
  }

  return {
    source_ref: `notes:${Date.now()}`,
    notes: text
  };
}

function normalizeSubmittedEvidence(evidenceType: EvidenceType, data: unknown, title?: string) {
  if (!data) return null;
  if (typeof data === "object" && "text" in data && typeof (data as { text?: unknown }).text === "string") {
    return textToEvidence(evidenceType, String((data as { text: string }).text), title);
  }
  return data;
}

function inferCallType(text: string) {
  const match = text.match(/(?:call type|type)[:\s-]+([^.\n]+)/i);
  return match?.[1]?.trim() || "INCIDENT";
}

function inferAddress(text: string) {
  const match = text.match(/\b\d{2,6}\s+[A-Z0-9 .'-]+(?:ST|STREET|AVE|AVENUE|RD|ROAD|DR|DRIVE|BLVD|WAY|LANE|LN)\b/i);
  return match?.[0]?.trim() || "[MISSING: address]";
}
