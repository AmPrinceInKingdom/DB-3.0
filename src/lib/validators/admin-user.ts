import { AccountStatus, UserRole } from "@prisma/client";
import { z } from "zod";

export const updateAdminUserSchema = z
  .object({
    role: z.nativeEnum(UserRole).optional(),
    status: z.nativeEnum(AccountStatus).optional(),
  })
  .refine((value) => value.role !== undefined || value.status !== undefined, {
    message: "Provide at least one field to update",
  });

export type UpdateAdminUserInput = z.infer<typeof updateAdminUserSchema>;

export const adminUserVerificationActionSchema = z.object({
  action: z.enum(["RESEND_EMAIL_LINK", "RESEND_OTP", "REVOKE_PENDING"]),
});

export type AdminUserVerificationActionInput = z.infer<
  typeof adminUserVerificationActionSchema
>;
