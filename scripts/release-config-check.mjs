import process from "node:process";
import fs from "node:fs";
import path from "node:path";

const coreSecretKeys = [
  "DATABASE_URL",
  "JWT_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const optionalSmokeSecrets = ["SMOKE_LOGIN_EMAIL", "SMOKE_LOGIN_PASSWORD"];
const optionalSeededSecrets = [
  "E2E_ADMIN_EMAIL",
  "E2E_ADMIN_PASSWORD",
  "E2E_CUSTOMER_EMAIL",
  "E2E_CUSTOMER_PASSWORD",
];
const stripeSecretKeys = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"];
const presetEnvKeys = new Set(Object.keys(process.env));

const modeConfig = {
  release: {
    title: "Release Readiness Gate",
    requiredSecrets: coreSecretKeys,
    requiredAnyUrl: ["RELEASE_BASE_URL", "NEXT_PUBLIC_APP_URL"],
    optionalVars: ["CARD_PAYMENT_PROVIDER", "LAUNCH_QA_PRODUCT_SLUG"],
    optionalSecrets: [...optionalSmokeSecrets, ...optionalSeededSecrets],
  },
  launch: {
    title: "Launch QA Pack",
    requiredSecrets: [],
    requiredAnyUrl: ["LAUNCH_QA_BASE_URL", "RELEASE_BASE_URL", "NEXT_PUBLIC_APP_URL"],
    optionalVars: ["LAUNCH_QA_PRODUCT_SLUG"],
    optionalSecrets: optionalSmokeSecrets,
  },
  cutover: {
    title: "Cutover Sign-off",
    requiredSecrets: coreSecretKeys,
    requiredAnyUrl: ["RELEASE_BASE_URL", "NEXT_PUBLIC_APP_URL"],
    optionalVars: ["CARD_PAYMENT_PROVIDER", "LAUNCH_QA_PRODUCT_SLUG"],
    optionalSecrets: [...optionalSmokeSecrets, ...stripeSecretKeys],
  },
};

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

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

function hasEnv(key) {
  return hasValue(process.env[key]);
}

function normalizeMode(raw) {
  const value = String(raw ?? "all").trim().toLowerCase();
  if (value === "release" || value === "launch" || value === "cutover" || value === "all") {
    return value;
  }
  return "all";
}

function normalizeBoolean(raw, fallback = false) {
  if (!hasValue(raw)) return fallback;
  const value = String(raw).trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

function normalizeProvider(raw) {
  const value = String(raw ?? "SANDBOX").trim().toUpperCase();
  if (value === "STRIPE_CHECKOUT" || value === "SANDBOX") return value;
  return "SANDBOX";
}

function isUrlValid(raw) {
  if (!hasValue(raw)) return false;
  try {
    void new URL(String(raw).trim());
    return true;
  } catch {
    return false;
  }
}

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

function printPass(message) {
  console.log(`PASS  ${message}`);
}

function printWarn(message) {
  console.log(`WARN  ${message}`);
}

function printFail(message) {
  console.log(`FAIL  ${message}`);
}

function checkMode(modeKey, strictWarningsAsErrors) {
  const mode = modeConfig[modeKey];
  const errors = [];
  const warnings = [];

  printSection(mode.title);

  for (const key of mode.requiredSecrets) {
    if (hasEnv(key)) {
      printPass(`${key} configured`);
    } else {
      const message = `${key} is missing`;
      errors.push(message);
      printFail(message);
    }
  }

  const availableUrlKey = mode.requiredAnyUrl.find((key) => hasEnv(key));
  if (!availableUrlKey) {
    const message = `At least one base URL variable is required: ${mode.requiredAnyUrl.join(", ")}`;
    errors.push(message);
    printFail(message);
  } else if (!isUrlValid(process.env[availableUrlKey])) {
    const message = `${availableUrlKey} is not a valid URL`;
    errors.push(message);
    printFail(message);
  } else {
    printPass(`${availableUrlKey} configured with valid URL`);
  }

  for (const key of mode.optionalVars) {
    if (hasEnv(key)) {
      printPass(`${key} configured`);
    } else {
      const message = `${key} is not configured (optional but recommended)`;
      warnings.push(message);
      printWarn(message);
    }
  }

  for (const key of mode.optionalSecrets) {
    if (hasEnv(key)) {
      printPass(`${key} configured`);
    } else {
      const message = `${key} is not configured (optional)`;
      warnings.push(message);
      printWarn(message);
    }
  }

  if (hasEnv("JWT_SECRET")) {
    const secretLength = String(process.env.JWT_SECRET).trim().length;
    if (secretLength < 32) {
      const message = "JWT_SECRET must be at least 32 characters";
      errors.push(message);
      printFail(message);
    }
  }

  const provider = normalizeProvider(process.env.CARD_PAYMENT_PROVIDER);
  if (provider === "STRIPE_CHECKOUT") {
    for (const key of stripeSecretKeys) {
      if (!hasEnv(key)) {
        const message = `${key} is required when CARD_PAYMENT_PROVIDER=STRIPE_CHECKOUT`;
        errors.push(message);
        printFail(message);
      }
    }
  }

  if (strictWarningsAsErrors && warnings.length > 0) {
    errors.push("Warnings are treated as errors in strict mode.");
  }

  return { errors, warnings };
}

async function main() {
  loadLocalEnv();

  const args = parseArgs(process.argv.slice(2));
  const mode = normalizeMode(args.mode);
  const strict = normalizeBoolean(args.strict, false);
  const selectedModes = mode === "all" ? ["release", "launch", "cutover"] : [mode];

  printSection("Deal Bazaar Release Config Check");
  console.log(`Mode: ${mode}`);
  console.log(`Strict warnings as errors: ${strict ? "ON" : "OFF"}`);
  console.log(`CARD_PAYMENT_PROVIDER: ${normalizeProvider(process.env.CARD_PAYMENT_PROVIDER)}`);

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const selectedMode of selectedModes) {
    const result = checkMode(selectedMode, strict);
    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;
  }

  printSection("Summary");
  console.log(`Warnings: ${totalWarnings}`);
  console.log(`Errors: ${totalErrors}`);

  if (totalErrors > 0) {
    console.log("\nRelease config check FAILED.");
    process.exit(1);
  }

  console.log("\nRelease config check PASSED.");
}

await main();
