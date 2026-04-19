import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetObservabilityAlertStateForTest,
  sendObservabilityAlert,
} from "@/lib/observability/alerting";

const originalEnv = { ...process.env };

describe("observability alerting", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    resetObservabilityAlertStateForTest();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetObservabilityAlertStateForTest();
  });

  it("returns NOT_CONFIGURED when webhook env is missing", async () => {
    delete process.env.OBSERVABILITY_ALERT_WEBHOOK_URL;

    const result = await sendObservabilityAlert({
      scope: "api.orders",
      severity: "critical",
      title: "Order route failure",
      message: "Unable to create order",
      requestId: "req-1",
    });

    expect(result).toEqual({
      sent: false,
      reason: "NOT_CONFIGURED",
    });
  });

  it("sends alert payload to webhook when configured", async () => {
    process.env.OBSERVABILITY_ALERT_WEBHOOK_URL = "https://example.com/alerts";
    process.env.OBSERVABILITY_ALERT_COOLDOWN_SECONDS = "60";

    const fetchSpy = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await sendObservabilityAlert({
      scope: "api.auth.login",
      severity: "warning",
      title: "Unexpected login error",
      message: "Unhandled exception in login route",
      requestId: "req-login-123",
      metadata: {
        module: "auth",
      },
    });

    expect(result).toEqual({ sent: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.com/alerts",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("deduplicates alerts during cooldown window", async () => {
    process.env.OBSERVABILITY_ALERT_WEBHOOK_URL = "https://example.com/alerts";
    process.env.OBSERVABILITY_ALERT_COOLDOWN_SECONDS = "120";

    const fetchSpy = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const first = await sendObservabilityAlert({
      scope: "api.health",
      severity: "critical",
      title: "Health down",
      message: "Database connection failed",
      fingerprint: "health-down-db",
      requestId: "req-health-1",
    });
    const second = await sendObservabilityAlert({
      scope: "api.health",
      severity: "critical",
      title: "Health down",
      message: "Database connection failed",
      fingerprint: "health-down-db",
      requestId: "req-health-2",
    });

    expect(first).toEqual({ sent: true });
    expect(second).toEqual({
      sent: false,
      reason: "COOLDOWN_ACTIVE",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
