import process from "node:process";
import crypto from "node:crypto";

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
  return value.trim().replace(/\/+$/, "");
}

function normalizePositiveInteger(value, fallback) {
  if (value === undefined || value === null || String(value).trim().length === 0) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

function buildMutationHeaders(baseUrl) {
  return {
    "content-type": "application/json",
    origin: baseUrl,
    referer: `${baseUrl}/`,
  };
}

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

function printPass(label, message) {
  console.log(`PASS  ${label}${message ? ` - ${message}` : ""}`);
}

function printFail(label, message) {
  console.log(`FAIL  ${label}${message ? ` - ${message}` : ""}`);
}

function printSkip(label, message) {
  console.log(`SKIP  ${label}${message ? ` - ${message}` : ""}`);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function parseTextSafe(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function getCookieFromSetCookieHeader(value) {
  if (!value) return "";
  const pair = value.split(";")[0] ?? "";
  return pair.trim();
}

function resolveSessionCookie(loginResponse) {
  const namedPrefix = "deal_bazaar_session=";

  if (typeof loginResponse.headers.getSetCookie === "function") {
    const cookieHeaders = loginResponse.headers.getSetCookie();
    for (const header of cookieHeaders) {
      const cookiePair = getCookieFromSetCookieHeader(header);
      if (cookiePair.startsWith(namedPrefix)) {
        return cookiePair;
      }
    }
  }

  const setCookieHeader = loginResponse.headers.get("set-cookie");
  if (!setCookieHeader) return "";

  const cookieCandidates = setCookieHeader.split(/,(?=[^;]+=[^;]+)/g);
  for (const candidate of cookieCandidates) {
    const cookiePair = getCookieFromSetCookieHeader(candidate);
    if (cookiePair.startsWith(namedPrefix)) {
      return cookiePair;
    }
  }

  return "";
}

async function waitForRuntimeReady(baseUrl, options) {
  const timeoutSeconds = options.timeoutSeconds;
  const intervalSeconds = options.intervalSeconds;

  if (timeoutSeconds <= 0) {
    return {
      ready: true,
      attempts: 0,
      elapsedSeconds: 0,
      status: "not-waiting",
    };
  }

  const deadline = Date.now() + timeoutSeconds * 1000;
  let attempts = 0;
  let lastStatus = "unreachable";

  while (Date.now() <= deadline) {
    attempts += 1;
    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        cache: "no-store",
        headers: {
          "x-request-id": `runtime-ready-${crypto.randomUUID()}`,
        },
      });
      const payload = await parseJsonSafe(response);
      const status = typeof payload?.status === "string" ? payload.status : "unknown";
      lastStatus = status;

      if (response.status === 200 && (status === "ok" || status === "degraded")) {
        const elapsedSeconds = Math.round((timeoutSeconds * 1000 - Math.max(0, deadline - Date.now())) / 1000);
        return {
          ready: true,
          attempts,
          elapsedSeconds,
          status,
        };
      }
    } catch {
      lastStatus = "unreachable";
    }

    await sleep(intervalSeconds * 1000);
  }

  return {
    ready: false,
    attempts,
    elapsedSeconds: timeoutSeconds,
    status: lastStatus,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(
    args["base-url"] ??
      args.url ??
      process.env.SMOKE_BASE_URL ??
      process.env.NEXT_PUBLIC_APP_URL,
  );
  const waitForReadySeconds = normalizePositiveInteger(
    args["wait-for-ready"] ?? process.env.SMOKE_WAIT_FOR_READY_SECONDS,
    0,
  );
  const retryIntervalSeconds = Math.max(
    1,
    normalizePositiveInteger(args["retry-interval"] ?? process.env.SMOKE_RETRY_INTERVAL_SECONDS, 10),
  );

  if (!baseUrl) {
    console.error(
      "Missing base URL. Use --base-url https://your-domain or set SMOKE_BASE_URL/NEXT_PUBLIC_APP_URL.",
    );
    process.exit(1);
  }

  const requestIdPrefix = `runtime-smoke-${crypto.randomUUID()}`;
  let failures = 0;

  printSection("Deal Bazaar Runtime Smoke Check");
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  if (waitForReadySeconds > 0) {
    console.log(`Readiness wait: enabled (${waitForReadySeconds}s timeout, ${retryIntervalSeconds}s interval)`);
  }

  const runCheck = async (label, runner) => {
    try {
      await runner(label);
    } catch (error) {
      failures += 1;
      const message = error instanceof Error ? error.message : "Unknown failure";
      printFail(label, message);
    }
  };

  await runCheck("Deployment readiness wait", async () => {
    const readiness = await waitForRuntimeReady(baseUrl, {
      timeoutSeconds: waitForReadySeconds,
      intervalSeconds: retryIntervalSeconds,
    });
    if (!readiness.ready) {
      throw new Error(
        `runtime not ready after ${readiness.elapsedSeconds}s (attempts=${readiness.attempts}, lastStatus=${readiness.status})`,
      );
    }
    if (waitForReadySeconds <= 0) {
      printSkip(
        "Deployment readiness wait",
        "Disabled (set --wait-for-ready to enable).",
      );
      return;
    }
    printPass(
      "Deployment readiness wait",
      `ready in ${readiness.elapsedSeconds}s after ${readiness.attempts} attempt(s), status=${readiness.status}`,
    );
  });

  await runCheck("Public health summary", async (label) => {
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: {
        "x-request-id": `${requestIdPrefix}-public-health`,
      },
      cache: "no-store",
    });
    const payload = await parseJsonSafe(response);

    if (![200, 503].includes(response.status)) {
      throw new Error(`Unexpected status ${response.status}`);
    }
    if (!payload || typeof payload !== "object") {
      throw new Error("Invalid JSON payload");
    }
    if (typeof payload.status !== "string") {
      throw new Error("Missing status field");
    }
    if (!["ok", "degraded", "down"].includes(payload.status)) {
      throw new Error(`Unexpected health status: ${payload.status}`);
    }
    if (payload.checks !== undefined) {
      throw new Error("Public health payload should not expose internal checks");
    }
    if (payload.status === "down") {
      throw new Error("Health status is down");
    }

    printPass(label, `status=${payload.status}`);
  });

  await runCheck("Login page render", async (label) => {
    const response = await fetch(`${baseUrl}/login`, { cache: "no-store" });
    const html = await parseTextSafe(response);
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`);
    if (!html.includes("Deal Bazaar")) throw new Error("Brand text not found");
    if (!html.includes("Sign In")) throw new Error("Sign-in UI text not found");
    printPass(label, "login page is reachable");
  });

  await runCheck("Register page render", async (label) => {
    const response = await fetch(`${baseUrl}/register`, { cache: "no-store" });
    const html = await parseTextSafe(response);
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`);
    if (!html.includes("Create")) throw new Error("Register UI text not found");
    printPass(label, "register page is reachable");
  });

  await runCheck("Checkout options API", async (label) => {
    const response = await fetch(`${baseUrl}/api/checkout/options`, {
      cache: "no-store",
      headers: {
        "x-request-id": `${requestIdPrefix}-checkout-options`,
      },
    });
    const payload = await parseJsonSafe(response);
    if (!response.ok) {
      throw new Error(`Expected 200, received ${response.status}`);
    }
    if (!payload || payload.success !== true) {
      throw new Error("Expected successful checkout options payload");
    }
    const paymentMethods = payload?.data?.paymentMethods;
    if (!Array.isArray(paymentMethods) || paymentMethods.length === 0) {
      throw new Error("Payment methods are missing in checkout options");
    }
    const cardProvider = String(payload?.data?.cardPaymentProvider ?? "UNKNOWN");
    const cardProviderReady = Boolean(payload?.data?.cardPaymentProviderReady);
    const providerUnavailableReason = String(
      payload?.data?.cardPaymentProviderUnavailableReason ?? "",
    ).trim();
    if (cardProvider === "STRIPE_CHECKOUT" && !cardProviderReady) {
      throw new Error(
        `Stripe provider selected but not ready${
          providerUnavailableReason ? `: ${providerUnavailableReason}` : "."
        }`,
      );
    }
    printPass(
      label,
      `${paymentMethods.length} payment method(s) available, provider=${cardProvider}, ready=${cardProviderReady}`,
    );
  });

  await runCheck("Auth me without session", async (label) => {
    const response = await fetch(`${baseUrl}/api/auth/me`, { cache: "no-store" });
    const payload = await parseJsonSafe(response);
    if (response.status !== 401) throw new Error(`Expected 401, received ${response.status}`);
    if (!payload || payload.code !== "UNAUTHENTICATED") {
      throw new Error("Expected UNAUTHENTICATED response code");
    }
    printPass(label, "unauthenticated guard works");
  });

  await runCheck("Admin health without admin session", async (label) => {
    const response = await fetch(`${baseUrl}/api/admin/health`, { cache: "no-store" });
    const payload = await parseJsonSafe(response);
    if (response.status !== 403) throw new Error(`Expected 403, received ${response.status}`);
    if (!payload || payload.code !== "FORBIDDEN") {
      throw new Error("Expected FORBIDDEN response code");
    }
    printPass(label, "admin guard works");
  });

  await runCheck("Login invalid credentials behavior", async (label) => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: buildMutationHeaders(baseUrl),
      body: JSON.stringify({
        email: `runtime-smoke-${Date.now()}@example.test`,
        password: "NotARealUser123",
      }),
      cache: "no-store",
    });
    const payload = await parseJsonSafe(response);
    const responseRequestId = response.headers.get("x-request-id") ?? "";
    const responseCode = typeof payload?.code === "string" ? payload.code : "";

    if (response.status === 503) {
      if (
        [
          "AUTH_CONFIG_ERROR",
          "AUTH_SCHEMA_MISSING",
          "AUTH_DB_CREDENTIALS_INVALID",
          "AUTH_DB_UNAVAILABLE",
        ].includes(responseCode)
      ) {
        throw new Error(
          `runtime auth unavailable (${responseCode}). requestId=${responseRequestId || "missing"}`,
        );
      }
      throw new Error(`runtime auth unavailable with status 503. requestId=${responseRequestId || "missing"}`);
    }

    if (![401, 403].includes(response.status)) {
      throw new Error(`Expected 401/403 for invalid login, received ${response.status}`);
    }
    if (!payload || payload.success !== false) {
      throw new Error("Expected failed auth payload");
    }
    if (!responseRequestId) {
      throw new Error("Missing x-request-id header on auth login response");
    }
    printPass(label, `rejected with status ${response.status}`);
  });

  await runCheck("Card session token validation", async (label) => {
    const response = await fetch(`${baseUrl}/api/payments/card/session?token=invalid-token`, {
      cache: "no-store",
      headers: {
        "x-request-id": `${requestIdPrefix}-card-session`,
      },
    });
    const payload = await parseJsonSafe(response);
    if (response.status !== 400) {
      throw new Error(`Expected 400, received ${response.status}`);
    }
    if (!payload || payload.success !== false) {
      throw new Error("Expected failed card session payload");
    }
    printPass(label, "invalid card session token rejected");
  });

  await runCheck("Card retry payload validation", async (label) => {
    const response = await fetch(`${baseUrl}/api/payments/card/retry`, {
      method: "POST",
      headers: buildMutationHeaders(baseUrl),
      body: JSON.stringify({
        orderId: "not-a-uuid",
      }),
      cache: "no-store",
    });
    const payload = await parseJsonSafe(response);
    if (response.status !== 400) {
      throw new Error(`Expected 400, received ${response.status}`);
    }
    if (!payload || payload.success !== false) {
      throw new Error("Expected failed card retry payload");
    }
    printPass(label, "invalid retry payload rejected");
  });

  await runCheck("Stripe webhook signature validation", async (label) => {
    const response = await fetch(`${baseUrl}/api/payments/card/stripe/webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        id: "evt_runtime_smoke",
        type: "checkout.session.completed",
        data: { object: {} },
      }),
      cache: "no-store",
    });
    const payload = await parseJsonSafe(response);
    if (![400, 429].includes(response.status)) {
      throw new Error(`Expected 400/429, received ${response.status}`);
    }
    if (!payload || payload.success !== false) {
      throw new Error("Expected failed stripe webhook payload");
    }
    if (response.status === 400 && payload.code !== "STRIPE_SIGNATURE_MISSING") {
      throw new Error(`Expected STRIPE_SIGNATURE_MISSING, received ${String(payload.code ?? "none")}`);
    }
    printPass(label, `webhook guard returned status ${response.status}`);
  });

  const smokeEmail = (args.email ?? process.env.SMOKE_LOGIN_EMAIL ?? "").trim().toLowerCase();
  const smokePassword = (args.password ?? process.env.SMOKE_LOGIN_PASSWORD ?? "").trim();

  if (!smokeEmail || !smokePassword) {
    printSkip(
      "Authenticated login check",
      "Set SMOKE_LOGIN_EMAIL and SMOKE_LOGIN_PASSWORD to enable.",
    );
  } else {
    await runCheck("Authenticated login check", async (label) => {
      const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: buildMutationHeaders(baseUrl),
        body: JSON.stringify({
          email: smokeEmail,
          password: smokePassword,
        }),
        cache: "no-store",
      });
      const loginPayload = await parseJsonSafe(loginResponse);

      if (!loginResponse.ok || !loginPayload || loginPayload.success !== true) {
        const code = typeof loginPayload?.code === "string" ? loginPayload.code : "UNKNOWN";
        const requestId = loginResponse.headers.get("x-request-id") ?? "missing";
        const reason =
          loginPayload && typeof loginPayload.error === "string"
            ? loginPayload.error
            : `status ${loginResponse.status}`;
        throw new Error(`Login failed: ${reason} (code=${code}, requestId=${requestId})`);
      }

      const sessionCookie = resolveSessionCookie(loginResponse);
      if (!sessionCookie) {
        throw new Error("Session cookie was not set");
      }

      const meResponse = await fetch(`${baseUrl}/api/auth/me`, {
        headers: {
          cookie: sessionCookie,
        },
        cache: "no-store",
      });
      const mePayload = await parseJsonSafe(meResponse);
      if (!meResponse.ok || !mePayload?.success) {
        throw new Error(`Auth session validation failed with status ${meResponse.status}`);
      }

      const returnedEmail = String(mePayload?.data?.email ?? "").toLowerCase();
      if (returnedEmail !== smokeEmail) {
        throw new Error("Authenticated session email mismatch");
      }

      const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
        method: "POST",
        headers: {
          ...buildMutationHeaders(baseUrl),
          cookie: sessionCookie,
        },
        cache: "no-store",
      });
      if (!logoutResponse.ok) {
        throw new Error(`Logout failed with status ${logoutResponse.status}`);
      }

      printPass(label, "login/session/logout flow verified");
    });
  }

  printSection("Summary");
  if (failures > 0) {
    console.log(`Result: FAILED (${failures} checks failed)`);
    process.exit(1);
  }

  console.log("Result: PASSED (all required checks passed)");
}

await main();
