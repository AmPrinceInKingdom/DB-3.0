import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    NEXT_PUBLIC_APP_URL: z.url().optional(),
    NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    SUPABASE_STORAGE_BUCKET_PRODUCTS: z.string().min(1).default("deal-bazaar-products"),
    SUPABASE_STORAGE_BUCKET_PAYMENTS: z.string().min(1).default("deal-bazaar-payment-proofs"),
    SUPABASE_STORAGE_BUCKET_BRANDING: z.string().min(1).default("deal-bazaar-branding"),
    DATABASE_URL: z.string().min(1).optional(),
    DIRECT_URL: z.string().min(1).optional(),
    JWT_SECRET: z.string().min(32).optional(),
    SESSION_EXPIRES_IN_DAYS: z.coerce.number().int().min(1).max(60).default(7),
    CARD_PAYMENT_SESSION_TTL_MINUTES: z.coerce.number().int().min(5).max(120).default(30),
  });

const parsed = envSchema.safeParse(process.env);

function resolveAppUrl(nodeEnv: "development" | "test" | "production") {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured;

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  // Keep local/dev environment bootable even when env is partially configured.
  if (nodeEnv === "production") {
    return "https://localhost";
  }
  return "http://localhost:3000";
}

if (!parsed.success) {
  console.warn(
    "Environment variable validation had issues. Continuing with safe defaults where possible.",
    parsed.error.flatten().fieldErrors,
  );
}

const data = parsed.success
  ? parsed.data
  : {
      NODE_ENV: (process.env.NODE_ENV as "development" | "test" | "production" | undefined) ?? "development",
      NEXT_PUBLIC_APP_URL: undefined,
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      SUPABASE_STORAGE_BUCKET_PRODUCTS: "deal-bazaar-products",
      SUPABASE_STORAGE_BUCKET_PAYMENTS: "deal-bazaar-payment-proofs",
      SUPABASE_STORAGE_BUCKET_BRANDING: "deal-bazaar-branding",
      DATABASE_URL: undefined,
      DIRECT_URL: undefined,
      JWT_SECRET: undefined,
      SESSION_EXPIRES_IN_DAYS: 7,
      CARD_PAYMENT_SESSION_TTL_MINUTES: 30,
    };

export const env = {
  ...data,
  NEXT_PUBLIC_APP_URL: resolveAppUrl(data.NODE_ENV),
};

const criticalEnvKeys = [
  "DATABASE_URL",
  "JWT_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

if (env.NODE_ENV === "production") {
  const missingCritical = criticalEnvKeys.filter((key) => !env[key]);
  if (missingCritical.length > 0) {
    console.warn(
      `[env] Missing critical variables: ${missingCritical.join(", ")}. Some features may not work until these are set.`,
    );
  }
}
