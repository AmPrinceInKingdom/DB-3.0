import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter")
  .regex(/[a-z]/, "Password must include at least one lowercase letter")
  .regex(/[0-9]/, "Password must include at least one number");

export const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(80),
  lastName: z.string().min(1, "Last name is required").max(80),
  email: z.email("A valid email is required").toLowerCase(),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.email("A valid email is required").toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.email("A valid email is required").toLowerCase(),
});

export const emailVerificationRequestSchema = z.object({
  email: z.email("A valid email is required").toLowerCase(),
});

export const emailVerificationTokenSchema = z.object({
  token: z.string().trim().min(16, "Verification token is missing").max(200, "Verification token is invalid"),
});

const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code");

export const otpVerificationRequestSchema = z.object({
  email: z.email("A valid email is required").toLowerCase(),
});

export const otpVerificationSchema = z.object({
  email: z.email("A valid email is required").toLowerCase(),
  code: otpCodeSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(16, "Reset token is missing").max(200, "Reset token is invalid"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type EmailVerificationRequestInput = z.infer<typeof emailVerificationRequestSchema>;
export type EmailVerificationTokenInput = z.infer<typeof emailVerificationTokenSchema>;
export type OtpVerificationRequestInput = z.infer<typeof otpVerificationRequestSchema>;
export type OtpVerificationInput = z.infer<typeof otpVerificationSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
