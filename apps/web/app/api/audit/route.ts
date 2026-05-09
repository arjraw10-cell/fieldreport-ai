import { NextRequest, NextResponse } from "next/server";
import { getAudit } from "@/lib/db";

export async function GET(request: NextRequest) {
  const reportId = request.nextUrl.searchParams.get("reportId");
  if (!reportId) {
    return NextResponse.json({ error: "reportId is required" }, { status: 400 });
  }
  const rows = await getAudit(reportId);
  return NextResponse.json({ audit: rows });
}
