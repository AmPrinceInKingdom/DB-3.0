import { beforeEach, describe, expect, it, vi } from "vitest";
import { fail } from "@/lib/api-response";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/auth/auth-service", () => ({
  requestEmailVerificationOtp: vi.fn(),
}));

vi.mock("@/lib/security/request-security", () => ({
  enforceRateLimit: vi.fn(),
  enforceSameOriginMutation: vi.fn(),
}));

import { POST } from "@/app/api/auth/otp-verification/request/route";
import { requestEmailVerificationOtp } from "@/lib/auth/auth-service";
import { enforceRateLimit, enforceSameOriginMutation } from "@/lib/security/request-security";

const mockedRequestEmailVerificationOtp = vi.mocked(requestEmailVerificationOtp);
const mockedEnforceRateLimit = vi.mocked(enforceRateLimit);
const mockedEnforceSameOriginMutation = vi.mocked(enforceSameOriginMutation);

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/otp-verification/request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/otp-verification/request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedEnforceSameOriginMutation.mockReturnValue(null);
    mockedEnforceRateLimit.mockReturnValue(null);
  });

  it("blocks request when same-origin check fails", async () => {
    mockedEnforceSameOriginMutation.mockReturnValue(
      fail("Origin not allowed", 403, "ORIGIN_FORBIDDEN"),
    );

    const response = await POST(makeRequest({ email: "user@example.com" }));
    expect(response.status).toBe(403);
    expect(mockedRequestEmailVerificationOtp).not.toHaveBeenCalled();
  });

  it("blocks request when ip rate limit check fails", async () => {
    mockedEnforceRateLimit.mockReturnValue(
      fail("Too many requests", 429, "RATE_LIMITED"),
    );

    const response = await POST(makeRequest({ email: "user@example.com" }));
    expect(response.status).toBe(429);
    expect(mockedRequestEmailVerificationOtp).not.toHaveBeenCalled();
  });

  it("blocks request when email rate limit check fails", async () => {
    mockedEnforceRateLimit
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(fail("Too many email requests", 429, "RATE_LIMITED"));

    const response = await POST(makeRequest({ email: "USER@EXAMPLE.COM" }));
    expect(response.status).toBe(429);
    expect(mockedRequestEmailVerificationOtp).not.toHaveBeenCalled();
  });

  it("sends OTP request without exposing debug otp payload", async () => {
    mockedRequestEmailVerificationOtp.mockResolvedValue({
      message: "A verification code has been sent.",
      debugOtpCode: "123456",
      otpExpiresAt: "2026-01-01T00:10:00.000Z",
    } as never);

    const response = await POST(makeRequest({ email: "USER@EXAMPLE.COM" }));
    const payload = (await response.json()) as {
      success: boolean;
      data?: {
        message?: string;
        otpExpiresAt?: string;
        debugOtpCode?: string;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data?.message).toBe("A verification code has been sent.");
    expect(payload.data?.otpExpiresAt).toBe("2026-01-01T00:10:00.000Z");
    expect(payload.data?.debugOtpCode).toBeUndefined();
    expect(mockedRequestEmailVerificationOtp).toHaveBeenCalledWith(
      { email: "user@example.com" },
      { includeDebugArtifacts: false },
    );
    expect(mockedEnforceRateLimit).toHaveBeenNthCalledWith(
      2,
      expect.any(Request),
      expect.objectContaining({
        scope: "auth:otp-request-email",
        keyPart: "user@example.com",
      }),
    );
  });

  it("returns app error when auth service throws AppError", async () => {
    mockedRequestEmailVerificationOtp.mockRejectedValue(
      new AppError("Email already verified", 400, "EMAIL_ALREADY_VERIFIED"),
    );

    const response = await POST(makeRequest({ email: "user@example.com" }));
    const payload = (await response.json()) as {
      success: boolean;
      error?: string;
      code?: string;
    };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe("Email already verified");
    expect(payload.code).toBe("EMAIL_ALREADY_VERIFIED");
  });
});
