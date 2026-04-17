import { z } from "zod";

const optionalText = z.string().trim().optional().or(z.literal(""));

function normalizeOptionalText(value?: string) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export const accountProfileUpdateSchema = z
  .object({
    firstName: optionalText,
    lastName: optionalText,
    phone: optionalText,
    preferredCurrency: z.string().trim().toUpperCase().length(3),
    preferredLanguage: z.enum(["en", "si"]),
    themePreference: z.enum(["system", "light", "dark"]),
  })
  .transform((value) => ({
    ...value,
    firstName: normalizeOptionalText(value.firstName),
    lastName: normalizeOptionalText(value.lastName),
    phone: normalizeOptionalText(value.phone),
  }));

export type AccountProfileUpdateInput = z.infer<typeof accountProfileUpdateSchema>;
