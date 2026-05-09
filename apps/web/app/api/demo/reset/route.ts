import { NextRequest, NextResponse } from "next/server";
import { clearLoginSession, requireAuth } from "@/lib/auth";
import { resetApplicationState } from "@/lib/db";
import { hsReset } from "@/lib/hyperspell";
import { niaReset } from "@/lib/nia";

export async function POST(request: NextRequest) {
  const { auth, response } = await requireAuth(request);
  if (!auth) return response;

  try {
    await resetApplicationState();
    hsReset();
    niaReset();
    return clearLoginSession(request, NextResponse.json({ status: "reset", scope: "application" }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to reset application." }, { status: 500 });
  }
}
