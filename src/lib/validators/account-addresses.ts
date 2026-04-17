import { z } from "zod";

const optionalText = z.string().trim().optional().or(z.literal(""));

function normalizeOptionalText(value?: string) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

const addressCoreSchema = z.object({
  label: optionalText,
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  company: optionalText,
  phone: optionalText,
  line1: z.string().trim().min(1).max(220),
  line2: optionalText,
  city: z.string().trim().min(1).max(120),
  state: optionalText,
  postalCode: optionalText,
  countryCode: z.string().trim().toUpperCase().min(2).max(2),
  isDefaultShipping: z.coerce.boolean().optional(),
  isDefaultBilling: z.coerce.boolean().optional(),
});

export const accountAddressCreateSchema = addressCoreSchema.transform((value) => ({
  ...value,
  label: normalizeOptionalText(value.label),
  company: normalizeOptionalText(value.company),
  phone: normalizeOptionalText(value.phone),
  line2: normalizeOptionalText(value.line2),
  state: normalizeOptionalText(value.state),
  postalCode: normalizeOptionalText(value.postalCode),
  isDefaultShipping: value.isDefaultShipping ?? false,
  isDefaultBilling: value.isDefaultBilling ?? false,
}));

export const accountAddressUpdateSchema = addressCoreSchema
  .partial()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one field is required",
      });
    }
  })
  .transform((value) => ({
    ...value,
    label: value.label === undefined ? undefined : normalizeOptionalText(value.label),
    company: value.company === undefined ? undefined : normalizeOptionalText(value.company),
    phone: value.phone === undefined ? undefined : normalizeOptionalText(value.phone),
    line2: value.line2 === undefined ? undefined : normalizeOptionalText(value.line2),
    state: value.state === undefined ? undefined : normalizeOptionalText(value.state),
    postalCode:
      value.postalCode === undefined ? undefined : normalizeOptionalText(value.postalCode),
    isDefaultShipping: value.isDefaultShipping ?? undefined,
    isDefaultBilling: value.isDefaultBilling ?? undefined,
  }));

export type AccountAddressCreateInput = z.infer<typeof accountAddressCreateSchema>;
export type AccountAddressUpdateInput = z.infer<typeof accountAddressUpdateSchema>;
