import { describe, expect, it } from "vitest";
import { registerSchema, resetPasswordSchema } from "@/lib/validators/auth";

describe("auth validators", () => {
  it("normalizes register email to lowercase", () => {
    const parsed = registerSchema.parse({
      firstName: "Deal",
      lastName: "Bazaar",
      email: "USER@EXAMPLE.COM",
      password: "StrongPass123",
    });

    expect(parsed.email).toBe("user@example.com");
  });

  it("rejects weak passwords", () => {
    const result = registerSchema.safeParse({
      firstName: "Deal",
      lastName: "Bazaar",
      email: "user@example.com",
      password: "alllowercase123",
    });

    expect(result.success).toBe(false);
  });

  it("rejects reset password mismatch", () => {
    const result = resetPasswordSchema.safeParse({
      token: "1234567890abcdef1234567890abcdef",
      password: "StrongPass123",
      confirmPassword: "StrongPass124",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword?.[0]).toBe("Passwords do not match");
    }
  });
});

