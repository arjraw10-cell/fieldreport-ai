import { NextRequest, NextResponse } from "next/server";
import { clearLoginSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  return clearLoginSession(request, NextResponse.json({ status: "signed_out" }));
}
