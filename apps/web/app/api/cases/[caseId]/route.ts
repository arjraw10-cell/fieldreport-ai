import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getAudit, getCaseByIdOrNumber, getLatestReportForCase, listEvidenceForCase } from "@/lib/db";

export async function GET(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const { auth, response } = await requireAuth(request);
  if (!auth) return response;

  const { caseId } = await params;
  const record = await getCaseByIdOrNumber(decodeURIComponent(caseId), auth.org.id);
  if (!record) return NextResponse.json({ error: "Case not found." }, { status: 404 });

  const [evidence, report] = await Promise.all([listEvidenceForCase(record.id), getLatestReportForCase(record.id)]);
  const audit = report ? await getAudit(report.id) : [];
  return NextResponse.json({ case: record, evidence, report, audit, state: record.evidence_json });
}
