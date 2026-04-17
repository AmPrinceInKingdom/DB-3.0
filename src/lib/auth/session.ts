import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth/jwt";

export const sessionCookieName = "deal_bazaar_session";

function getCookieOptions(maxAgeDays = 7) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * maxAgeDays,
  };
}

export async function setSessionCookie(response: NextResponse, token: string) {
  const maxAgeDays = Number(process.env.SESSION_EXPIRES_IN_DAYS ?? 7);
  response.cookies.set(sessionCookieName, token, getCookieOptions(maxAgeDays));
}

export async function clearSessionCookie(response: NextResponse) {
  response.cookies.delete(sessionCookieName);
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (!token) return null;

  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}
