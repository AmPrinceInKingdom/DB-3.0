import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";
import { enforceRateLimit, enforceSameOriginMutation } from "@/lib/security/request-security";

export async function POST(request: Request) {
  const originError = enforceSameOriginMutation(request);
  if (originError) return originError;

  const rateLimitError = enforceRateLimit(request, {
    scope: "auth:logout",
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimitError) return rateLimitError;

  const response = NextResponse.json({ success: true });
  await clearSessionCookie(response);
  return response;
}
