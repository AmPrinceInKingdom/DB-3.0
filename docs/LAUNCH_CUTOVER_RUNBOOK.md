# Deal Bazaar Launch Cutover Runbook

This runbook is the final production launch checklist for Deal Bazaar.

## 1. Pre-Launch (T-24 to T-2 hours)

1. Freeze non-critical code changes.
2. Confirm production environment variables are updated in Vercel.
3. Confirm Supabase database backup is taken.
4. Confirm Stripe live credentials and webhook secret are configured (if `CARD_PAYMENT_PROVIDER=STRIPE_CHECKOUT`).
5. Confirm launch owner and on-call engineer are assigned.

## 2. Automated Sign-off

Run one command locally:

```bash
npm run verify:cutover -- --base-url https://<your-production-domain> --product-slug 16tb-usb-3-2-flash-drive --include-auth true --confirm-db-backup true --confirm-rollback-plan true --confirm-oncall true
```

Or run GitHub workflow:

- Workflow: `.github/workflows/cutover-signoff.yml`
- Actions -> **Cutover Sign-off** -> Run workflow

The sign-off executes:

1. `verify:deploy`
2. `verify:stripe-live -- --production` (only when Stripe provider is active)
3. `verify:runtime`
4. `verify:launch-qa`
5. Manual confirmations:
   - DB backup
   - rollback plan
   - on-call assignment

## 3. Launch Window (T-0)

1. Trigger Vercel production deployment.
2. Wait until deployment reports healthy.
3. Run **Release Readiness Gate** workflow.
4. Run **Cutover Sign-off** workflow.
5. Verify:
   - homepage loads
   - product details and add-to-cart
   - checkout options load
   - admin dashboard load

## 4. Post-Launch (T+15 to T+60 min)

1. Watch errors in Vercel logs and runtime smoke results.
2. Verify incoming orders and payment status updates.
3. Verify email OTP and verification flow.
4. Verify Stripe webhook events are being processed (if Stripe enabled).

## 5. Rollback Plan

Rollback immediately if any of these happen:

1. login/register is broken on production
2. checkout cannot create orders
3. payment confirmation path fails for all users
4. critical API error rates spike

Rollback actions:

1. Promote previous stable Vercel deployment.
2. Keep database schema as-is (avoid destructive rollback migrations during incident).
3. Re-run `verify:runtime` and `verify:launch-qa` against rolled-back deployment.
4. Announce status to support/ops channel.

## 6. Launch Completion Criteria

Launch is complete only when all are true:

1. Release Readiness Gate passes.
2. Cutover Sign-off passes.
3. No critical errors in first 30 minutes.
4. First successful real order is observed end-to-end.
