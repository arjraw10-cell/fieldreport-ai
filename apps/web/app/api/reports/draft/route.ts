import { NextRequest, NextResponse } from "next/server";
import { draftReport } from "@/lib/agent";
import { addAudit, createReport, getCaseByIdOrNumber, getCaseByNumber, getLatestReportForCase, seedCase } from "@/lib/db";
import { getCaseState } from "@/lib/tensorlake";
import { DEMO_CASE_NUMBER } from "@/lib/demo";
import { getAuthContext } from "@/lib/auth";

const draftedFields = ["narrative", "charges", "property", "miranda_documentation", "vehicle_description", "policy_compliance"] as const;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { caseId?: string; actor?: string };
  const auth = await getAuthContext(request);
  const caseNumber = body.caseId ?? DEMO_CASE_NUMBER;
  const actor = auth?.user.name ?? body.actor ?? "FieldReport AI";
  const caseRecord = auth ? await getCaseByIdOrNumber(caseNumber, auth.org.id) : (await getCaseByNumber(caseNumber)) ?? (await seedCase(caseNumber));
  if (!caseRecord) return NextResponse.json({ error: "Case not found." }, { status: 404 });
  const evidence = await getCaseState(caseRecord.case_number, auth?.org.id);

  if (!evidence.timeline.length) {
    return NextResponse.json({ error: "No processed evidence exists for this case." }, { status: 400 });
  }

  const draft = await draftReport(evidence);
  const report = await createReport(caseRecord.id, draft);

  for (const field of draftedFields) {
    await addAudit({
      report_id: report.id,
      action: "ai_drafted",
      actor,
      field,
      before: null,
      after: JSON.stringify(draft[field]),
      evidence_ref: "processed-case-state"
    });
  }

  return NextResponse.json({ report, draft });
}

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request);
  const caseNumber = request.nextUrl.searchParams.get("caseId") ?? DEMO_CASE_NUMBER;
  const caseRecord = auth ? await getCaseByIdOrNumber(caseNumber, auth.org.id) : await getCaseByNumber(caseNumber);
  if (!caseRecord) return NextResponse.json({ report: null, case: null });
  const report = await getLatestReportForCase(caseRecord.id);
  return NextResponse.json({ case: caseRecord, report });
}
