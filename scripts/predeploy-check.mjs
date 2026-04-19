import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const criticalKeys = [
  "DATABASE_URL",
  "JWT_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const smtpKeys = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM_EMAIL",
  "SMTP_FROM_NAME",
];

const stripeKeys = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
];

function parseEnvFile(content) {
  const parsed = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function loadEnvFromFile(relativeFilePath, override) {
  const absolutePath = path.resolve(projectRoot, relativeFilePath);
  if (!fs.existsSync(absolutePath)) return;

  const content = fs.readFileSync(absolutePath, "utf8");
  const parsed = parseEnvFile(content);

  for (const [key, value] of Object.entries(parsed)) {
    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function hasValue(value) {
  return Boolean(value && String(value).trim().length > 0);
}

function validateUrl(label, value) {
  if (!hasValue(value)) return `${label} is missing`;
  try {
    void new URL(value);
    return null;
  } catch {
    return `${label} is not a valid URL`;
  }
}

function detectCardProvider() {
  const raw = String(process.env.CARD_PAYMENT_PROVIDER ?? "").trim().toUpperCase();
  return raw === "STRIPE_CHECKOUT" ? "STRIPE_CHECKOUT" : "SANDBOX";
}

function isStrictProduction() {
  const vercelEnv = String(process.env.VERCEL_ENV ?? "").trim().toLowerCase();
  if (vercelEnv) {
    return vercelEnv === "production";
  }
  return String(process.env.NODE_ENV ?? "").trim().toLowerCase() === "production";
}

function isHttpsUrl(value) {
  if (!hasValue(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isLocalhostUrl(value) {
  if (!hasValue(value)) return false;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    const normalized = String(value).toLowerCase();
    return (
      normalized.includes("localhost") ||
      normalized.includes("127.0.0.1") ||
      normalized.includes("::1")
    );
  }
}

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

async function verifyDatabaseConnection() {
  const { PrismaClient } = await import("@prisma/client");
  const directUrl = String(process.env.DIRECT_URL ?? "").trim();
  const databaseUrl = String(process.env.DATABASE_URL ?? "").trim();

  const runProbe = async (urlOverride) => {
    const prisma = new PrismaClient(
      urlOverride
        ? {
            datasources: {
              db: { url: urlOverride },
            },
          }
        : undefined,
    );

    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ok: true, error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown database error";
      return { ok: false, error: message };
    } finally {
      await prisma.$disconnect();
    }
  };

  const primaryProbe = await runProbe();
  if (primaryProbe.ok) {
    console.log("PASS  Database connection is healthy.");
    return null;
  }

  const canFallback =
    process.env.NODE_ENV !== "production" &&
    directUrl &&
    directUrl !== databaseUrl &&
    /can't reach database server/i.test(primaryProbe.error ?? "");

  if (canFallback) {
    const fallbackProbe = await runProbe(directUrl);
    if (fallbackProbe.ok) {
      console.log("WARN  DATABASE_URL probe failed, but DIRECT_URL probe succeeded (development fallback).");
      return null;
    }
  }

  console.log(`FAIL  Database connection failed: ${primaryProbe.error ?? "Unknown database error"}`);
  return "Database connection failed";
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const skipDb = args.has("--skip-db");

  loadEnvFromFile(".env", false);
  loadEnvFromFile(".env.local", true);

  printSection("Deal Bazaar Pre-Deploy Check");
  console.log(`Project root: ${projectRoot}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV ?? "development"}`);

  const errors = [];
  const warnings = [];

  printSection("Critical Environment");
  for (const key of criticalKeys) {
    const value = process.env[key];
    if (!hasValue(value)) {
      errors.push(`${key} is missing`);
      console.log(`FAIL  ${key}`);
    } else {
      console.log(`PASS  ${key}`);
    }
  }

  if (hasValue(process.env.JWT_SECRET) && String(process.env.JWT_SECRET).length < 32) {
    errors.push("JWT_SECRET must be at least 32 characters");
    console.log("FAIL  JWT_SECRET length is less than 32 characters");
  }

  const appUrlError = validateUrl("NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL);
  if (appUrlError) {
    warnings.push(appUrlError);
    console.log(`WARN  ${appUrlError}`);
  } else {
    console.log("PASS  NEXT_PUBLIC_APP_URL");
  }

  printSection("SMTP Readiness");
  const smtpFilled = smtpKeys.filter((key) => hasValue(process.env[key]));
  if (smtpFilled.length === 0) {
    warnings.push("SMTP is not configured. OTP and email verification will not be delivered.");
    console.log("WARN  SMTP is not configured.");
  } else if (smtpFilled.length !== smtpKeys.length) {
    const missingSmtpKeys = smtpKeys.filter((key) => !hasValue(process.env[key]));
    errors.push(`SMTP variables are incomplete: ${missingSmtpKeys.join(", ")}`);
    console.log(`FAIL  SMTP variables are incomplete: ${missingSmtpKeys.join(", ")}`);
  } else {
    console.log("PASS  SMTP is fully configured.");
  }

  printSection("Payment Gateway Readiness");
  const cardProvider = detectCardProvider();
  const strictProduction = isStrictProduction();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  console.log(`Card provider: ${cardProvider}`);
  console.log(`Strict production mode: ${strictProduction ? "YES" : "NO"}`);

  if (cardProvider === "STRIPE_CHECKOUT") {
    for (const key of stripeKeys) {
      if (!hasValue(process.env[key])) {
        errors.push(`${key} is missing for Stripe Checkout`);
        console.log(`FAIL  ${key}`);
      } else {
        console.log(`PASS  ${key}`);
      }
    }

    if (strictProduction) {
      if (!isHttpsUrl(appUrl)) {
        errors.push("NEXT_PUBLIC_APP_URL must be HTTPS when Stripe Checkout is enabled in production.");
        console.log("FAIL  NEXT_PUBLIC_APP_URL must use https:// in production Stripe mode");
      } else {
        console.log("PASS  NEXT_PUBLIC_APP_URL uses HTTPS");
      }

      if (isLocalhostUrl(appUrl)) {
        errors.push("NEXT_PUBLIC_APP_URL cannot be localhost in production Stripe mode.");
        console.log("FAIL  NEXT_PUBLIC_APP_URL points to localhost");
      }

      const stripeSecretKey = String(process.env.STRIPE_SECRET_KEY ?? "").trim();
      if (stripeSecretKey && stripeSecretKey.startsWith("sk_test_")) {
        errors.push("STRIPE_SECRET_KEY is in test mode. Use sk_live_ key for production.");
        console.log("FAIL  STRIPE_SECRET_KEY is test-mode in production");
      } else if (stripeSecretKey && stripeSecretKey.startsWith("sk_live_")) {
        console.log("PASS  STRIPE_SECRET_KEY appears to be live-mode");
      } else if (stripeSecretKey) {
        warnings.push("STRIPE_SECRET_KEY format is unrecognized.");
        console.log("WARN  STRIPE_SECRET_KEY format is unrecognized");
      }
    }
  } else {
    const stripePresent = stripeKeys.filter((key) => hasValue(process.env[key])).length;
    if (stripePresent === 0) {
      console.log("INFO  Stripe keys not required while SANDBOX provider is selected.");
    } else {
      warnings.push(
        "Stripe keys are set but CARD_PAYMENT_PROVIDER is SANDBOX. Confirm intended provider before deploy.",
      );
      console.log("WARN  Stripe keys exist while SANDBOX provider is selected");
    }
  }

  printSection("Database Connection");
  if (skipDb) {
    console.log("SKIP  Database connectivity check skipped by --skip-db.");
  } else if (!hasValue(process.env.DATABASE_URL)) {
    console.log("SKIP  DATABASE_URL is missing so DB check cannot run.");
  } else {
    const dbError = await verifyDatabaseConnection();
    if (dbError) errors.push(dbError);
  }

  printSection("Summary");
  if (warnings.length > 0) {
    console.log(`Warnings: ${warnings.length}`);
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  } else {
    console.log("Warnings: 0");
  }

  if (errors.length > 0) {
    console.log(`Errors: ${errors.length}`);
    for (const error of errors) {
      console.log(`- ${error}`);
    }
    console.log("\nPre-deploy check FAILED.");
    process.exit(1);
  }

  console.log("Errors: 0");
  console.log("\nPre-deploy check PASSED.");
}

await main();
