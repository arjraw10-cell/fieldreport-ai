import { NextRequest } from "next/server";
import { DEMO_USERS } from "@/lib/demo";

export const DEMO_SESSION_COOKIE = "fieldreport-demo-user";

export function getDemoUserByName(name?: string | null) {
  if (!name) return null;
  return DEMO_USERS.find((user) => user.name === name) ?? null;
}

export function getDefaultDemoUser() {
  return DEMO_USERS[0];
}

export function resolveDemoUser(name?: string | null) {
  return getDemoUserByName(name) ?? getDefaultDemoUser();
}

export function getDemoUserFromRequest(request: NextRequest) {
  return resolveDemoUser(request.cookies.get(DEMO_SESSION_COOKIE)?.value ?? null);
}
