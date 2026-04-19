import type {
  AdminAuthDiagnosticsCheck,
  AdminAuthDiagnosticsReport,
  AdminDiagnosticsStatus,
} from "@/types/admin-auth-diagnostics";
import { db } from "@/lib/db";

type GetAuthDiagnosticsOptions = {
  requestId?: string;
};

const requiredAuthTables = [
  "users",
  "user_profiles",
  "user_sessions",
  "email_verification_tokens",
  "otp_codes",
  "password_reset_tokens",
] as const;

function hasValue(value: string | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function normalizeNodeEnv(value: string | undefined) {
  if (value === "production" || value === "test") return value;
  return "development";
}

function resolveConfiguredAppUrl() {
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredAppUrl) {
    return {
      value: configuredAppUrl,
      source: "NEXT_PUBLIC_APP_URL" as const,
    };
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return {
      value: `https://${vercelUrl}`,
      source: "VERCEL_URL" as const,
    };
  }

  return {
    value: "",
    source: "fallback" as const,
  };
}

function getOverallStatus(checks: AdminAuthDiagnosticsReport["checks"]): AdminDiagnosticsStatus {
  const statuses = Object.values(checks).map((check) => check.status);
  if (statuses.includes("down")) return "down";
  if (statuses.includes("degraded")) return "degraded";
  return "ok";
}

function toDiagnosticsStatusCode(status: AdminDiagnosticsStatus) {
  return status === "down" ? 503 : 200;
}

function buildRecommendation(
  checkName: string,
  check: AdminAuthDiagnosticsCheck,
): string[] {
  if (check.status === "ok") return [];

  if (checkName === "appUrl") {
    return [
      "Set NEXT_PUBLIC_APP_URL to your production domain (example: https://your-domain.com).",
    ];
  }

  if (checkName === "jwt") {
    return [
      "Set JWT_SECRET to a strong secret with at least 32 characters in Vercel environment variables.",
    ];
  }

  if (checkName === "database") {
    return [
      "Check DATABASE_URL credentials and network access for Supabase/PostgreSQL, then redeploy.",
    ];
  }

  if (checkName === "schema") {
    return [
      "Run Prisma schema sync/migration so all auth tables exist in production database.",
    ];
  }

  if (checkName === "authRead") {
    return [
      "Verify auth tables permissions and row access; ensure API can query users table in production.",
    ];
  }

  if (checkName === "supabase") {
    return [
      "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in Vercel.",
    ];
  }

  if (checkName === "smtp") {
    return [
      "Set SMTP_HOST, SMTP_USER, and SMTP_PASS to enable OTP/email verification delivery.",
    ];
  }

  return [];
}

export async function getAdminAuthDiagnosticsReport(
  options: GetAuthDiagnosticsOptions = {},
): Promise<AdminAuthDiagnosticsReport> {
  const startedAt = Date.now();
  const nodeEnv = normalizeNodeEnv(process.env.NODE_ENV);

  const appUrl = resolveConfiguredAppUrl();
  const appUrlIsConfigured = appUrl.source !== "fallback";
  const appUrlLooksLocalhost = appUrl.value.includes("localhost");

  const appUrlCheck: AdminAuthDiagnosticsCheck = !appUrlIsConfigured
    ? {
        status: nodeEnv === "production" ? "down" : "degraded",
        detail: "App URL is not configured from env vars.",
        configured: false,
      }
    : nodeEnv === "production" && appUrlLooksLocalhost
      ? {
          status: "degraded",
          detail: "Production app URL points to localhost. Update NEXT_PUBLIC_APP_URL.",
          configured: true,
          value: appUrl.value,
        }
      : {
          status: "ok",
          detail: `App URL configured via ${appUrl.source}.`,
          configured: true,
          value: appUrl.value,
        };

  const jwtSecret = process.env.JWT_SECRET?.trim();
  const jwtCheck: AdminAuthDiagnosticsCheck = !jwtSecret
    ? {
        status: "down",
        detail: "JWT secret is missing.",
        configured: false,
        missingKeys: ["JWT_SECRET"],
      }
    : jwtSecret.length < 32
      ? {
          status: "down",
          detail: "JWT secret is too short. Minimum length is 32 characters.",
          configured: true,
        }
      : {
          status: "ok",
          detail: "JWT secret is configured.",
          configured: true,
        };

  const hasDatabaseUrl = hasValue(process.env.DATABASE_URL) || hasValue(process.env.DIRECT_URL);
  let databaseCheck: AdminAuthDiagnosticsCheck;
  if (!hasDatabaseUrl) {
    databaseCheck = {
      status: "down",
      detail: "DATABASE_URL or DIRECT_URL is missing.",
      configured: false,
      missingKeys: ["DATABASE_URL or DIRECT_URL"],
    };
  } else {
    const databaseStartedAt = Date.now();
    try {
      await db.$queryRaw`SELECT 1`;
      databaseCheck = {
        status: "ok",
        detail: "Database connection is healthy.",
        configured: true,
        latencyMs: Date.now() - databaseStartedAt,
      };
    } catch {
      databaseCheck = {
        status: "down",
        detail: "Database connection failed.",
        configured: true,
        latencyMs: Date.now() - databaseStartedAt,
      };
    }
  }

  let schemaCheck: AdminAuthDiagnosticsCheck = {
    status: "degraded",
    detail: "Schema check skipped because database is not available.",
    configured: false,
  };
  let authReadCheck: AdminAuthDiagnosticsCheck = {
    status: "degraded",
    detail: "Auth read check skipped because database is not available.",
    configured: false,
  };

  if (databaseCheck.status === "ok") {
    try {
      const rows = await db.$queryRaw<{ table_name: string }[]>`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `;
      const tableSet = new Set(rows.map((row) => row.table_name));
      const missingTables = requiredAuthTables.filter((table) => !tableSet.has(table));

      schemaCheck =
        missingTables.length === 0
          ? {
              status: "ok",
              detail: "Auth schema tables are present.",
              configured: true,
            }
          : {
              status: "down",
              detail: "Some auth schema tables are missing.",
              configured: false,
              missingKeys: missingTables,
            };
    } catch {
      schemaCheck = {
        status: "down",
        detail: "Unable to validate schema tables from database.",
        configured: true,
      };
    }

    const authReadStartedAt = Date.now();
    try {
      const userCount = await db.user.count();
      authReadCheck = {
        status: "ok",
        detail: `Auth read query succeeded. Users: ${userCount}.`,
        configured: true,
        latencyMs: Date.now() - authReadStartedAt,
      };
    } catch {
      authReadCheck = {
        status: "down",
        detail: "Auth read query failed on users table.",
        configured: true,
        latencyMs: Date.now() - authReadStartedAt,
      };
    }
  }

  const hasSupabaseUrl = hasValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasSupabaseAnon = hasValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const hasSupabaseService = hasValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const supabaseMissing = [
    !hasSupabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : null,
    !hasSupabaseAnon ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : null,
    !hasSupabaseService ? "SUPABASE_SERVICE_ROLE_KEY" : null,
  ].filter((key): key is string => Boolean(key));
  const supabaseCheck: AdminAuthDiagnosticsCheck =
    supabaseMissing.length === 0
      ? {
          status: "ok",
          detail: "Supabase auth/storage keys are configured.",
          configured: true,
        }
      : {
          status: "degraded",
          detail: "Supabase configuration is incomplete.",
          configured: false,
          missingKeys: supabaseMissing,
        };

  const hasSmtpHost = hasValue(process.env.SMTP_HOST);
  const hasSmtpUser = hasValue(process.env.SMTP_USER);
  const hasSmtpPass = hasValue(process.env.SMTP_PASS);
  const smtpMissing = [
    !hasSmtpHost ? "SMTP_HOST" : null,
    !hasSmtpUser ? "SMTP_USER" : null,
    !hasSmtpPass ? "SMTP_PASS" : null,
  ].filter((key): key is string => Boolean(key));
  const smtpCheck: AdminAuthDiagnosticsCheck =
    smtpMissing.length === 0
      ? {
          status: "ok",
          detail: "SMTP is configured for verification emails.",
          configured: true,
        }
      : {
          status: "degraded",
          detail: "SMTP is incomplete. OTP/email verification may fail.",
          configured: false,
          missingKeys: smtpMissing,
        };

  const checks = {
    appUrl: appUrlCheck,
    jwt: jwtCheck,
    database: databaseCheck,
    schema: schemaCheck,
    authRead: authReadCheck,
    supabase: supabaseCheck,
    smtp: smtpCheck,
  } as const;

  const status = getOverallStatus(checks);
  const recommendationSet = new Set<string>();
  for (const [checkName, check] of Object.entries(checks)) {
    for (const recommendation of buildRecommendation(checkName, check)) {
      recommendationSet.add(recommendation);
    }
  }

  return {
    success: status !== "down",
    requestId: options.requestId,
    status,
    generatedAt: new Date().toISOString(),
    environment: nodeEnv,
    responseTimeMs: Date.now() - startedAt,
    checks,
    recommendations: Array.from(recommendationSet),
  };
}

export { toDiagnosticsStatusCode };
