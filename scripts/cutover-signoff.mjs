import process from "node:process";
import { execSync } from "node:child_process";

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

function normalizeBaseUrl(value) {
  if (!value) return "";
  try {
    return new URL(String(value).trim()).toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || String(value).trim().length === 0) {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "y";
}

function run(command, env = process.env) {
  execSync(command, {
    stdio: "inherit",
    env,
  });
}

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(
    args["base-url"] ?? process.env.RELEASE_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL,
  );
  const productSlug = String(
    args["product-slug"] ?? process.env.LAUNCH_QA_PRODUCT_SLUG ?? "16tb-usb-3-2-flash-drive",
  )
    .trim()
    .toLowerCase();
  const includeAuth = parseBoolean(args["include-auth"] ?? process.env.SMOKE_INCLUDE_AUTH, true);
  const provider = String(process.env.CARD_PAYMENT_PROVIDER ?? "SANDBOX").trim().toUpperCase();

  const confirmDbBackup = parseBoolean(
    args["confirm-db-backup"] ?? process.env.CONFIRM_DB_BACKUP,
    false,
  );
  const confirmRollbackPlan = parseBoolean(
    args["confirm-rollback-plan"] ?? process.env.CONFIRM_ROLLBACK_PLAN,
    false,
  );
  const confirmOnCall = parseBoolean(
    args["confirm-oncall"] ?? process.env.CONFIRM_ONCALL,
    false,
  );

  if (!baseUrl) {
    console.error("Missing --base-url (or RELEASE_BASE_URL/NEXT_PUBLIC_APP_URL).");
    process.exit(1);
  }

  printSection("Deal Bazaar Cutover Sign-off");
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Product slug: ${productSlug}`);
  console.log(`Card provider: ${provider}`);
  console.log(`Include authenticated runtime smoke: ${includeAuth ? "YES" : "NO"}`);

  printSection("Automated Gate Checks");
  run("npm run verify:deploy");

  if (provider === "STRIPE_CHECKOUT") {
    run("npm run verify:stripe-live -- --production");
  } else {
    console.log("SKIP  Stripe live check (CARD_PAYMENT_PROVIDER is SANDBOX)");
  }

  if (includeAuth) {
    const smokeEmail = String(process.env.SMOKE_LOGIN_EMAIL ?? "").trim();
    const smokePassword = String(process.env.SMOKE_LOGIN_PASSWORD ?? "").trim();
    if (!smokeEmail || !smokePassword) {
      console.log(
        "WARN  SMOKE_LOGIN_EMAIL/SMOKE_LOGIN_PASSWORD not set. Authenticated runtime smoke skipped.",
      );
      run(`npm run verify:runtime -- --base-url "${baseUrl}" --wait-for-ready 300 --retry-interval 15`);
    } else {
      run(
        `npm run verify:runtime -- --base-url "${baseUrl}" --wait-for-ready 300 --retry-interval 15 --email "${smokeEmail}" --password "${smokePassword}"`,
      );
    }
  } else {
    run(`npm run verify:runtime -- --base-url "${baseUrl}" --wait-for-ready 300 --retry-interval 15`);
  }

  run(`npm run verify:launch-qa -- --base-url "${baseUrl}" --product-slug "${productSlug}"`);

  printSection("Manual Launch Confirmations");
  const confirmations = [
    {
      label: "Database backup taken and verified",
      value: confirmDbBackup,
      env: "CONFIRM_DB_BACKUP",
    },
    {
      label: "Rollback plan reviewed (previous deployment URL available)",
      value: confirmRollbackPlan,
      env: "CONFIRM_ROLLBACK_PLAN",
    },
    {
      label: "On-call owner is assigned for launch window",
      value: confirmOnCall,
      env: "CONFIRM_ONCALL",
    },
  ];

  let failedConfirmations = 0;
  for (const item of confirmations) {
    if (item.value) {
      console.log(`PASS  ${item.label}`);
    } else {
      failedConfirmations += 1;
      console.log(`FAIL  ${item.label} (set ${item.env}=true or pass matching --confirm flag)`);
    }
  }

  printSection("Summary");
  if (failedConfirmations > 0) {
    console.log(`Result: FAILED (${failedConfirmations} manual confirmation(s) missing)`);
    process.exit(1);
  }

  console.log("Result: PASSED (cutover sign-off is ready)");
}

await main();
