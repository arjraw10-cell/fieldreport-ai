import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { getCaseByIdOrNumber, getLatestReportForCase, listEvidenceForCase } from "@/lib/db";

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request);
  const caseId = request.nextUrl.searchParams.get("caseId");
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!caseId) return NextResponse.json({ error: "caseId is required." }, { status: 400 });

  const record = await getCaseByIdOrNumber(caseId, auth.org.id);
  if (!record) return NextResponse.json({ error: "Case not found." }, { status: 404 });
  const report = await getLatestReportForCase(record.id);
  if (!report) return NextResponse.json({ error: "No report exists for this case." }, { status: 404 });

  const draft = report.final ?? report.human_edit ?? report.ai_draft;
  const evidence = await listEvidenceForCase(record.id);
  const lines = [
    `FieldReport AI Export`,
    `Organization: ${auth.org.name}`,
    `Case: ${record.case_number}`,
    `Title: ${record.title ?? record.case_number}`,
    `Incident Type: ${record.incident_type}`,
    `Status: ${report.status}`,
    ``,
    `Narrative`,
    draft.narrative,
    ``,
    `Charges`,
    ...draft.charges.map((charge) => `- ${charge}`),
    ``,
    `Vehicle`,
    draft.vehicle_description,
    ``,
    `Miranda`,
    draft.miranda_documentation,
    ``,
    `Property`,
    draft.property,
    ``,
    `Flags`,
    ...[...draft.contradictions, ...draft.missing_info].map((flag) => `- ${flag.type}: ${flag.title} (${flag.evidenceRefs.join(", ")})`),
    ``,
    `Evidence Inventory`,
    ...evidence.map((item) => `- ${item.title} [${item.type}] ${item.status}`),
    ``,
    `Citations`,
    ...draft.citations.map((citation) => `- ${citation.ref}: ${citation.text}`)
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="${record.case_number}-packet.txt"`
    }
  });
}
