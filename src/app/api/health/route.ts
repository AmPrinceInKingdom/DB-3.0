import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type CheckStatus = "ok" | "degraded" | "down";

type HealthCheckResult = {
  status: CheckStatus;
  detail: string;
  configured?: boolean;
  latencyMs?: number;
  missingKeys?: string[];
};

function hasValue(value: string | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function toStatusCode(status: CheckStatus) {
  if (status === "down") return 503;
  return 200;
}

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  const envKeys = {
    databaseUrl: hasValue(process.env.DATABASE_URL),
    jwtSecret: hasValue(process.env.JWT_SECRET),
    supabaseUrl: hasValue(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: hasValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServiceRoleKey: hasValue(process.env.SUPABASE_SERVICE_ROLE_KEY),
    smtpHost: hasValue(process.env.SMTP_HOST),
    smtpUser: hasValue(process.env.SMTP_USER),
    smtpPass: hasValue(process.env.SMTP_PASS),
  };

  const missingCoreEnv = [
    !envKeys.databaseUrl ? "DATABASE_URL" : null,
    !envKeys.jwtSecret ? "JWT_SECRET" : null,
    !envKeys.supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : null,
    !envKeys.supabaseAnonKey ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : null,
    !envKeys.supabaseServiceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
  ].filter((key): key is string => Boolean(key));

  const envCheck: HealthCheckResult =
    missingCoreEnv.length === 0
      ? {
          status: "ok",
          detail: "Core environment variables are configured.",
        }
      : {
          status: "degraded",
          detail: "Some core environment variables are missing.",
          missingKeys: missingCoreEnv,
        };

  const smtpMissingKeys = [
    !envKeys.smtpHost ? "SMTP_HOST" : null,
    !envKeys.smtpUser ? "SMTP_USER" : null,
    !envKeys.smtpPass ? "SMTP_PASS" : null,
  ].filter((key): key is string => Boolean(key));

  const smtpCheck: HealthCheckResult =
    smtpMissingKeys.length === 0
      ? {
          status: "ok",
          detail: "SMTP variables are configured.",
          configured: true,
        }
      : {
          status: "degraded",
          detail: "SMTP variables are incomplete. OTP/email delivery may fail.",
          configured: false,
          missingKeys: smtpMissingKeys,
        };

  let databaseCheck: HealthCheckResult;
  if (!envKeys.databaseUrl) {
    databaseCheck = {
      status: "degraded",
      detail: "DATABASE_URL is not configured.",
      configured: false,
    };
  } else {
    const dbStartedAt = Date.now();
    try {
      await db.$queryRaw`SELECT 1`;
      databaseCheck = {
        status: "ok",
        detail: "Database connection is healthy.",
        configured: true,
        latencyMs: Date.now() - dbStartedAt,
      };
    } catch {
      databaseCheck = {
        status: "down",
        detail: "Database connection failed.",
        configured: true,
        latencyMs: Date.now() - dbStartedAt,
      };
    }
  }

  const supabaseCheck: HealthCheckResult =
    envKeys.supabaseUrl && envKeys.supabaseAnonKey && envKeys.supabaseServiceRoleKey
      ? {
          status: "ok",
          detail: "Supabase environment is configured.",
          configured: true,
        }
      : {
          status: "degraded",
          detail: "Supabase environment is incomplete.",
          configured: false,
          missingKeys: [
            !envKeys.supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : null,
            !envKeys.supabaseAnonKey ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : null,
            !envKeys.supabaseServiceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
          ].filter((key): key is string => Boolean(key)),
        };

  const checks = {
    env: envCheck,
    database: databaseCheck,
    supabase: supabaseCheck,
    smtp: smtpCheck,
  } as const;

  const statuses = Object.values(checks).map((check) => check.status);
  const overallStatus: CheckStatus = statuses.includes("down")
    ? "down"
    : statuses.includes("degraded")
      ? "degraded"
      : "ok";

  return NextResponse.json(
    {
      success: overallStatus !== "down",
      status: overallStatus,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? "development",
      responseTimeMs: Date.now() - startedAt,
      checks,
    },
    { status: toStatusCode(overallStatus) },
  );
}
