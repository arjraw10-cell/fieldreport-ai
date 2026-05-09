import { NextResponse } from "next/server";
import { initializeDepartmentBrain } from "@/lib/seed";

export async function POST() {
  const result = await initializeDepartmentBrain();
  return NextResponse.json(result);
}
