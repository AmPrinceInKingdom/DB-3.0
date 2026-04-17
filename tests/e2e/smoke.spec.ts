import { expect, test } from "@playwright/test";

test("home page renders key storefront elements", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: /Deal Bazaar/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Shop", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Explore all products/i })).toBeVisible();
});

test("guest user is redirected when opening admin panel", async ({ page }) => {
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("add to cart updates header cart badge", async ({ page }) => {
  await page.goto("/");

  const addToCartButtons = page.getByRole("button", { name: /Add to cart/i });
  const buttonCount = await addToCartButtons.count();
  test.skip(buttonCount === 0, "No seeded products with Add to cart buttons available.");

  await addToCartButtons.first().click();

  await expect(page.getByText(/added to cart/i)).toBeVisible();
  await expect(page.getByLabel("Cart (1 items)")).toBeVisible();
});

test.describe("mobile storefront header", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("hides currency/language/signup on public mobile home", async ({ page }) => {
    await page.goto("/");

    const header = page.locator("header").first();
    await expect(header.locator("select:visible")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Sign In" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Account" })).toBeVisible();
  });
});

test("admin login smoke (optional via env credentials)", async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!email || !password, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run this test.");

  await page.goto("/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();

  await page.waitForURL("**/admin", { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Admin Dashboard" })).toBeVisible();
});
