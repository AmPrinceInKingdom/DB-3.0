import { ReviewStatus } from "@prisma/client";
import { z } from "zod";

export const updateReviewStatusSchema = z.object({
  status: z.nativeEnum(ReviewStatus),
});

export type UpdateReviewStatusInput = z.infer<typeof updateReviewStatusSchema>;
