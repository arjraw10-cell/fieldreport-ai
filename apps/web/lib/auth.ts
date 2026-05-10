import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSession, deleteSession, getAuthContextBySession } from "./db";

export const SESSION_COOKIE = "fieldreport_session";
const SESSION_DAYS = 30;
const PASSWORD_ITERATIONS = 120000;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, 32, "sha256").toString("hex");
  return `pbkdf2:${PASSWORD_ITERATIONS}:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [kind, iterations, salt, expected] = stored.split(":");
  if (kind !== "pbkdf2" || !iterations || !salt || !expected) return false;
  const actual = pbkdf2Sync(password, salt, Number(iterations), 32, "sha256");
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createLoginSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await createSession(userId, hashToken(token), expiresAt);
  return { token, expiresAt };
}

export async function getAuthContext(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getAuthContextBySession(hashToken(token));
}

export async function getAuthContextFromToken(token?: string | null) {
  if (!token) return null;
  return getAuthContextBySession(hashToken(token));
}

export async function requireAuth(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return {
      auth: null,
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 })
    };
  }
  return { auth, response: null };
}

export async function clearLoginSession(request: NextRequest, response: NextResponse) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(hashToken(token));
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production"
  });
  return response;
}

export function setLoginCookie(response: NextResponse, token: string, expiresAt: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
    secure: process.env.NODE_ENV === "production"
  });
  return response;
}
