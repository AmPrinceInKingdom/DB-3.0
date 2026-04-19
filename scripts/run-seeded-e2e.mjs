import { execSync } from "node:child_process";

const seededAdminEmail = process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@dealbazaar.test";
const seededAdminPassword = process.env.E2E_ADMIN_PASSWORD ?? "DealBazaar@2026#E2E";

const env = {
  ...process.env,
  E2E_ADMIN_EMAIL: seededAdminEmail,
  E2E_ADMIN_PASSWORD: seededAdminPassword,
  E2E_USE_START: "1",
  PRISMA_USE_DIRECT_URL: "1",
};

function run(command) {
  execSync(command, {
    stdio: "inherit",
    env,
  });
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function runWithRetry(command, label, attempts = 3, delayMs = 5000) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      run(command);
      return;
    } catch (error) {
      if (attempt >= attempts) {
        throw error;
      }
      console.warn(`[${label}] attempt ${attempt}/${attempts} failed. Retrying in ${delayMs}ms...`);
      sleep(delayMs);
    }
  }
}

runWithRetry("npm run seed:e2e", "seed:e2e");
run("npm run build");
run("npx playwright test --workers=1");
