import { beforeEach, describe, expect, it, vi } from "vitest";
import { fail } from "@/lib/api-response";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/auth/auth-service", () => ({
  requestEmailVerification: vi.fn(),
}));

vi.mock("@/lib/security/request-security", () => ({
  enforceRateLimit: vi.fn(),
  enforceSameOriginMutation: vi.fn(),
}));

import { POST } from "@/app/api/auth/email-verification/request/route";
import { requestEmailVerification } from "@/lib/auth/auth-service";
import { enforceRateLimit, enforceSameOriginMutation } from "@/lib/security/request-security";

const mockedRequestEmailVerification = vi.mocked(requestEmailVerification);
const mockedEnforceRateLimit = vi.mocked(enforceRateLimit);
const mockedEnforceSameOriginMutation = vi.mocked(enforceSameOriginMutation);

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/email-verification/request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/email-verification/request", () => {
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
    expect(mockedRequestEmailVerification).not.toHaveBeenCalled();
  });

  it("blocks request when IP rate limit check fails", async () => {
    mockedEnforceRateLimit.mockReturnValue(
      fail("Too many requests", 429, "RATE_LIMITED"),
    );

    const response = await POST(makeRequest({ email: "user@example.com" }));

    expect(response.status).toBe(429);
    expect(mockedRequestEmailVerification).not.toHaveBeenCalled();
  });

  it("returns invalid input when email payload is malformed", async () => {
    const response = await POST(makeRequest({ email: "invalid-email" }));
    const payload = (await response.json()) as {
      success: boolean;
      code?: string;
    };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("INVALID_INPUT");
    expect(mockedRequestEmailVerification).not.toHaveBeenCalled();
  });

  it("blocks request when email-specific rate limit check fails", async () => {
    mockedEnforceRateLimit
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(fail("Too many email requests", 429, "RATE_LIMITED"));

    const response = await POST(makeRequest({ email: "USER@EXAMPLE.COM" }));

    expect(response.status).toBe(429);
    expect(mockedRequestEmailVerification).not.toHaveBeenCalled();
    expect(mockedEnforceRateLimit).toHaveBeenNthCalledWith(
      2,
      expect.any(Request),
      expect.objectContaining({
        scope: "auth:email-verification-request-email",
        keyPart: "user@example.com",
      }),
    );
  });

  it("requests email verification with normalized email", async () => {
    mockedRequestEmailVerification.mockResolvedValue({
      message: "If your email exists in our system, a verification message has been sent.",
    } as never);

    const response = await POST(makeRequest({ email: "USER@EXAMPLE.COM" }));
    const payload = (await response.json()) as {
      success: boolean;
      data?: { message?: string };
    };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data?.message).toBe(
      "If your email exists in our system, a verification message has been sent.",
    );
    expect(mockedRequestEmailVerification).toHaveBeenCalledWith(
      { email: "user@example.com" },
      expect.objectContaining({
        appUrl: expect.stringContaining("http://localhost"),
        includeDebugArtifacts: false,
      }),
    );
  });

  it("returns app error when auth service throws AppError", async () => {
    mockedRequestEmailVerification.mockRejectedValue(
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

  it("returns stable fallback error for unknown failures", async () => {
    mockedRequestEmailVerification.mockRejectedValue(new Error("Unexpected"));

    const response = await POST(makeRequest({ email: "user@example.com" }));
    const payload = (await response.json()) as {
      success: boolean;
      error?: string;
      code?: string;
    };

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe("Unable to send email verification");
    expect(payload.code).toBe("EMAIL_VERIFICATION_REQUEST_FAILED");
  });
});
