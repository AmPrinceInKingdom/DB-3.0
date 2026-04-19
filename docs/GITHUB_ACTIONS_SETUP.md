# GitHub Actions Setup Matrix (Deal Bazaar)

Use this guide to configure GitHub repository variables and secrets before running launch workflows.

## Workflows

1. `release-config-check.yml`
2. `release-readiness.yml`
3. `launch-qa.yml`
4. `cutover-signoff.yml`

## Required Repository Variables

| Variable | Required For | Example |
|---|---|---|
| `RELEASE_BASE_URL` | release-readiness, cutover-signoff | `https://dealbazaar.lk` |
| `LAUNCH_QA_BASE_URL` | launch-qa | `https://dealbazaar.lk` |
| `CARD_PAYMENT_PROVIDER` | release-readiness, cutover-signoff | `SANDBOX` or `STRIPE_CHECKOUT` |
| `LAUNCH_QA_PRODUCT_SLUG` | release-readiness, launch-qa, cutover-signoff | `16tb-usb-3-2-flash-drive` |

## Required Repository Secrets

| Secret | Required For |
|---|---|
| `DATABASE_URL` | release-readiness, cutover-signoff |
| `JWT_SECRET` | release-readiness, cutover-signoff |
| `NEXT_PUBLIC_SUPABASE_URL` | release-readiness, cutover-signoff |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | release-readiness, cutover-signoff |
| `SUPABASE_SERVICE_ROLE_KEY` | release-readiness, cutover-signoff |

## Stripe Secrets (only when Stripe provider is active)

| Secret | Required When |
|---|---|
| `STRIPE_SECRET_KEY` | `CARD_PAYMENT_PROVIDER=STRIPE_CHECKOUT` |
| `STRIPE_WEBHOOK_SECRET` | `CARD_PAYMENT_PROVIDER=STRIPE_CHECKOUT` |

## Optional but Recommended Secrets

| Secret | Purpose |
|---|---|
| `SMOKE_LOGIN_EMAIL` | authenticated runtime smoke check |
| `SMOKE_LOGIN_PASSWORD` | authenticated runtime smoke check |
| `E2E_ADMIN_EMAIL` | seeded E2E/admin test coverage |
| `E2E_ADMIN_PASSWORD` | seeded E2E/admin test coverage |
| `E2E_CUSTOMER_EMAIL` | seeded E2E/customer test coverage |
| `E2E_CUSTOMER_PASSWORD` | seeded E2E/customer test coverage |

## Recommended Execution Order

1. Run **Release Config Check** (`mode=all`).
2. Run **Release Readiness Gate**.
3. Run **Launch QA Pack**.
4. Run **Cutover Sign-off** with all confirmations set to `true`.

## Quick Validation Command (local)

```bash
npm run verify:release-config -- --mode all
```

Strict mode:

```bash
npm run verify:release-config -- --mode all --strict true
```
