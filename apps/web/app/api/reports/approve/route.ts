import { NextRequest, NextResponse } from "next/server";
import { approveReport, saveHumanEdit } from "@/lib/db";
import type { DraftReport } from "@/lib/types";
import { getAuthContext } from "@/lib/auth";
import { getDemoUserFromRequest } from "@/lib/demo-session";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    reportId?: string;
    final?: DraftReport;
    action?: "save_edit" | "approve";
  };
  if (!body.reportId) {
    return NextResponse.json({ error: "reportId is required" }, { status: 400 });
  }

  const auth = await getAuthContext(request);
  const demoUser = getDemoUserFromRequest(request);
  const actor = auth?.user.name ?? demoUser.name;
  const canEdit = Boolean(auth) || demoUser.canEdit;
  const canApprove = auth?.membership.role === "admin" || auth?.membership.role === "supervisor" || demoUser.canApprove;

  if (body.action === "save_edit") {
    if (!canEdit || !body.final) {
      return NextResponse.json({ error: "User cannot edit or final draft is missing." }, { status: 403 });
    }
    const report = await saveHumanEdit(body.reportId, body.final, actor);
    return NextResponse.json({ status: "saved", report });
  }

  if (!canApprove) {
    return NextResponse.json({ error: `${actor} cannot approve final reports.` }, { status: 403 });
  }

  const report = await approveReport(body.reportId, actor, body.final);
  return NextResponse.json({ status: "approved", report });
}
