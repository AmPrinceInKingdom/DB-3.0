import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fail } from "@/lib/api-response";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/auth/auth-service", () => ({
  verifyEmailWithToken: vi.fn(),
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

import { POST } from "@/app/api/auth/email-verification/verify/route";
import { verifyEmailWithToken } from "@/lib/auth/auth-service";
import { setSessionCookie } from "@/lib/auth/session";
import {
  clearFailedVerificationAttempts,
  enforceFailureLock,
  enforceRateLimit,
  enforceSameOriginMutation,
  getRequestIp,
  recordFailedVerificationAttempt,
} from "@/lib/security/request-security";

const mockedVerifyEmailWithToken = vi.mocked(verifyEmailWithToken);
const mockedSetSessionCookie = vi.mocked(setSessionCookie);
const mockedClearFailedVerificationAttempts = vi.mocked(clearFailedVerificationAttempts);
const mockedEnforceFailureLock = vi.mocked(enforceFailureLock);
const mockedEnforceRateLimit = vi.mocked(enforceRateLimit);
const mockedEnforceSameOriginMutation = vi.mocked(enforceSameOriginMutation);
const mockedGetRequestIp = vi.mocked(getRequestIp);
const mockedRecordFailedVerificationAttempt = vi.mocked(recordFailedVerificationAttempt);

const validToken = "1234567890abcdef1234567890abcdef";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/email-verification/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function buildFailureIdentity(token: string, ip: string) {
  const tokenFingerprint = createHash("sha256").update(token).digest("hex").slice(0, 24);
  return `${tokenFingerprint}:${ip}`;
}

describe("POST /api/auth/email-verification/verify", () => {
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

    const response = await POST(makeRequest({ token: validToken }));

    expect(response.status).toBe(403);
    expect(mockedVerifyEmailWithToken).not.toHaveBeenCalled();
  });

  it("blocks request when rate limit check fails", async () => {
    mockedEnforceRateLimit.mockReturnValue(
      fail("Too many requests", 429, "RATE_LIMITED"),
    );

    const response = await POST(makeRequest({ token: validToken }));

    expect(response.status).toBe(429);
    expect(mockedVerifyEmailWithToken).not.toHaveBeenCalled();
  });

  it("returns invalid input when token payload is malformed", async () => {
    const response = await POST(makeRequest({ token: "short" }));
    const payload = (await response.json()) as {
      success: boolean;
      code?: string;
    };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("INVALID_INPUT");
    expect(mockedEnforceFailureLock).not.toHaveBeenCalled();
    expect(mockedVerifyEmailWithToken).not.toHaveBeenCalled();
  });

  it("blocks request when email token lock is active", async () => {
    mockedEnforceFailureLock.mockReturnValue(
      fail("Too many invalid verification attempts", 429, "EMAIL_VERIFICATION_LOCKED"),
    );

    const response = await POST(makeRequest({ token: validToken }));
    const payload = (await response.json()) as {
      success: boolean;
      code?: string;
    };

    expect(response.status).toBe(429);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("EMAIL_VERIFICATION_LOCKED");
    expect(mockedVerifyEmailWithToken).not.toHaveBeenCalled();
  });

  it("verifies token, sets session cookie, and clears failure lock", async () => {
    mockedVerifyEmailWithToken.mockResolvedValue({
      token: "session-token",
      user: {
        id: "user-1",
        email: "user@example.com",
        role: "CUSTOMER",
        firstName: "Deal",
        lastName: "Bazaar",
        emailVerifiedAt: new Date().toISOString(),
      },
      message: "Email verified successfully.",
    } as never);

    const response = await POST(makeRequest({ token: validToken }));
    const payload = (await response.json()) as {
      success: boolean;
      data?: {
        message?: string;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data?.message).toBe("Email verified successfully.");
    expect(mockedVerifyEmailWithToken).toHaveBeenCalledWith({ token: validToken });
    expect(mockedSetSessionCookie).toHaveBeenCalledTimes(1);
    expect(mockedSetSessionCookie).toHaveBeenCalledWith(expect.any(Response), "session-token");
    expect(mockedClearFailedVerificationAttempts).toHaveBeenCalledWith(
      "auth:email-token-verify-failure",
      buildFailureIdentity(validToken, "127.0.0.1"),
    );
  });

  it("tracks invalid token attempts with remaining attempts", async () => {
    mockedVerifyEmailWithToken.mockRejectedValue(
      new AppError(
        "This verification link is invalid or expired. Please request a new one.",
        400,
        "EMAIL_VERIFICATION_TOKEN_INVALID",
      ),
    );
    mockedRecordFailedVerificationAttempt.mockReturnValue({
      locked: false,
      remainingAttempts: 4,
    });

    const response = await POST(makeRequest({ token: validToken }));
    const payload = (await response.json()) as {
      success: boolean;
      error?: string;
      code?: string;
    };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("EMAIL_VERIFICATION_TOKEN_INVALID");
    expect(payload.error).toContain("4 attempts remaining");
    expect(mockedRecordFailedVerificationAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "auth:email-token-verify-failure",
        identity: buildFailureIdentity(validToken, "127.0.0.1"),
      }),
    );
  });

  it("locks verification after too many invalid token attempts", async () => {
    mockedVerifyEmailWithToken.mockRejectedValue(
      new AppError(
        "This verification link is invalid or expired. Please request a new one.",
        400,
        "EMAIL_VERIFICATION_TOKEN_INVALID",
      ),
    );
    mockedRecordFailedVerificationAttempt.mockReturnValue({
      locked: true,
      remainingAttempts: 0,
      retryAfterSeconds: 900,
    });

    const response = await POST(makeRequest({ token: validToken }));
    const payload = (await response.json()) as {
      success: boolean;
      error?: string;
      code?: string;
    };

    expect(response.status).toBe(429);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("EMAIL_VERIFICATION_LOCKED");
    expect(payload.error).toBe(
      "Too many invalid verification attempts. Please request a fresh verification link.",
    );
  });

  it("returns app error when auth service throws non-token AppError", async () => {
    mockedVerifyEmailWithToken.mockRejectedValue(
      new AppError("This account is not active.", 403, "ACCOUNT_NOT_ACTIVE"),
    );

    const response = await POST(makeRequest({ token: validToken }));
    const payload = (await response.json()) as {
      success: boolean;
      error?: string;
      code?: string;
    };

    expect(response.status).toBe(403);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe("This account is not active.");
    expect(payload.code).toBe("ACCOUNT_NOT_ACTIVE");
    expect(mockedRecordFailedVerificationAttempt).not.toHaveBeenCalled();
  });

  it("returns stable fallback error for unknown failures", async () => {
    mockedVerifyEmailWithToken.mockRejectedValue(new Error("Unexpected"));

    const response = await POST(makeRequest({ token: validToken }));
    const payload = (await response.json()) as {
      success: boolean;
      error?: string;
      code?: string;
    };

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe("Unable to verify email");
    expect(payload.code).toBe("EMAIL_VERIFICATION_FAILED");
  });
});
