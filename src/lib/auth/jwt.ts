import { SignJWT, jwtVerify } from "jose";
import type { SessionPayload } from "@/lib/auth/types";

const algorithm = "HS256";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET is missing or too short");
  }
  return new TextEncoder().encode(secret);
}

function getSessionDuration() {
  const value = Number(process.env.SESSION_EXPIRES_IN_DAYS ?? 7);
  return Number.isNaN(value) ? 7 : value;
}

export async function createSessionToken(payload: SessionPayload) {
  const ttlInDays = getSessionDuration();

  return new SignJWT(payload)
    .setProtectedHeader({ alg: algorithm })
    .setIssuedAt()
    .setExpirationTime(`${ttlInDays}d`)
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, getJwtSecret(), {
    algorithms: [algorithm],
  });

  return payload as SessionPayload;
}
