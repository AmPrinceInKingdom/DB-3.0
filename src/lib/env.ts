import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    NEXT_PUBLIC_APP_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
    SUPABASE_STORAGE_BUCKET_PRODUCTS: z.string().min(1).default("deal-bazaar-products"),
    SUPABASE_STORAGE_BUCKET_PAYMENTS: z.string().min(1).default("deal-bazaar-payment-proofs"),
    SUPABASE_STORAGE_BUCKET_BRANDING: z.string().min(1).default("deal-bazaar-branding"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    DIRECT_URL: z.string().min(1, "DIRECT_URL is required"),
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    SESSION_EXPIRES_IN_DAYS: z.coerce.number().int().min(1).max(60).default(7),
    CARD_PAYMENT_SESSION_TTL_MINUTES: z.coerce.number().int().min(5).max(120).default(30),
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  throw new Error("Environment variable validation failed");
}

export const env = parsed.data;
