import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

function hasValue(value: string | undefined | null) {
  return Boolean(value && value.trim().length > 0);
}

function isTruthy(value: string | undefined | null) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function isVercelRuntime() {
  return hasValue(process.env.VERCEL) || hasValue(process.env.VERCEL_ENV) || hasValue(process.env.VERCEL_URL);
}

function parsePositiveInt(value: string | undefined | null) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.floor(parsed);
  if (normalized <= 0) return null;
  return normalized;
}

function shouldPreferDirectUrl() {
  if (isTruthy(process.env.PRISMA_USE_DIRECT_URL)) return true;
  if (process.env.PLAYWRIGHT_TEST === "1") return true;
  if (process.env.E2E_USE_START === "1") return true;
  if ((process.env.NODE_ENV ?? "").toLowerCase() === "test") return true;
  return false;
}

function pickBaseDatabaseUrl() {
  const runtimeUrl = process.env.DATABASE_URL?.trim();
  const directUrl = process.env.DIRECT_URL?.trim();

  if (!runtimeUrl && !directUrl) return undefined;

  if (shouldPreferDirectUrl() && hasValue(directUrl)) {
    return directUrl;
  }

  const nodeEnv = (process.env.NODE_ENV ?? "development").toLowerCase();
  if (!isVercelRuntime() && nodeEnv !== "production" && hasValue(directUrl)) {
    return directUrl;
  }

  return runtimeUrl ?? directUrl;
}

function buildRuntimeDatabaseUrl() {
  const baseUrl = pickBaseDatabaseUrl();
  if (!baseUrl) return undefined;

  try {
    const parsed = new URL(baseUrl);
    const host = parsed.hostname.toLowerCase();
    const isSupabaseHost = host.includes("supabase");
    const isPoolerHost = host.includes("pooler.supabase.com");
    const nodeEnv = (process.env.NODE_ENV ?? "development").toLowerCase();
    const isDevelopment = nodeEnv === "development";
    const isTest = nodeEnv === "test";
    const isE2ERuntime = process.env.E2E_USE_START === "1" || process.env.PLAYWRIGHT_TEST === "1";

    if (isSupabaseHost && !parsed.searchParams.has("sslmode")) {
      parsed.searchParams.set("sslmode", "require");
    }

    if (isPoolerHost && !parsed.searchParams.has("pgbouncer")) {
      parsed.searchParams.set("pgbouncer", "true");
    }

    const envConnectionLimit = parsePositiveInt(process.env.PRISMA_CONNECTION_LIMIT);
    const currentLimit = Number(parsed.searchParams.get("connection_limit") ?? "0");
    const desiredLimit =
      envConnectionLimit ??
      (isDevelopment || isTest || isE2ERuntime
        ? 8
        : isPoolerHost
          ? isVercelRuntime()
            ? 1
            : 5
          : 5);
    if (!Number.isFinite(currentLimit) || currentLimit < desiredLimit) {
      parsed.searchParams.set("connection_limit", String(desiredLimit));
    }

    const poolTimeoutSeconds = parsePositiveInt(process.env.PRISMA_POOL_TIMEOUT_SECONDS) ?? 30;
    if (!parsed.searchParams.has("pool_timeout")) {
      parsed.searchParams.set("pool_timeout", String(poolTimeoutSeconds));
    }

    const connectTimeoutSeconds = parsePositiveInt(process.env.PRISMA_CONNECT_TIMEOUT_SECONDS) ?? 20;
    if (!parsed.searchParams.has("connect_timeout")) {
      parsed.searchParams.set("connect_timeout", String(connectTimeoutSeconds));
    }

    return parsed.toString();
  } catch {
    return baseUrl;
  }
}

const runtimeDatabaseUrl = buildRuntimeDatabaseUrl();

export const db =
  global.prisma ??
  new PrismaClient({
    ...(runtimeDatabaseUrl
      ? {
          datasources: {
            db: {
              url: runtimeDatabaseUrl,
            },
          },
        }
      : {}),
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = db;
}
