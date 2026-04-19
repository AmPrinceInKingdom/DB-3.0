const trustedRequestIdPattern = /^[A-Za-z0-9._:-]{6,120}$/;

function normalizeRequestId(value: string | null) {
  if (!value) return null;
  const normalized = value.trim();
  if (!trustedRequestIdPattern.test(normalized)) {
    return null;
  }
  return normalized;
}

function fallbackRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `req_${crypto.randomUUID()}`;
  }
  return `req_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

export function resolveRequestId(request: Request) {
  const candidates = [
    request.headers.get("x-request-id"),
    request.headers.get("x-correlation-id"),
    request.headers.get("x-vercel-id"),
    request.headers.get("cf-ray"),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeRequestId(candidate);
    if (normalized) return normalized;
  }

  return fallbackRequestId();
}

type LogApiFailureInput = {
  scope: string;
  requestId: string;
  error: unknown;
  metadata?: Record<string, unknown>;
};

export function logApiFailure(input: LogApiFailureInput) {
  if (process.env.NODE_ENV === "test") return;

  const errorMessage =
    input.error instanceof Error
      ? input.error.message
      : typeof input.error === "string"
        ? input.error
        : "Unknown error";

  const stack = input.error instanceof Error ? input.error.stack : undefined;

  console.error(`[api.${input.scope}] request failed`, {
    requestId: input.requestId,
    error: errorMessage,
    stack,
    ...(input.metadata ?? {}),
  });
}
