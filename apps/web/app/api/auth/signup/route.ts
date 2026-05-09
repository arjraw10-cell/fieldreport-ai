import { NextRequest, NextResponse } from "next/server";
import { createUserWithOrganization } from "@/lib/db";
import { createLoginSession, hashPassword, setLoginCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    name?: string;
    organizationName?: string;
  };

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const name = body.name?.trim() || email?.split("@")[0]?.replace(/[._-]+/g, " ") || "FieldReport User";
  const organizationName = body.organizationName?.trim() || `${name} Team`;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  try {
    const result = await createUserWithOrganization({
      email,
      name,
      organizationName,
      passwordHash: hashPassword(password)
    });
    const session = await createLoginSession(result.user.id);
    return setLoginCookie(
      NextResponse.json({
        user: { ...result.user, org: result.org, membership: result.membership, role: result.membership.role },
        org: result.org,
        membership: result.membership
      }),
      session.token,
      session.expiresAt
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Signup failed." }, { status: 400 });
  }
}
