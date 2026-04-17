import { z } from "zod";

const optionalText = z.string().trim().optional().or(z.literal(""));

function normalizeOptionalText(value?: string) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

const reviewWritableFields = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  title: optionalText,
  comment: optionalText,
});

export const createAccountReviewSchema = z
  .object({
    orderItemId: z.string().uuid(),
  })
  .and(reviewWritableFields)
  .transform((value) => ({
    ...value,
    title: normalizeOptionalText(value.title),
    comment: normalizeOptionalText(value.comment),
  }));

export const updateAccountReviewSchema = reviewWritableFields
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
    title: value.title === undefined ? undefined : normalizeOptionalText(value.title),
    comment: value.comment === undefined ? undefined : normalizeOptionalText(value.comment),
  }));

export type CreateAccountReviewInput = z.infer<typeof createAccountReviewSchema>;
export type UpdateAccountReviewInput = z.infer<typeof updateAccountReviewSchema>;
