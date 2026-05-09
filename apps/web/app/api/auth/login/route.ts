import { NextRequest, NextResponse } from "next/server";
import { createLoginSession, setLoginCookie, verifyPassword } from "@/lib/auth";
import { getAuthContextBySession, getUserByEmail } from "@/lib/db";
import { createHash } from "crypto";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const user = await getUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const session = await createLoginSession(user.id);
  const tokenHash = createHash("sha256").update(session.token).digest("hex");
  const auth = await getAuthContextBySession(tokenHash);
  return setLoginCookie(
    NextResponse.json(
      auth
        ? {
            ...auth,
            user: { ...auth.user, org: auth.org, membership: auth.membership, role: auth.membership.role }
          }
        : null
    ),
    session.token,
    session.expiresAt
  );
}
