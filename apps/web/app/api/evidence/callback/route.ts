import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    status: "accepted",
    mode: "local-simulation",
    note: "No-op endpoint reserved for a future real Tensorlake callback."
  });
}
