import { NextRequest, NextResponse } from "next/server";
import { approveReport, saveHumanEdit } from "@/lib/db";
import type { DraftReport } from "@/lib/types";
import { DEMO_USERS } from "@/lib/demo";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    reportId?: string;
    actor?: string;
    final?: DraftReport;
    action?: "save_edit" | "approve";
  };
  if (!body.reportId) {
    return NextResponse.json({ error: "reportId is required" }, { status: 400 });
  }

  const actor = body.actor ?? "Officer Chen";
  const user = DEMO_USERS.find((item) => item.name === actor) ?? DEMO_USERS[0];

  if (body.action === "save_edit") {
    if (!user.canEdit || !body.final) {
      return NextResponse.json({ error: "User cannot edit or final draft is missing." }, { status: 403 });
    }
    const report = await saveHumanEdit(body.reportId, body.final, actor);
    return NextResponse.json({ status: "saved", report });
  }

  if (!user.canApprove) {
    return NextResponse.json({ error: `${actor} cannot approve final reports.` }, { status: 403 });
  }

  const report = await approveReport(body.reportId, actor, body.final);
  return NextResponse.json({ status: "approved", report });
}
