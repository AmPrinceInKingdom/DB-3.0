import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

function buildRuntimeDatabaseUrl() {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) return undefined;

  // In local development, a very low connection limit (for example 1)
  // causes frequent pool timeouts when multiple widgets poll concurrently.
  if (process.env.NODE_ENV !== "development") {
    return baseUrl;
  }

  try {
    const parsed = new URL(baseUrl);
    const currentLimit = Number(parsed.searchParams.get("connection_limit") ?? "0");

    if (!Number.isFinite(currentLimit) || currentLimit < 5) {
      parsed.searchParams.set("connection_limit", "8");
    }

    if (!parsed.searchParams.has("pool_timeout")) {
      parsed.searchParams.set("pool_timeout", "30");
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
