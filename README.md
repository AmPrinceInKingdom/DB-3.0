# Deal Bazaar

Deal Bazaar is a full-feature e-commerce marketplace built with `Next.js + TypeScript + Prisma` using **Supabase PostgreSQL as the main database**.

## Tech Stack

- `Next.js 16` (App Router)
- `TypeScript`
- `Prisma ORM`
- `Supabase PostgreSQL` (main DB)
- `Supabase Storage` (product images, payment proofs, branding assets)
- `Zustand`, `Zod`, `React Hook Form`, `Tailwind CSS`

## Requirements

- `Node.js 20+`
- `npm 10+`
- Supabase project (Database + Storage)

## Project Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Configure `.env`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL` (Supabase pooler, `6543`)
- `DIRECT_URL` (Supabase direct, `5432`)
- `PRISMA_USE_DIRECT_URL` (optional: `1` for local/E2E runtime, keep `0` on Vercel production)
- `SUPABASE_STORAGE_BUCKET_PRODUCTS`
- `SUPABASE_STORAGE_BUCKET_PAYMENTS`
- `SUPABASE_STORAGE_BUCKET_BRANDING`
- `JWT_SECRET`
- `OTP_PEPPER`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`
- `SMTP_USER`, `SMTP_PASS`
- `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`

4. Generate Prisma client:

```bash
npm run prisma:generate
```

5. Start dev server:

```bash
npm run dev
```

App runs on `http://localhost:3000`.

## Supabase DB Setup (Main)

1. Create Supabase project.
2. Open `Project Settings -> Database`.
3. Copy:
- Pooler connection (`6543`) -> `DATABASE_URL`
- Direct connection (`5432`) -> `DIRECT_URL`

Example:

```env
DATABASE_URL=postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://postgres:<PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres
# Optional local/E2E switch:
PRISMA_USE_DIRECT_URL=0
```

Use `PRISMA_USE_DIRECT_URL=1` only for local production-mode checks (for example seeded E2E with `next start`) when pooler connectivity is unstable. Keep it `0` on Vercel production so runtime uses the pooler URL.

4. Apply schema SQL:

```bash
psql "<DIRECT_URL>" -f ./database/deal_bazaar.sql
```

5. Verify tables:

```bash
psql "<DIRECT_URL>" -c "\dt"
```

## Supabase Storage Setup

Create these buckets:

- `deal-bazaar-products`
- `deal-bazaar-payment-proofs`
- `deal-bazaar-branding`

Set them in `.env`:

```env
SUPABASE_STORAGE_BUCKET_PRODUCTS=deal-bazaar-products
SUPABASE_STORAGE_BUCKET_PAYMENTS=deal-bazaar-payment-proofs
SUPABASE_STORAGE_BUCKET_BRANDING=deal-bazaar-branding
```

## Signup OTP Email (Gmail)

To send OTP during signup, configure Gmail SMTP in `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=dealbazaar.pvt@gmail.com
SMTP_PASS=<GMAIL_APP_PASSWORD>
SMTP_FROM_EMAIL=dealbazaar.pvt@gmail.com
SMTP_FROM_NAME=Deal Bazaar
```

Important:

- Turn on 2-Step Verification for the Gmail account.
- Generate a Gmail App Password and use it as `SMTP_PASS`.
- OTP and verification link emails are sent automatically on register and resend endpoints.

## Create Super Admin

```bash
npm run seed:super-admin -- --email superadmin@dealbazaar.lk --password DealBazaar@2026#Admin --firstName Deal --lastName Owner
```

## Deterministic E2E Seed

Create fixed test data (admin + customer + product slugs used by Playwright smoke):

```bash
npm run seed:e2e
```

This seeds:

- `e2e-admin@dealbazaar.test` (role: `SUPER_ADMIN`)
- `e2e-customer@dealbazaar.test` (role: `CUSTOMER`)
- `16tb-usb-3-2-flash-drive`
- `bluetooth-smart-glasses`

You can override defaults with env vars:

```env
E2E_ADMIN_EMAIL=your-admin@example.com
E2E_ADMIN_PASSWORD=StrongPassword123#
E2E_CUSTOMER_EMAIL=your-customer@example.com
E2E_CUSTOMER_PASSWORD=StrongPassword123#
```

## Useful Scripts

- `npm run dev` - start development server
- `npm run build` - production build
- `npm run lint` - lint check
- `npm run typecheck` - TypeScript check
- `npm run test` - run automated tests once
- `npm run test:watch` - run tests in watch mode
- `npm run test:coverage` - run tests with coverage report
- `npm run test:e2e` - run Playwright smoke tests
- `npm run test:e2e:headed` - run Playwright with browser UI
- `npm run test:e2e:install` - install Playwright Chromium browser
- `npm run test:e2e:seeded` - seed deterministic E2E data, set seeded admin creds, then run Playwright
- `npm run prisma:generate` - generate Prisma client
- `npm run prisma:migrate` - Prisma migration (dev)
- `npm run db:push` - push Prisma schema
- `npm run db:studio` - open Prisma Studio
- `npm run verify:deploy` - pre-deploy env + DB readiness check
- `npm run verify:stripe-live -- --production` - strict Stripe account/API go-live validation
- `npm run verify:runtime -- --base-url https://your-domain` - post-deploy smoke check for auth and health endpoints
- `npm run verify:launch-qa -- --base-url https://your-domain --product-slug your-product-slug` - launch readiness QA (SEO + public pages + runtime APIs)
- `npm run verify:cutover -- --base-url https://your-domain --product-slug your-product-slug --include-auth true --confirm-db-backup true --confirm-rollback-plan true --confirm-oncall true` - full launch cutover sign-off gate
- `npm run verify:release-config -- --mode all` - validate GitHub Actions secrets/variables readiness
- `npm run seed:super-admin` - create/update super admin
- `npm run seed:e2e` - create deterministic E2E admin/customer/products

## Testing

This project now includes a `Vitest` setup for route/service/validator tests.

Run all tests:

```bash
npm run test
```

Quick runtime health check (after local run or deploy):

```bash
curl http://localhost:3000/api/health
```

Vercel production:

```bash
curl https://<your-domain>/api/health
```

Health endpoint behavior:

- `/api/health` returns **public-safe summary** (status/timestamp/response time).
- `/api/admin/health` returns **full diagnostic checks** (env/db/supabase/smtp) and requires admin session.

Run in watch mode:

```bash
npm run test:watch
```

Run with coverage:

```bash
npm run test:coverage
```

### E2E Smoke Tests (Playwright)

Install browser runtime once:

```bash
npm run test:e2e:install
```

Run smoke tests:

```bash
npm run test:e2e
```

Run with deterministic seeded data:

```bash
npm run test:e2e:seeded
```

`test:e2e:seeded` automatically uses:

- `E2E_ADMIN_EMAIL=e2e-admin@dealbazaar.test`
- `E2E_ADMIN_PASSWORD=DealBazaar@2026#E2E`

Optional env vars for authenticated admin smoke:

```env
E2E_ADMIN_EMAIL=superadmin@dealbazaar.lk
E2E_ADMIN_PASSWORD=<YOUR_SUPER_ADMIN_PASSWORD>
```

## API Request Tracing (Observability)

Core API routes now return a request correlation id in both places:

- Response header: `x-request-id`
- JSON body field: `requestId`

If your client sends `x-request-id` (or `x-correlation-id`), Deal Bazaar will reuse it when valid; otherwise the server generates one.

This helps debug production issues on Vercel quickly by matching:

1. Browser/API error response
2. Server log entry for that exact request

## Runtime Alert Webhook (Optional)

You can enable external critical alerts (Slack/Discord/Teams webhook) with:

```env
OBSERVABILITY_ALERT_WEBHOOK_URL=https://your-webhook-url
OBSERVABILITY_ALERT_COOLDOWN_SECONDS=300
```

When configured, Deal Bazaar sends alerts for:

- Health endpoint `down` state
- Unexpected failures in key APIs (auth, order creation, Stripe webhook)

Alert cooldown prevents repeated spam for the same failure fingerprint.

## Troubleshooting

- `psql is not recognized`: add PostgreSQL `bin` folder to PATH, or use full `psql.exe` path.
- `password authentication failed`: wrong DB password in `DATABASE_URL` or `DIRECT_URL`.
- `Another next dev server is already running`: stop old process.
- PowerShell npm policy issue: run commands as `cmd /c npm run <script>`.
- `Environment variable validation failed` on Vercel: set missing env vars in Vercel Project Settings and redeploy.

## Vercel Deployment Env Checklist

Add these variables in `Vercel -> Project -> Settings -> Environment Variables`:

Required for app runtime:

- `NEXT_PUBLIC_APP_URL` (your deployed URL, example `https://dealbazaar.lk`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL` (Supabase pooler, port `6543`)
- `JWT_SECRET` (minimum 32 chars)

Recommended:

- `DIRECT_URL` (for Prisma migrate/seed scripts)
- `PRISMA_USE_DIRECT_URL` (`0` recommended on Vercel production)
- `SUPABASE_STORAGE_BUCKET_PRODUCTS`
- `SUPABASE_STORAGE_BUCKET_PAYMENTS`
- `SUPABASE_STORAGE_BUCKET_BRANDING`
- `SESSION_EXPIRES_IN_DAYS`
- `CARD_PAYMENT_SESSION_TTL_MINUTES`
- SMTP vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`) for OTP and email verification.

After updating variables:

1. Trigger a fresh redeploy from Vercel dashboard.
2. Check deploy logs for `[env] Missing critical variables` warnings.
3. If `NEXT_PUBLIC_APP_URL` changes, redeploy again so client-side build picks updated public env.

## Pre-Deploy Validation

Run this before Vercel deploy (or before pushing production config):

```bash
npm run verify:deploy
```

Optional (skip DB ping):

```bash
npm run verify:deploy -- --skip-db
```

Stripe production-only validation (recommended before enabling Stripe Checkout in live mode):

```bash
npm run verify:stripe-live -- --production
```

This check validates:

- Critical environment variables
- `JWT_SECRET` minimum length
- `NEXT_PUBLIC_APP_URL` format
- Payment gateway readiness (`CARD_PAYMENT_PROVIDER`, Stripe env, production HTTPS/live-key checks)
- SMTP completeness
- Live database connectivity

## Post-Deploy Runtime Smoke Check

Run this after Vercel deployment to validate core runtime behavior:

```bash
npm run verify:runtime -- --base-url https://<your-domain>
```

Optional readiness wait (recommended right after fresh deploy):

```bash
npm run verify:runtime -- --base-url https://<your-domain> --wait-for-ready 300 --retry-interval 15
```

Checks included:

- public health endpoint summary (`/api/health`)
- login/register page availability
- checkout options availability (`/api/checkout/options`)
- unauthenticated guard on `/api/auth/me`
- admin guard on `/api/admin/health`
- invalid-credential login rejection
- auth runtime availability classification (`AUTH_CONFIG_ERROR`, `AUTH_SCHEMA_MISSING`, `AUTH_DB_CREDENTIALS_INVALID`, `AUTH_DB_UNAVAILABLE`) with request id output
- card session validation (`/api/payments/card/session`)
- card retry payload validation (`/api/payments/card/retry`)
- Stripe webhook signature guard (`/api/payments/card/stripe/webhook`)

Optional authenticated flow (login -> me -> logout):

```bash
SMOKE_LOGIN_EMAIL=superadmin@dealbazaar.lk SMOKE_LOGIN_PASSWORD=<PASSWORD> npm run verify:runtime -- --base-url https://<your-domain>
```

PowerShell:

```powershell
$env:SMOKE_LOGIN_EMAIL="superadmin@dealbazaar.lk"
$env:SMOKE_LOGIN_PASSWORD="<PASSWORD>"
npm run verify:runtime -- --base-url https://<your-domain>
```

## Launch QA Verifier

Run this before final go-live sign-off:

```bash
npm run verify:launch-qa -- --base-url https://<your-domain> --product-slug 16tb-usb-3-2-flash-drive
```

What it checks:

- Core public pages load (`/`, `/shop`, legal pages, auth pages, product details)
- Homepage metadata sanity (`title`, `description`, `og:title`, canonical, viewport, `lang`)
- Product details CTA and metadata sanity
- `robots.txt` and `sitemap.xml` availability/content
- Runtime API checks (`/api/health`, `/api/checkout/options`)
- Slow-response warnings for launch performance triage

## Automated Runtime Smoke (GitHub Actions)

Workflow file:

- `.github/workflows/runtime-smoke.yml`

How to run:

1. Go to **Actions -> Runtime Smoke Check -> Run workflow**
2. Set `base_url` to your deployed site URL
3. Optional: enable `include_auth` to run login/session/logout check

Automatic trigger:

- Runs automatically on every push to `main` when repository variable `SMOKE_BASE_URL` is configured.
- Authenticated checks on auto-push can be toggled with repository variable `SMOKE_INCLUDE_AUTH=true`.
- Deployment readiness wait defaults to `300s` with `15s` retry interval on CI (override via vars below).

Required repository configuration:

- Optional variable: `SMOKE_BASE_URL` (default URL when input is empty)
- Optional variables:
  - `SMOKE_INCLUDE_AUTH` (`true` / `false`)
  - `SMOKE_WAIT_FOR_READY_SECONDS` (for example `300`)
  - `SMOKE_RETRY_INTERVAL_SECONDS` (for example `15`)
- Optional secrets for authenticated check:
  - `SMOKE_LOGIN_EMAIL`
  - `SMOKE_LOGIN_PASSWORD`
- Optional failure alert secret:
  - `RUNTIME_SMOKE_ALERT_WEBHOOK_URL` (Slack/Discord/Teams compatible incoming webhook)

You can also trigger this workflow with `repository_dispatch` event type `runtime-smoke` and payload:

```json
{
  "event_type": "runtime-smoke",
  "client_payload": {
    "base_url": "https://your-domain",
    "include_auth": true
  }
}
```

## Quality Checks CI (GitHub Actions)

Workflow file:

- `.github/workflows/quality-checks.yml`

What it enforces on every PR/push:

- Prisma client generation
- `npm run verify:deploy -- --skip-db` for static deployment contract validation
- lint + typecheck
- production build
- unit tests
- Playwright smoke tests

This keeps core storefront/admin/auth regressions from merging.

## Release Readiness Gate (GitHub Actions)

Workflow file:

- `.github/workflows/release-readiness.yml`

How to run:

1. Go to **Actions -> Release Readiness Gate -> Run workflow**
2. Set `base_url` to your production deployment URL (or configure repository variable `RELEASE_BASE_URL`)
3. Optional:
   - `include_auth=true` to run authenticated runtime smoke
   - `run_seeded_e2e=true` to run deterministic seeded browser tests

What it validates in one run:

- `npm run verify:release-config -- --mode release` (workflow env/secret preflight)
- `npm run verify:deploy` (full production env + DB + payment gateway checks)
- `npm run verify:stripe-live -- --production` when `CARD_PAYMENT_PROVIDER=STRIPE_CHECKOUT`
- production build
- unit tests
- optional seeded E2E suite
- runtime smoke checks against deployed URL (public + optional authenticated)
- `npm run verify:launch-qa` (SEO/public-page/runtime launch sanity)

Required GitHub secrets:

- `DATABASE_URL`
- `JWT_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Recommended secrets (for full coverage):

- `SMOKE_LOGIN_EMAIL`
- `SMOKE_LOGIN_PASSWORD`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`
- `E2E_CUSTOMER_EMAIL`
- `E2E_CUSTOMER_PASSWORD`
- `STRIPE_SECRET_KEY` (if `CARD_PAYMENT_PROVIDER=STRIPE_CHECKOUT`)
- `STRIPE_WEBHOOK_SECRET` (if `CARD_PAYMENT_PROVIDER=STRIPE_CHECKOUT`)

Recommended repository variables:

- `RELEASE_BASE_URL` (default deployed production URL)
- `CARD_PAYMENT_PROVIDER` (`SANDBOX` or `STRIPE_CHECKOUT`)
- `LAUNCH_QA_PRODUCT_SLUG` (optional product slug used by launch QA)

## Launch QA Pack Workflow (GitHub Actions)

Workflow file:

- `.github/workflows/launch-qa.yml`

How to run:

1. Go to **Actions -> Launch QA Pack -> Run workflow**
2. Set `base_url` (or configure repository variable `LAUNCH_QA_BASE_URL`)
3. Optional: set `product_slug` and toggle `run_runtime_smoke`

Recommended repository variable:

- `LAUNCH_QA_BASE_URL` (default production/staging URL for QA checks)

This workflow runs `npm run verify:release-config -- --mode launch` before QA checks.

## Cutover Sign-off (Final Go-Live Gate)

Run locally:

```bash
npm run verify:cutover -- --base-url https://<your-domain> --product-slug 16tb-usb-3-2-flash-drive --include-auth true --confirm-db-backup true --confirm-rollback-plan true --confirm-oncall true
```

This executes:

1. `verify:deploy`
2. `verify:stripe-live -- --production` (when Stripe provider is active)
3. `verify:runtime`
4. `verify:launch-qa`
5. manual confirmations (backup, rollback, on-call)

GitHub workflow:

- `.github/workflows/cutover-signoff.yml`

This workflow runs `npm run verify:release-config -- --mode cutover` before cutover execution.

How to run:

1. Go to **Actions -> Cutover Sign-off -> Run workflow**
2. Set `base_url` (or configure `RELEASE_BASE_URL`)
3. Mark all confirmation toggles to `true` only after launch ops team verifies them

Runbook:

- `docs/LAUNCH_CUTOVER_RUNBOOK.md`
- `docs/GITHUB_ACTIONS_SETUP.md`

## Release Config Check Workflow (GitHub Actions)

Workflow file:

- `.github/workflows/release-config-check.yml`

How to run:

1. Go to **Actions -> Release Config Check -> Run workflow**
2. Set `mode=all`
3. Optional: set `strict=true` to treat warnings as errors

## Notes

- This project is configured for **Supabase as the primary database**.
- `DATABASE_URL` and `DIRECT_URL` must target the same Supabase project.
- `SUPABASE_SERVICE_ROLE_KEY` is required for server-side uploads.
- `database/deal_bazaar.sql` is the canonical bootstrap schema.
