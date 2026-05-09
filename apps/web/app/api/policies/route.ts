import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listPolicies, upsertPolicy } from "@/lib/db";
import { niaIndex } from "@/lib/nia";

export async function GET(request: NextRequest) {
  const { auth, response } = await requireAuth(request);
  if (!auth) return response;
  return NextResponse.json({ policies: await listPolicies(auth.org.id) });
}

export async function POST(request: NextRequest) {
  const { auth, response } = await requireAuth(request);
  if (!auth) return response;

  const body = (await request.json().catch(() => ({}))) as { title?: string; content?: string; source?: string };
  const title = body.title?.trim();
  const content = body.content?.trim();
  if (!title || !content) return NextResponse.json({ error: "Policy title and content are required." }, { status: 400 });

  const policy = await upsertPolicy(auth.org.id, title, content, body.source?.trim() || "manual");
  await niaIndex(`${auth.org.name} ${title}`, content, ["policy", "org", auth.org.id], { source: policy.source, orgId: auth.org.id });
  return NextResponse.json({ policy }, { status: 201 });
}
