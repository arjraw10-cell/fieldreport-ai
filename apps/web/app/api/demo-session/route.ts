import { NextRequest, NextResponse } from "next/server";
import { DEMO_SESSION_COOKIE, getDemoUserByName, getDemoUserFromRequest } from "@/lib/demo-session";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function withDemoSession(response: NextResponse, userName: string) {
  response.cookies.set(DEMO_SESSION_COOKIE, userName, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production"
  });
  return response;
}

export async function GET(request: NextRequest) {
  const user = getDemoUserFromRequest(request);
  return withDemoSession(NextResponse.json({ user }), user.name);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { user?: string };
  const user = getDemoUserByName(body.user ?? null);

  if (!user) {
    return NextResponse.json({ error: "Unknown demo user." }, { status: 400 });
  }

  return withDemoSession(NextResponse.json({ user }), user.name);
}
