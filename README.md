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
```

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
- `npm run prisma:generate` - generate Prisma client
- `npm run prisma:migrate` - Prisma migration (dev)
- `npm run db:push` - push Prisma schema
- `npm run db:studio` - open Prisma Studio
- `npm run seed:super-admin` - create/update super admin

## Testing

This project now includes a `Vitest` setup for route/service/validator tests.

Run all tests:

```bash
npm run test
```

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

Optional env vars for authenticated admin smoke:

```env
E2E_ADMIN_EMAIL=superadmin@dealbazaar.lk
E2E_ADMIN_PASSWORD=<YOUR_SUPER_ADMIN_PASSWORD>
```

## Troubleshooting

- `psql is not recognized`: add PostgreSQL `bin` folder to PATH, or use full `psql.exe` path.
- `password authentication failed`: wrong DB password in `DATABASE_URL` or `DIRECT_URL`.
- `Another next dev server is already running`: stop old process.
- PowerShell npm policy issue: run commands as `cmd /c npm run <script>`.

## Notes

- This project is configured for **Supabase as the primary database**.
- `DATABASE_URL` and `DIRECT_URL` must target the same Supabase project.
- `SUPABASE_SERVICE_ROLE_KEY` is required for server-side uploads.
- `database/deal_bazaar.sql` is the canonical bootstrap schema.
