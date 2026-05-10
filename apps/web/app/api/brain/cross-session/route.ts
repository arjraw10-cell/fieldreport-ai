import { NextRequest, NextResponse } from "next/server";
import { getCrossSessionContext } from "@/lib/nia";

export async function GET(request: NextRequest) {
  const caseId = request.nextUrl.searchParams.get("caseId") ?? "MPD-2025-0519";
  const result = await getCrossSessionContext(caseId);
  return NextResponse.json({ provider: result.provider, findings: result.findings });
}
