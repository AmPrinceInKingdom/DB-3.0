import { fail } from "@/lib/api-response";
import { env } from "@/lib/env";

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

type RateLimitStore = Map<string, RateLimitRecord>;
type FailureLockRecord = {
  count: number;
  windowResetAt: number;
  lockedUntil: number;
};
type FailureLockStore = Map<string, FailureLockRecord>;

type RateLimitOptions = {
  scope: string;
  limit: number;
  windowMs: number;
  keyPart?: string | null;
};
type FailureLockOptions = {
  scope: string;
  identity: string;
  maxFailures: number;
  windowMs: number;
  lockMs: number;
};
type FailureAttemptResult = {
  locked: boolean;
  retryAfterSeconds?: number;
  remainingAttempts: number;
};

const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const appOrigin = new URL(env.NEXT_PUBLIC_APP_URL).origin;
const maxRateLimitEntries = 10_000;

const globalRateLimitState = globalThis as typeof globalThis & {
  __dealBazaarRateLimitStore?: RateLimitStore;
  __dealBazaarFailureLockStore?: FailureLockStore;
};

const rateLimitStore: RateLimitStore =
  globalRateLimitState.__dealBazaarRateLimitStore ?? new Map<string, RateLimitRecord>();
const failureLockStore: FailureLockStore =
  globalRateLimitState.__dealBazaarFailureLockStore ?? new Map<string, FailureLockRecord>();

if (!globalRateLimitState.__dealBazaarRateLimitStore) {
  globalRateLimitState.__dealBazaarRateLimitStore = rateLimitStore;
}
if (!globalRateLimitState.__dealBazaarFailureLockStore) {
  globalRateLimitState.__dealBazaarFailureLockStore = failureLockStore;
}

function parseOrigin(value: string | null): string | null {
  if (!value || value.trim().length === 0) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function resolveRequestOrigin(request: Request): string | null {
  try {
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}

function resolveForwardedOrigin(request: Request): string | null {
  const forwardedHost = request.headers.get("x-forwarded-host")?.trim();
  if (!forwardedHost) return null;

  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim() || "https";
  return parseOrigin(`${forwardedProto}://${forwardedHost}`);
}

function cleanExpiredEntries(now: number) {
  if (rateLimitStore.size < maxRateLimitEntries) return;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

function cleanExpiredFailureLockEntries(now: number) {
  if (failureLockStore.size < maxRateLimitEntries) return;

  for (const [key, entry] of failureLockStore.entries()) {
    if (entry.windowResetAt <= now && entry.lockedUntil <= now) {
      failureLockStore.delete(key);
    }
  }
}

function buildFailureLockKey(scope: string, identity: string) {
  return `${scope}:${identity.trim().toLowerCase()}`;
}

export function getRequestIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

export function enforceSameOriginMutation(request: Request) {
  const method = request.method.toUpperCase();
  if (!mutationMethods.has(method)) return null;

  const origin = parseOrigin(request.headers.get("origin"));
  const refererOrigin = parseOrigin(request.headers.get("referer"));
  const requestOrigin = resolveRequestOrigin(request);
  const forwardedOrigin = resolveForwardedOrigin(request);
  const allowedOrigins = new Set([appOrigin, requestOrigin, forwardedOrigin].filter(Boolean));

  if ((origin && allowedOrigins.has(origin)) || (refererOrigin && allowedOrigins.has(refererOrigin))) {
    return null;
  }

  // Keep local/dev tooling friendly where origin headers may be missing.
  if (env.NODE_ENV !== "production" && !origin && !refererOrigin) {
    return null;
  }

  return fail("Request origin is not allowed.", 403, "INVALID_ORIGIN");
}

export function enforceRateLimit(request: Request, options: RateLimitOptions) {
  const now = Date.now();
  cleanExpiredEntries(now);

  const identity = options.keyPart?.trim() || getRequestIp(request);
  const key = `${options.scope}:${identity}`;
  const existing = rateLimitStore.get(key);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return null;
  }

  existing.count += 1;
  if (existing.count <= options.limit) {
    return null;
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  return fail(
    `Too many requests. Try again in ${retryAfterSeconds} seconds.`,
    429,
    "RATE_LIMITED",
  );
}

export function enforceFailureLock(options: FailureLockOptions) {
  const now = Date.now();
  cleanExpiredFailureLockEntries(now);

  const key = buildFailureLockKey(options.scope, options.identity);
  const existing = failureLockStore.get(key);
  if (!existing) return null;

  if (existing.lockedUntil > now) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.lockedUntil - now) / 1000));
    return fail(
      `Too many invalid attempts. Try again in ${retryAfterSeconds} seconds.`,
      429,
      "OTP_LOCKED",
    );
  }

  if (existing.windowResetAt <= now) {
    failureLockStore.delete(key);
  }

  return null;
}

export function recordFailedVerificationAttempt(
  options: FailureLockOptions,
): FailureAttemptResult {
  const now = Date.now();
  cleanExpiredFailureLockEntries(now);

  const key = buildFailureLockKey(options.scope, options.identity);
  const existing = failureLockStore.get(key);

  const record: FailureLockRecord =
    !existing || existing.windowResetAt <= now
      ? {
          count: 0,
          windowResetAt: now + options.windowMs,
          lockedUntil: 0,
        }
      : { ...existing };

  record.count += 1;

  if (record.count >= options.maxFailures) {
    record.lockedUntil = now + options.lockMs;
  }

  failureLockStore.set(key, record);

  const remainingAttempts = Math.max(0, options.maxFailures - record.count);
  if (record.lockedUntil > now) {
    return {
      locked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((record.lockedUntil - now) / 1000)),
      remainingAttempts,
    };
  }

  return {
    locked: false,
    remainingAttempts,
  };
}

export function clearFailedVerificationAttempts(scope: string, identity: string) {
  const key = buildFailureLockKey(scope, identity);
  failureLockStore.delete(key);
}
