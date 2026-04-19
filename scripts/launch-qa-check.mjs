import process from "node:process";

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

function parseArgs(argv) {
  const result = {
    baseUrl: "",
    productSlug: process.env.LAUNCH_QA_PRODUCT_SLUG?.trim() || "16tb-usb-3-2-flash-drive",
    timeoutMs: Number(process.env.LAUNCH_QA_TIMEOUT_MS ?? 30_000),
    warnSlowMs: Number(process.env.LAUNCH_QA_WARN_SLOW_MS ?? 5_000),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--base-url") {
      result.baseUrl = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--product-slug") {
      result.productSlug = argv[index + 1] ?? result.productSlug;
      index += 1;
      continue;
    }
    if (arg === "--timeout-ms") {
      const value = Number(argv[index + 1]);
      if (Number.isFinite(value) && value > 0) result.timeoutMs = value;
      index += 1;
      continue;
    }
    if (arg === "--warn-slow-ms") {
      const value = Number(argv[index + 1]);
      if (Number.isFinite(value) && value > 0) result.warnSlowMs = value;
      index += 1;
      continue;
    }
  }

  return result;
}

function normalizeBaseUrl(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function hasTag(html, pattern) {
  return pattern.test(html);
}

function assertOrPush(condition, errorMessage, errorBag) {
  if (!condition) {
    errorBag.push(errorMessage);
  }
}

async function fetchWithTiming(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "DealBazaarLaunchQA/1.0",
      },
    });
    const body = await response.text();
    const elapsedMs = Date.now() - startedAt;
    return {
      ok: response.ok,
      status: response.status,
      elapsedMs,
      contentType: response.headers.get("content-type") ?? "",
      body,
      url,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkPage({
  baseUrl,
  path,
  timeoutMs,
  warnSlowMs,
  expectHtml = true,
  validate,
  warnings,
  errors,
}) {
  const url = `${baseUrl}${path}`;
  let result;
  try {
    result = await fetchWithTiming(url, timeoutMs);
  } catch (error) {
    errors.push(`${path}: request failed (${error instanceof Error ? error.message : "unknown error"})`);
    return;
  }

  if (result.elapsedMs > warnSlowMs) {
    warnings.push(`${path}: slow response (${result.elapsedMs}ms)`);
  }

  if (!result.ok) {
    errors.push(`${path}: expected 2xx status, got ${result.status}`);
    return;
  }

  if (expectHtml && !result.contentType.toLowerCase().includes("text/html")) {
    errors.push(`${path}: expected HTML response, got "${result.contentType || "unknown"}"`);
    return;
  }

  if (validate) {
    validate(result.body, errors, warnings);
  }

  console.log(`PASS  ${path} (${result.status}, ${result.elapsedMs}ms)`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const normalizedBaseUrl =
    normalizeBaseUrl(args.baseUrl) ||
    normalizeBaseUrl(process.env.LAUNCH_QA_BASE_URL) ||
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL);

  if (!normalizedBaseUrl) {
    console.error(
      "Missing --base-url and no valid LAUNCH_QA_BASE_URL/NEXT_PUBLIC_APP_URL found.",
    );
    process.exit(1);
  }

  const warnings = [];
  const errors = [];
  const productSlug = args.productSlug.trim() || "16tb-usb-3-2-flash-drive";

  printSection("Launch QA Target");
  console.log(`Base URL: ${normalizedBaseUrl}`);
  console.log(`Product slug: ${productSlug}`);
  console.log(`Timeout: ${args.timeoutMs}ms`);
  console.log(`Slow warning threshold: ${args.warnSlowMs}ms`);

  printSection("Core Public Pages");
  const corePages = [
    "/",
    "/shop",
    `/product/${encodeURIComponent(productSlug)}`,
    "/about",
    "/contact",
    "/faq",
    "/privacy",
    "/terms",
    "/offers",
    "/new-arrivals",
    "/best-sellers",
    "/featured-products",
    "/shipping-policy",
    "/return-policy",
    "/help-center",
    "/login",
    "/register",
  ];

  for (const path of corePages) {
    await checkPage({
      baseUrl: normalizedBaseUrl,
      path,
      timeoutMs: args.timeoutMs,
      warnSlowMs: args.warnSlowMs,
      warnings,
      errors,
      validate: path === "/"
        ? (html, errorBag) => {
            assertOrPush(hasTag(html, /<html[^>]*lang=["']en["']/i), "Home: missing html lang='en'", errorBag);
            assertOrPush(hasTag(html, /<title>[^<]+<\/title>/i), "Home: missing <title>", errorBag);
            assertOrPush(
              hasTag(html, /<meta[^>]+name=["']description["'][^>]*>/i),
              "Home: missing meta description",
              errorBag,
            );
            assertOrPush(
              hasTag(html, /<meta[^>]+property=["']og:title["'][^>]*>/i),
              "Home: missing Open Graph title",
              errorBag,
            );
            assertOrPush(
              hasTag(html, /<meta[^>]+name=["']viewport["'][^>]*>/i),
              "Home: missing viewport meta",
              errorBag,
            );
            assertOrPush(
              hasTag(html, /<link[^>]+rel=["']canonical["'][^>]*>/i),
              "Home: missing canonical link",
              errorBag,
            );
          }
        : path.startsWith("/product/")
          ? (html, errorBag) => {
              assertOrPush(
                hasTag(html, /Add to cart/i),
                "Product details: missing 'Add to cart' action",
                errorBag,
              );
              assertOrPush(
                hasTag(html, /<meta[^>]+property=["']og:title["'][^>]*>/i),
                "Product details: missing Open Graph title",
                errorBag,
              );
            }
          : undefined,
    });
  }

  printSection("SEO Assets");
  await checkPage({
    baseUrl: normalizedBaseUrl,
    path: "/robots.txt",
    timeoutMs: args.timeoutMs,
    warnSlowMs: args.warnSlowMs,
    expectHtml: false,
    warnings,
    errors,
    validate: (body, errorBag) => {
      assertOrPush(/User-agent:/i.test(body), "robots.txt: missing User-agent rule", errorBag);
      assertOrPush(/Sitemap:/i.test(body), "robots.txt: missing Sitemap entry", errorBag);
    },
  });

  await checkPage({
    baseUrl: normalizedBaseUrl,
    path: "/sitemap.xml",
    timeoutMs: args.timeoutMs,
    warnSlowMs: args.warnSlowMs,
    expectHtml: false,
    warnings,
    errors,
    validate: (body, errorBag) => {
      assertOrPush(/<urlset/i.test(body), "sitemap.xml: missing urlset", errorBag);
      assertOrPush(/<loc>/i.test(body), "sitemap.xml: no URLs found", errorBag);
      assertOrPush(
        body.toLowerCase().includes("/shop"),
        "sitemap.xml: expected /shop URL entry",
        errorBag,
      );
    },
  });

  printSection("Runtime APIs");
  await checkPage({
    baseUrl: normalizedBaseUrl,
    path: "/api/health",
    timeoutMs: args.timeoutMs,
    warnSlowMs: args.warnSlowMs,
    expectHtml: false,
    warnings,
    errors,
    validate: (body, errorBag) => {
      const statusMatch = body.match(/"status"\s*:\s*"([^"]+)"/i);
      const status = statusMatch?.[1]?.toLowerCase();
      assertOrPush(Boolean(status), "/api/health: missing status field", errorBag);
      assertOrPush(
        ["ok", "degraded", "down"].includes(status ?? ""),
        `/api/health: unexpected status=${status ?? "unknown"}`,
        errorBag,
      );
      assertOrPush(status !== "down", "/api/health: status is down", errorBag);
    },
  });

  await checkPage({
    baseUrl: normalizedBaseUrl,
    path: "/api/checkout/options",
    timeoutMs: args.timeoutMs,
    warnSlowMs: args.warnSlowMs,
    expectHtml: false,
    warnings,
    errors,
    validate: (body, errorBag) => {
      assertOrPush(/"paymentMethods"/i.test(body), "/api/checkout/options: missing paymentMethods", errorBag);
      assertOrPush(/"shippingMethods"/i.test(body), "/api/checkout/options: missing shippingMethods", errorBag);
    },
  });

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
    console.log("\nLaunch QA check FAILED.");
    process.exit(1);
  }

  console.log("\nLaunch QA check PASSED.");
}

main().catch((error) => {
  console.error("Launch QA check failed unexpectedly:", error);
  process.exit(1);
});
