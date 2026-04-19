type AlertSeverity = "info" | "warning" | "critical";

type SendObservabilityAlertInput = {
  scope: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  requestId?: string;
  fingerprint?: string;
  metadata?: Record<string, unknown>;
};

type SendObservabilityAlertResult =
  | { sent: true }
  | {
      sent: false;
      reason: "NOT_CONFIGURED" | "COOLDOWN_ACTIVE" | "WEBHOOK_REJECTED" | "NETWORK_ERROR";
    };

type AlertDedupStore = Map<string, number>;

const defaultAlertCooldownSeconds = 300;
const maxAlertStoreSize = 10_000;
const dedupPattern = /^[A-Za-z0-9._:-]{4,200}$/;

const globalAlertState = globalThis as typeof globalThis & {
  __dealBazaarObservabilityAlertDedupStore?: AlertDedupStore;
};

const alertDedupStore: AlertDedupStore =
  globalAlertState.__dealBazaarObservabilityAlertDedupStore ?? new Map<string, number>();

if (!globalAlertState.__dealBazaarObservabilityAlertDedupStore) {
  globalAlertState.__dealBazaarObservabilityAlertDedupStore = alertDedupStore;
}

function parseCooldownSeconds(value: string | undefined) {
  const parsed = Number(value ?? defaultAlertCooldownSeconds);
  if (!Number.isFinite(parsed)) return defaultAlertCooldownSeconds;
  return Math.min(86_400, Math.max(10, Math.floor(parsed)));
}

function normalizeWebhookUrl() {
  const raw = process.env.OBSERVABILITY_ALERT_WEBHOOK_URL?.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) return null;
  return raw;
}

function normalizeDedupPart(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "-");
  if (!normalized || !dedupPattern.test(normalized)) {
    return "generic";
  }
  return normalized;
}

function cleanExpiredAlertEntries(now: number) {
  if (alertDedupStore.size < maxAlertStoreSize) return;

  for (const [key, expiresAt] of alertDedupStore.entries()) {
    if (expiresAt <= now) {
      alertDedupStore.delete(key);
    }
  }
}

function buildDedupKey(input: SendObservabilityAlertInput) {
  const scope = normalizeDedupPart(input.scope);
  const fingerprint = normalizeDedupPart(input.fingerprint ?? input.title);
  return `${scope}:${fingerprint}`;
}

function isCooldownActive(key: string, now: number) {
  const existing = alertDedupStore.get(key);
  if (!existing) return false;

  if (existing <= now) {
    alertDedupStore.delete(key);
    return false;
  }

  return true;
}

function rememberAlert(key: string, now: number, cooldownSeconds: number) {
  alertDedupStore.set(key, now + cooldownSeconds * 1000);
}

export async function sendObservabilityAlert(
  input: SendObservabilityAlertInput,
): Promise<SendObservabilityAlertResult> {
  const webhookUrl = normalizeWebhookUrl();
  if (!webhookUrl) {
    return { sent: false, reason: "NOT_CONFIGURED" };
  }

  const now = Date.now();
  cleanExpiredAlertEntries(now);

  const cooldownSeconds = parseCooldownSeconds(process.env.OBSERVABILITY_ALERT_COOLDOWN_SECONDS);
  const dedupKey = buildDedupKey(input);
  if (isCooldownActive(dedupKey, now)) {
    return { sent: false, reason: "COOLDOWN_ACTIVE" };
  }

  const payload = {
    source: "deal-bazaar",
    environment: process.env.NODE_ENV ?? "development",
    timestamp: new Date(now).toISOString(),
    severity: input.severity,
    scope: input.scope,
    title: input.title,
    message: input.message,
    requestId: input.requestId ?? null,
    metadata: input.metadata ?? {},
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      if (process.env.NODE_ENV !== "test") {
        console.error("[observability.alerting] webhook rejected alert", {
          status: response.status,
          statusText: response.statusText,
          scope: input.scope,
          severity: input.severity,
        });
      }
      return { sent: false, reason: "WEBHOOK_REJECTED" };
    }

    rememberAlert(dedupKey, now, cooldownSeconds);
    return { sent: true };
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error("[observability.alerting] webhook send failed", {
        scope: input.scope,
        severity: input.severity,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return { sent: false, reason: "NETWORK_ERROR" };
  }
}

export function resetObservabilityAlertStateForTest() {
  alertDedupStore.clear();
}
