import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createCase, getLatestReportForCase, listCases, listEvidenceForCase } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { auth, response } = await requireAuth(request);
  if (!auth) return response;
  const records = await listCases(auth.org.id);
  const cases = await Promise.all(
    records.map(async (record) => {
      const [evidence, report] = await Promise.all([listEvidenceForCase(record.id), getLatestReportForCase(record.id)]);
      return {
        ...record,
        evidence_count: evidence.length,
        report_status: report?.status ?? null
      };
    })
  );
  return NextResponse.json({ cases });
}

export async function POST(request: NextRequest) {
  const { auth, response } = await requireAuth(request);
  if (!auth) return response;

  const body = (await request.json().catch(() => ({}))) as {
    caseNumber?: string;
    title?: string;
    incidentType?: string;
  };

  const caseNumber = body.caseNumber?.trim();
  if (!caseNumber) return NextResponse.json({ error: "Case number is required." }, { status: 400 });

  const record = await createCase({
    orgId: auth.org.id,
    caseNumber,
    title: body.title?.trim() || caseNumber,
    incidentType: body.incidentType?.trim() || "Incident"
  });

  return NextResponse.json({ case: record }, { status: 201 });
}
