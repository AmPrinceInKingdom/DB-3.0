import { db } from "@/lib/db";
import { sendObservabilityAlert } from "@/lib/observability/alerting";

export type HealthCheckStatus = "ok" | "degraded" | "down";

export type RuntimeHealthCheck = {
  status: HealthCheckStatus;
  detail: string;
  configured?: boolean;
  latencyMs?: number;
  missingKeys?: string[];
};

export type RuntimeHealthReport = {
  success: boolean;
  requestId?: string;
  status: HealthCheckStatus;
  timestamp: string;
  environment: string;
  responseTimeMs: number;
  checks: {
    env: RuntimeHealthCheck;
    database: RuntimeHealthCheck;
    supabase: RuntimeHealthCheck;
    smtp: RuntimeHealthCheck;
  };
};

type RuntimeHealthOptions = {
  requestId?: string;
};

function hasValue(value: string | undefined) {
  return Boolean(value && value.trim().length > 0);
}

export function toHealthStatusCode(status: HealthCheckStatus) {
  return status === "down" ? 503 : 200;
}

export async function getRuntimeHealthReport(
  options: RuntimeHealthOptions = {},
): Promise<RuntimeHealthReport> {
  const startedAt = Date.now();

  const envKeys = {
    databaseUrl: hasValue(process.env.DATABASE_URL),
    directUrl: hasValue(process.env.DIRECT_URL),
    jwtSecret: hasValue(process.env.JWT_SECRET),
    supabaseUrl: hasValue(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: hasValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServiceRoleKey: hasValue(process.env.SUPABASE_SERVICE_ROLE_KEY),
    smtpHost: hasValue(process.env.SMTP_HOST),
    smtpUser: hasValue(process.env.SMTP_USER),
    smtpPass: hasValue(process.env.SMTP_PASS),
  };

  const hasAnyDatabaseUrl = envKeys.databaseUrl || envKeys.directUrl;

  const missingCoreEnv = [
    !hasAnyDatabaseUrl ? "DATABASE_URL or DIRECT_URL" : null,
    !envKeys.jwtSecret ? "JWT_SECRET" : null,
    !envKeys.supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : null,
    !envKeys.supabaseAnonKey ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : null,
    !envKeys.supabaseServiceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
  ].filter((key): key is string => Boolean(key));

  const envCheck: RuntimeHealthCheck =
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

  const smtpCheck: RuntimeHealthCheck =
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

  let databaseCheck: RuntimeHealthCheck;
  if (!hasAnyDatabaseUrl) {
    databaseCheck = {
      status: "degraded",
      detail: "DATABASE_URL or DIRECT_URL is not configured.",
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

  const supabaseCheck: RuntimeHealthCheck =
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
  const overallStatus: HealthCheckStatus = statuses.includes("down")
    ? "down"
    : statuses.includes("degraded")
      ? "degraded"
      : "ok";

  if (overallStatus === "down") {
    void sendObservabilityAlert({
      scope: "api.health",
      severity: "critical",
      title: "Deal Bazaar health check is DOWN",
      message: "One or more critical runtime checks are down in the health endpoint.",
      requestId: options.requestId,
      fingerprint: "health-down",
      metadata: {
        environment: process.env.NODE_ENV ?? "development",
        checks,
      },
    });
  }

  return {
    success: overallStatus !== "down",
    requestId: options.requestId,
    status: overallStatus,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? "development",
    responseTimeMs: Date.now() - startedAt,
    checks,
  };
}

