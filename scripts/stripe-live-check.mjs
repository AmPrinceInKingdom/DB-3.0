import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const stripeApiBaseUrl = "https://api.stripe.com/v1";
const presetEnvKeys = new Set(Object.keys(process.env));

function parseEnvValue(raw) {
  const value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function loadEnvFile(filePath, { allowOverrideFromFile = false } = {}) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalIndex = trimmed.indexOf("=");
    if (equalIndex <= 0) continue;

    const key = trimmed.slice(0, equalIndex).trim();
    const value = parseEnvValue(trimmed.slice(equalIndex + 1));
    if (!key) continue;

    if (presetEnvKeys.has(key)) continue;
    if (!allowOverrideFromFile && process.env[key] !== undefined) continue;
    process.env[key] = value;
  }
}

function loadLocalEnv() {
  const projectRoot = process.cwd();
  loadEnvFile(path.join(projectRoot, ".env"));
  loadEnvFile(path.join(projectRoot, ".env.local"), {
    allowOverrideFromFile: true,
  });
}

function hasValue(value) {
  return Boolean(value && String(value).trim().length > 0);
}

function maskSecret(value) {
  if (!hasValue(value)) return "(missing)";
  const normalized = String(value).trim();
  if (normalized.length <= 10) return `${normalized.slice(0, 3)}***`;
  return `${normalized.slice(0, 7)}***${normalized.slice(-4)}`;
}

function detectProvider() {
  const raw = String(process.env.CARD_PAYMENT_PROVIDER ?? "SANDBOX")
    .trim()
    .toUpperCase();
  return raw === "STRIPE_CHECKOUT" ? "STRIPE_CHECKOUT" : "SANDBOX";
}

function normalizeAppUrl(value) {
  if (!hasValue(value)) return null;
  return String(value).trim().replace(/\/+$/, "");
}

function isHttpsUrl(value) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isLocalhost(value) {
  if (!value) return false;
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

function createAbortControllerWithTimeout(ms) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return {
    controller,
    release: () => clearTimeout(timeout),
  };
}

function parseString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parseBoolean(value) {
  return typeof value === "boolean" ? value : null;
}

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

async function fetchStripeAccount(stripeSecretKey) {
  const { controller, release } = createAbortControllerWithTimeout(10_000);
  try {
    const response = await fetch(`${stripeApiBaseUrl}/account`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    const responseText = await response.text();
    let payload = null;
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = null;
    }

    if (!response.ok || !payload) {
      const message =
        parseString(payload?.error?.message) ??
        `Stripe API request failed with status ${response.status}.`;
      return {
        success: false,
        error: message,
      };
    }

    return {
      success: true,
      accountId: parseString(payload.id),
      country: parseString(payload.country),
      livemode: parseBoolean(payload.livemode),
      chargesEnabled: parseBoolean(payload.charges_enabled),
      payoutsEnabled: parseBoolean(payload.payouts_enabled),
      detailsSubmitted: parseBoolean(payload.details_submitted),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to connect to Stripe API.",
    };
  } finally {
    release();
  }
}

async function main() {
  loadLocalEnv();

  const args = new Set(process.argv.slice(2));
  const strictProduction = args.has("--production");
  const skipApi = args.has("--skip-api");
  const provider = detectProvider();
  const stripeRequired = provider === "STRIPE_CHECKOUT";
  const appUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL);
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  const errors = [];
  const warnings = [];

  printSection("Stripe Go-Live Check");
  console.log(`Provider: ${provider}`);
  console.log(`Strict production checks: ${strictProduction ? "ON" : "OFF"}`);
  console.log(`Skip Stripe API check: ${skipApi ? "YES" : "NO"}`);

  printSection("Environment");
  console.log(`NEXT_PUBLIC_APP_URL: ${appUrl ?? "(missing)"}`);
  console.log(`STRIPE_SECRET_KEY: ${maskSecret(stripeSecretKey)}`);
  console.log(`STRIPE_WEBHOOK_SECRET: ${maskSecret(stripeWebhookSecret)}`);

  if (!stripeRequired) {
    warnings.push("CARD_PAYMENT_PROVIDER is SANDBOX. Stripe live checks are informational only.");
  } else {
    if (!hasValue(stripeSecretKey)) {
      errors.push("STRIPE_SECRET_KEY is missing.");
    }
    if (!hasValue(stripeWebhookSecret)) {
      errors.push("STRIPE_WEBHOOK_SECRET is missing.");
    } else if (!String(stripeWebhookSecret).startsWith("whsec_")) {
      warnings.push("STRIPE_WEBHOOK_SECRET format is unusual (expected whsec_*).");
    }
    if (!appUrl) {
      errors.push("NEXT_PUBLIC_APP_URL is missing.");
    }

    if (strictProduction) {
      if (!isHttpsUrl(appUrl)) {
        errors.push("NEXT_PUBLIC_APP_URL must use https:// in production.");
      }
      if (isLocalhost(appUrl)) {
        errors.push("NEXT_PUBLIC_APP_URL cannot point to localhost in production.");
      }
      if (hasValue(stripeSecretKey) && String(stripeSecretKey).startsWith("sk_test_")) {
        errors.push("STRIPE_SECRET_KEY is test mode (sk_test_). Use sk_live_ key.");
      }
    }
  }

  let stripeAccount = null;
  if (!skipApi && stripeRequired && hasValue(stripeSecretKey)) {
    printSection("Stripe API");
    stripeAccount = await fetchStripeAccount(String(stripeSecretKey));
    if (!stripeAccount.success) {
      errors.push(`Unable to connect to Stripe API: ${stripeAccount.error}`);
      console.log(`FAIL  ${stripeAccount.error}`);
    } else {
      console.log(`PASS  Account ID: ${stripeAccount.accountId ?? "-"}`);
      console.log(`PASS  Country: ${stripeAccount.country ?? "-"}`);
      console.log(
        `PASS  Live mode: ${
          stripeAccount.livemode === null ? "-" : stripeAccount.livemode ? "YES" : "NO"
        }`,
      );
      console.log(
        `PASS  Charges enabled: ${
          stripeAccount.chargesEnabled === null
            ? "-"
            : stripeAccount.chargesEnabled
              ? "YES"
              : "NO"
        }`,
      );
      console.log(
        `PASS  Payouts enabled: ${
          stripeAccount.payoutsEnabled === null
            ? "-"
            : stripeAccount.payoutsEnabled
              ? "YES"
              : "NO"
        }`,
      );
      console.log(
        `PASS  Details submitted: ${
          stripeAccount.detailsSubmitted === null
            ? "-"
            : stripeAccount.detailsSubmitted
              ? "YES"
              : "NO"
        }`,
      );

      if (strictProduction) {
        if (stripeAccount.livemode === false) {
          errors.push("Stripe account reports livemode=false.");
        }
        if (stripeAccount.chargesEnabled === false) {
          errors.push("Stripe account charges are not enabled.");
        }
        if (stripeAccount.payoutsEnabled === false) {
          errors.push("Stripe account payouts are not enabled.");
        }
        if (stripeAccount.detailsSubmitted === false) {
          warnings.push("Stripe account details are not fully submitted.");
        }
      }
    }
  }

  printSection("Summary");
  console.log(`Warnings: ${warnings.length}`);
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
  console.log(`Errors: ${errors.length}`);
  for (const error of errors) {
    console.log(`- ${error}`);
  }

  if (errors.length > 0) {
    console.log("\nStripe go-live check FAILED.");
    process.exit(1);
  }

  console.log("\nStripe go-live check PASSED.");
}

main().catch((error) => {
  console.error("Stripe go-live check failed unexpectedly:", error);
  process.exit(1);
});
