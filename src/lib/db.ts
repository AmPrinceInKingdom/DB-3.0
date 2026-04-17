import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

function buildRuntimeDatabaseUrl() {
  const baseUrl = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
  if (!baseUrl) return undefined;

  try {
    const parsed = new URL(baseUrl);
    const host = parsed.hostname.toLowerCase();
    const isSupabaseHost = host.includes("supabase");
    const isPoolerHost = host.includes("pooler.supabase.com");
    const isDevelopment = process.env.NODE_ENV === "development";

    if (isSupabaseHost && !parsed.searchParams.has("sslmode")) {
      parsed.searchParams.set("sslmode", "require");
    }

    if (isPoolerHost && !parsed.searchParams.has("pgbouncer")) {
      parsed.searchParams.set("pgbouncer", "true");
    }

    const currentLimit = Number(parsed.searchParams.get("connection_limit") ?? "0");
    const desiredLimit = isDevelopment ? 8 : isPoolerHost ? 1 : 5;
    if (!Number.isFinite(currentLimit) || currentLimit < desiredLimit) {
      parsed.searchParams.set("connection_limit", String(desiredLimit));
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
