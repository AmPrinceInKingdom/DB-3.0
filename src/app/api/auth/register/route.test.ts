import { beforeEach, describe, expect, it, vi } from "vitest";
import { fail } from "@/lib/api-response";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/auth/auth-service", () => ({
  registerUser: vi.fn(),
}));

vi.mock("@/lib/security/request-security", () => ({
  enforceRateLimit: vi.fn(),
  enforceSameOriginMutation: vi.fn(),
}));

import { POST } from "@/app/api/auth/register/route";
import { registerUser } from "@/lib/auth/auth-service";
import { enforceRateLimit, enforceSameOriginMutation } from "@/lib/security/request-security";

const mockedRegisterUser = vi.mocked(registerUser);
const mockedEnforceRateLimit = vi.mocked(enforceRateLimit);
const mockedEnforceSameOriginMutation = vi.mocked(enforceSameOriginMutation);

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedEnforceSameOriginMutation.mockReturnValue(null);
    mockedEnforceRateLimit.mockReturnValue(null);
  });

  it("blocks request when same-origin check fails", async () => {
    mockedEnforceSameOriginMutation.mockReturnValue(fail("Origin not allowed", 403, "ORIGIN_FORBIDDEN"));

    const response = await POST(
      makeRequest({
        firstName: "Deal",
        lastName: "Bazaar",
        email: "user@example.com",
        password: "StrongPass123",
      }),
    );

    expect(response.status).toBe(403);
    expect(mockedRegisterUser).not.toHaveBeenCalled();
  });

  it("creates account when payload is valid", async () => {
    mockedRegisterUser.mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com",
        role: "CUSTOMER",
      },
      requiresEmailVerification: true,
      message: "Account created. Please verify your email to continue.",
    } as never);

    const response = await POST(
      makeRequest({
        firstName: "Deal",
        lastName: "Bazaar",
        email: "user@example.com",
        password: "StrongPass123",
      }),
    );
    const payload = (await response.json()) as {
      success: boolean;
      data?: { requiresEmailVerification?: boolean };
    };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data?.requiresEmailVerification).toBe(true);
  });

  it("passes through AppError details", async () => {
    mockedRegisterUser.mockRejectedValue(
      new AppError("An account with this email already exists", 409, "EMAIL_EXISTS"),
    );

    const response = await POST(
      makeRequest({
        firstName: "Deal",
        lastName: "Bazaar",
        email: "user@example.com",
        password: "StrongPass123",
      }),
    );
    const payload = (await response.json()) as {
      success: boolean;
      error?: string;
      code?: string;
    };

    expect(response.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("EMAIL_EXISTS");
  });

  it("returns service-unavailable error when database is unavailable", async () => {
    mockedRegisterUser.mockRejectedValue(
      new Error("Prisma: Can't reach database server at db.example.supabase.co:5432"),
    );

    const response = await POST(
      makeRequest({
        firstName: "Deal",
        lastName: "Bazaar",
        email: "user@example.com",
        password: "StrongPass123",
      }),
    );
    const payload = (await response.json()) as {
      success: boolean;
      error?: string;
      code?: string;
    };

    expect(response.status).toBe(503);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("AUTH_DB_UNAVAILABLE");
  });
});
