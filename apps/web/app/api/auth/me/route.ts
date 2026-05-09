import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ user: null, org: null, membership: null }, { status: 401 });
  return NextResponse.json({
    ...auth,
    user: {
      ...auth.user,
      org: auth.org,
      membership: auth.membership,
      role: auth.membership.role
    }
  });
}
