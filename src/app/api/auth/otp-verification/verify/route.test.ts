import { beforeEach, describe, expect, it, vi } from "vitest";
import { fail } from "@/lib/api-response";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/auth/auth-service", () => ({
  verifyEmailWithOtp: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  setSessionCookie: vi.fn(),
}));

vi.mock("@/lib/security/request-security", () => ({
  clearFailedVerificationAttempts: vi.fn(),
  enforceFailureLock: vi.fn(),
  enforceRateLimit: vi.fn(),
  enforceSameOriginMutation: vi.fn(),
  getRequestIp: vi.fn(),
  recordFailedVerificationAttempt: vi.fn(),
}));

import { POST } from "@/app/api/auth/otp-verification/verify/route";
import { verifyEmailWithOtp } from "@/lib/auth/auth-service";
import { setSessionCookie } from "@/lib/auth/session";
import {
  clearFailedVerificationAttempts,
  enforceFailureLock,
  enforceRateLimit,
  enforceSameOriginMutation,
  getRequestIp,
  recordFailedVerificationAttempt,
} from "@/lib/security/request-security";

const mockedVerifyEmailWithOtp = vi.mocked(verifyEmailWithOtp);
const mockedSetSessionCookie = vi.mocked(setSessionCookie);
const mockedClearFailedVerificationAttempts = vi.mocked(clearFailedVerificationAttempts);
const mockedEnforceFailureLock = vi.mocked(enforceFailureLock);
const mockedEnforceRateLimit = vi.mocked(enforceRateLimit);
const mockedEnforceSameOriginMutation = vi.mocked(enforceSameOriginMutation);
const mockedGetRequestIp = vi.mocked(getRequestIp);
const mockedRecordFailedVerificationAttempt = vi.mocked(recordFailedVerificationAttempt);

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/otp-verification/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/otp-verification/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedEnforceSameOriginMutation.mockReturnValue(null);
    mockedEnforceRateLimit.mockReturnValue(null);
    mockedEnforceFailureLock.mockReturnValue(null);
    mockedGetRequestIp.mockReturnValue("127.0.0.1");
  });

  it("blocks request when same-origin check fails", async () => {
    mockedEnforceSameOriginMutation.mockReturnValue(
      fail("Origin not allowed", 403, "ORIGIN_FORBIDDEN"),
    );

    const response = await POST(
      makeRequest({
        email: "user@example.com",
        code: "123456",
      }),
    );

    expect(response.status).toBe(403);
    expect(mockedVerifyEmailWithOtp).not.toHaveBeenCalled();
  });

  it("returns lock response before verification when identity is locked", async () => {
    mockedEnforceFailureLock.mockReturnValue(
      fail("Too many invalid attempts. Try again in 600 seconds.", 429, "OTP_LOCKED"),
    );

    const response = await POST(
      makeRequest({
        email: "user@example.com",
        code: "123456",
      }),
    );
    const payload = (await response.json()) as { success: boolean; code?: string };

    expect(response.status).toBe(429);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("OTP_LOCKED");
    expect(mockedVerifyEmailWithOtp).not.toHaveBeenCalled();
  });

  it("verifies OTP, sets session cookie, and clears failed attempts", async () => {
    mockedVerifyEmailWithOtp.mockResolvedValue({
      token: "session-token",
      user: {
        id: "user-1",
        email: "user@example.com",
        role: "CUSTOMER",
        firstName: "Demo",
        lastName: "User",
        emailVerifiedAt: new Date().toISOString(),
      },
      message: "OTP verified successfully.",
    } as never);

    const response = await POST(
      makeRequest({
        email: "USER@EXAMPLE.COM",
        code: "123456",
      }),
    );
    const payload = (await response.json()) as {
      success: boolean;
      data?: { message: string };
    };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data?.message).toBe("OTP verified successfully.");
    expect(mockedVerifyEmailWithOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      code: "123456",
    });
    expect(mockedSetSessionCookie).toHaveBeenCalledTimes(1);
    expect(mockedSetSessionCookie).toHaveBeenCalledWith(expect.any(Response), "session-token");
    expect(mockedClearFailedVerificationAttempts).toHaveBeenCalledWith(
      "auth:otp-verify-failure",
      "user@example.com:127.0.0.1",
    );
  });

  it("increments failure tracker and returns remaining attempts on invalid OTP", async () => {
    mockedVerifyEmailWithOtp.mockRejectedValue(
      new AppError("Invalid or expired OTP code.", 400, "OTP_INVALID"),
    );
    mockedRecordFailedVerificationAttempt.mockReturnValue({
      locked: false,
      remainingAttempts: 3,
    });

    const response = await POST(
      makeRequest({
        email: "user@example.com",
        code: "000000",
      }),
    );
    const payload = (await response.json()) as {
      success: boolean;
      error?: string;
      code?: string;
    };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("OTP_INVALID");
    expect(payload.error).toContain("3 attempts remaining");
    expect(mockedRecordFailedVerificationAttempt).toHaveBeenCalledTimes(1);
  });

  it("locks OTP verification after max invalid attempts", async () => {
    mockedVerifyEmailWithOtp.mockRejectedValue(
      new AppError("Invalid or expired OTP code.", 400, "OTP_INVALID"),
    );
    mockedRecordFailedVerificationAttempt.mockReturnValue({
      locked: true,
      remainingAttempts: 0,
      retryAfterSeconds: 600,
    });

    const response = await POST(
      makeRequest({
        email: "user@example.com",
        code: "000000",
      }),
    );
    const payload = (await response.json()) as {
      success: boolean;
      error?: string;
      code?: string;
    };

    expect(response.status).toBe(429);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("OTP_LOCKED");
    expect(payload.error).toContain("600 seconds");
  });
});
