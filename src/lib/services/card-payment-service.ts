import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import {
  NotificationType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  UserRole,
} from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import type { SessionPayload } from "@/lib/auth/types";
import {
  getNotificationSettings,
  isNotificationTypeEnabled,
} from "@/lib/services/notification-settings-service";
import { canSendInAppNotification } from "@/lib/services/user-notification-preferences-service";

type TxClient = Prisma.TransactionClient;
type CardProvider = "SANDBOX" | "STRIPE_CHECKOUT";
type CardSessionStatus = "PENDING" | "PAID" | "FAILED";

type CardGatewaySessionSnapshot = {
  version: 1;
  provider: CardProvider;
  reference: string;
  tokenHash: string;
  status: CardSessionStatus;
  createdAt: string;
  expiresAt: string;
  processedAt?: string;
  failureReason?: string;
  cardBrand?: string;
  cardLast4?: string;
  stripeSessionId?: string;
  stripeSessionUrl?: string;
};

type CardGatewayPayload = {
  provider: "DEALBAZAAR_CARD_GATEWAY";
  session: CardGatewaySessionSnapshot;
};

type CardPaymentRow = {
  id: string;
  orderId: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  gatewayPayload: Prisma.JsonValue | null;
  order: {
    id: string;
    userId: string | null;
    orderNumber: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
  };
};

type StripeCheckoutSessionResult = {
  sessionId: string;
  checkoutUrl: string;
  expiresAt: string | null;
};

type CardOutcomeInput = {
  approved: boolean;
  cardBrand?: string;
  cardLast4?: string;
  failureReason?: string;
};

type StripeEventObject = Record<string, unknown>;

export type CardPaymentSessionPublic = {
  reference: string;
  provider: CardProvider;
  orderId: string;
  orderNumber: string;
  amount: number;
  currencyCode: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  customerEmail: string;
  expiresAt: string;
  checkoutUrl: string;
};

export type CardPaymentSessionCreateResult = {
  reference: string;
  checkoutUrl: string;
  expiresAt: string;
};

export type StripeWebhookProcessResult = {
  handled: boolean;
  eventId: string | null;
  eventType: string;
  reference: string | null;
  paymentStatus?: PaymentStatus;
  orderStatus?: OrderStatus;
};

export type StripeWebhookReplayResult = {
  webhookEventId: string;
  handled: boolean;
  success: boolean;
  eventType: string;
  reference: string | null;
  paymentStatus?: PaymentStatus;
  orderStatus?: OrderStatus;
};

const checkoutProviderRecord = "DEALBAZAAR_CARD_GATEWAY";
const sandboxGatewayName = "DEALBAZAAR_SANDBOX_CARD";
const stripeGatewayName = "STRIPE_CHECKOUT";
const stripeApiBaseUrl = "https://api.stripe.com/v1";
const webhookToleranceSeconds = 300;

function toNumber(value: Prisma.Decimal | number | string | null, fallback = 0) {
  if (value === null) return fallback;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return Number(value.toString());
}

function normalizeOptionalText(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toCardProvider(value: unknown): CardProvider {
  const normalized =
    typeof value === "string" ? value.trim().toUpperCase() : "";
  return normalized === "STRIPE_CHECKOUT" ? "STRIPE_CHECKOUT" : "SANDBOX";
}

async function resolveCardProviderTx(tx: TxClient): Promise<CardProvider> {
  const providerSetting = await tx.siteSetting.findUnique({
    where: { settingKey: "card_payment_provider" },
    select: { settingValue: true },
  });

  if (typeof providerSetting?.settingValue === "string") {
    return toCardProvider(providerSetting.settingValue);
  }

  return toCardProvider(process.env.CARD_PAYMENT_PROVIDER);
}

function resolveAppBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

function generateCardSessionReference() {
  return `DBCARD-${randomUUID().replaceAll("-", "").toUpperCase()}`;
}

function generateCardSessionSecret() {
  return randomBytes(32).toString("hex");
}

function hashCardSessionSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

function parseCardToken(token: string) {
  const [reference, secret] = token.trim().split(".", 2);
  if (!reference || !secret || !reference.startsWith("DBCARD-") || secret.length < 32) {
    throw new AppError("Invalid card payment token.", 400, "CARD_TOKEN_INVALID");
  }

  return {
    reference,
    secret,
  };
}

function parseStripeMinorUnitMultiplier() {
  const parsed = Number(process.env.STRIPE_MINOR_UNIT_MULTIPLIER ?? 100);
  if (!Number.isFinite(parsed)) return 100;
  return Math.max(1, Math.floor(parsed));
}

function toStripeMinorAmount(amount: number) {
  const multiplier = parseStripeMinorUnitMultiplier();
  return Math.max(1, Math.round(amount * multiplier));
}

function resolveCardCheckoutUrl(token: string) {
  return `${resolveAppBaseUrl()}/checkout/card?token=${encodeURIComponent(token)}`;
}

function buildSessionExpiryDate() {
  const parsedMinutes = Number(process.env.CARD_PAYMENT_SESSION_TTL_MINUTES ?? 30);
  const safeMinutes = Number.isFinite(parsedMinutes) ? parsedMinutes : 30;
  const minutes = Math.max(5, Math.min(120, Math.floor(safeMinutes)));
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + minutes);
  return expiresAt;
}

function buildCardGatewayPayload(session: CardGatewaySessionSnapshot): Prisma.InputJsonValue {
  return {
    provider: checkoutProviderRecord,
    session,
  } satisfies CardGatewayPayload;
}

function parseCardGatewayPayload(value: Prisma.JsonValue | null): CardGatewayPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.provider !== checkoutProviderRecord) return null;

  const sessionRaw = record.session;
  if (!sessionRaw || typeof sessionRaw !== "object" || Array.isArray(sessionRaw)) return null;
  const session = sessionRaw as Record<string, unknown>;

  const provider = session.provider;
  if (provider !== "SANDBOX" && provider !== "STRIPE_CHECKOUT") return null;

  const status = session.status;
  if (status !== "PENDING" && status !== "PAID" && status !== "FAILED") return null;

  const reference = typeof session.reference === "string" ? session.reference : "";
  const tokenHash = typeof session.tokenHash === "string" ? session.tokenHash : "";
  const createdAt = typeof session.createdAt === "string" ? session.createdAt : "";
  const expiresAt = typeof session.expiresAt === "string" ? session.expiresAt : "";
  if (!reference || !tokenHash || !createdAt || !expiresAt) return null;

  return {
    provider: checkoutProviderRecord,
    session: {
      version: 1,
      provider,
      reference,
      tokenHash,
      status,
      createdAt,
      expiresAt,
      processedAt: typeof session.processedAt === "string" ? session.processedAt : undefined,
      failureReason: typeof session.failureReason === "string" ? session.failureReason : undefined,
      cardBrand: typeof session.cardBrand === "string" ? session.cardBrand : undefined,
      cardLast4: typeof session.cardLast4 === "string" ? session.cardLast4 : undefined,
      stripeSessionId:
        typeof session.stripeSessionId === "string" ? session.stripeSessionId : undefined,
      stripeSessionUrl:
        typeof session.stripeSessionUrl === "string" ? session.stripeSessionUrl : undefined,
    },
  };
}

async function createStripeCheckoutSession(input: {
  reference: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  currencyCode: string;
  customerEmail: string;
}) {
  const stripeSecretKey = normalizeOptionalText(process.env.STRIPE_SECRET_KEY);
  if (!stripeSecretKey) {
    throw new AppError(
      "Stripe is not configured. Add STRIPE_SECRET_KEY or switch CARD_PAYMENT_PROVIDER to SANDBOX.",
      500,
      "STRIPE_NOT_CONFIGURED",
    );
  }

  const successUrl = `${resolveAppBaseUrl()}/checkout/success?orderId=${encodeURIComponent(
    input.orderId,
  )}&card=returned`;
  const cancelUrl = `${resolveAppBaseUrl()}/checkout/success?orderId=${encodeURIComponent(
    input.orderId,
  )}&card=cancelled`;

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", successUrl);
  params.set("cancel_url", cancelUrl);
  params.set("client_reference_id", input.reference);
  params.set("customer_email", input.customerEmail);
  params.set("metadata[order_id]", input.orderId);
  params.set("metadata[db_reference]", input.reference);
  params.set("payment_intent_data[metadata][order_id]", input.orderId);
  params.set("payment_intent_data[metadata][db_reference]", input.reference);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", input.currencyCode.toLowerCase());
  params.set(
    "line_items[0][price_data][unit_amount]",
    String(toStripeMinorAmount(input.amount)),
  );
  params.set(
    "line_items[0][price_data][product_data][name]",
    `Deal Bazaar Order ${input.orderNumber}`,
  );

  const response = await fetch(`${stripeApiBaseUrl}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const responseText = await response.text();
  let payload: Record<string, unknown> | null = null;
  try {
    payload = JSON.parse(responseText) as Record<string, unknown>;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload) {
    throw new AppError("Unable to create Stripe checkout session.", 502, "STRIPE_SESSION_CREATE_FAILED");
  }

  const sessionId = typeof payload.id === "string" ? payload.id : "";
  const checkoutUrl = typeof payload.url === "string" ? payload.url : "";
  if (!sessionId || !checkoutUrl) {
    throw new AppError("Stripe session response is invalid.", 502, "STRIPE_SESSION_INVALID");
  }

  const expiresAtUnix =
    typeof payload.expires_at === "number" && Number.isFinite(payload.expires_at)
      ? payload.expires_at
      : null;

  return {
    sessionId,
    checkoutUrl,
    expiresAt: expiresAtUnix ? new Date(expiresAtUnix * 1000).toISOString() : null,
  } satisfies StripeCheckoutSessionResult;
}

function verifySessionTokenHash(session: CardGatewaySessionSnapshot, tokenSecret: string) {
  const computedHash = hashCardSessionSecret(tokenSecret);
  if (computedHash !== session.tokenHash) {
    throw new AppError("Card payment token mismatch.", 403, "CARD_TOKEN_MISMATCH");
  }
}

function resolveGatewayName(provider: CardProvider) {
  return provider === "STRIPE_CHECKOUT" ? stripeGatewayName : sandboxGatewayName;
}

async function applyCardPaymentOutcomeTx(
  tx: TxClient,
  input: {
    payment: CardPaymentRow;
    session: CardGatewaySessionSnapshot;
    outcome: CardOutcomeInput;
    processedAt: Date;
    source: "SANDBOX_PAGE" | "STRIPE_WEBHOOK";
  },
) {
  const { payment, session, outcome, processedAt, source } = input;

  if (payment.paymentMethod !== PaymentMethod.CARD) {
    throw new AppError("Payment method is not card.", 400, "CARD_PAYMENT_INVALID_METHOD");
  }

  if (payment.paymentStatus === PaymentStatus.PAID || payment.order.paymentStatus === PaymentStatus.PAID) {
    return {
      orderId: payment.order.id,
      orderNumber: payment.order.orderNumber,
      paymentStatus: PaymentStatus.PAID,
      orderStatus: payment.order.status,
      redirectUrl: `/checkout/success?orderId=${encodeURIComponent(payment.order.id)}`,
    };
  }

  const normalizedBrand = normalizeOptionalText(outcome.cardBrand);
  const normalizedLast4 = normalizeOptionalText(outcome.cardLast4);
  const normalizedFailureReason = normalizeOptionalText(outcome.failureReason) ?? "Card payment failed.";

  const nextPaymentStatus = outcome.approved ? PaymentStatus.PAID : PaymentStatus.FAILED;
  const nextOrderStatus =
    outcome.approved && payment.order.status === OrderStatus.PENDING
      ? OrderStatus.CONFIRMED
      : payment.order.status;
  const nextSessionStatus: CardSessionStatus = outcome.approved ? "PAID" : "FAILED";

  await tx.payment.update({
    where: { id: payment.id },
    data: {
      paymentStatus: nextPaymentStatus,
      paidAt: outcome.approved ? processedAt : null,
      failureReason: outcome.approved ? null : normalizedFailureReason,
      gatewayPayload: buildCardGatewayPayload({
        ...session,
        status: nextSessionStatus,
        processedAt: processedAt.toISOString(),
        failureReason: outcome.approved ? undefined : normalizedFailureReason,
        cardBrand: normalizedBrand ?? undefined,
        cardLast4: normalizedLast4 ?? undefined,
      }),
    },
  });

  await tx.order.update({
    where: { id: payment.order.id },
    data: {
      paymentStatus: nextPaymentStatus,
      ...(nextOrderStatus !== payment.order.status ? { status: nextOrderStatus } : {}),
    },
    select: { id: true },
  });

  if (nextOrderStatus !== payment.order.status) {
    await tx.orderStatusHistory.create({
      data: {
        orderId: payment.order.id,
        oldStatus: payment.order.status,
        newStatus: nextOrderStatus,
        changedBy: null,
        note:
          source === "STRIPE_WEBHOOK"
            ? "Auto-confirmed after Stripe card payment."
            : "Auto-confirmed after card payment approval.",
      },
    });
  }

  const notificationSettings = await getNotificationSettings(tx);
  const canSendPaymentNotification =
    payment.order.userId &&
    isNotificationTypeEnabled(notificationSettings, NotificationType.PAYMENT)
      ? await canSendInAppNotification(tx, payment.order.userId, NotificationType.PAYMENT)
      : false;

  if (payment.order.userId && canSendPaymentNotification) {
    await tx.notification.create({
      data: {
        userId: payment.order.userId,
        type: NotificationType.PAYMENT,
        title: outcome.approved ? "Card payment successful" : "Card payment failed",
        message: outcome.approved
          ? `Payment received for order ${payment.order.orderNumber}.`
          : `Card payment failed for order ${payment.order.orderNumber}. ${normalizedFailureReason}`,
        linkUrl: "/account/orders",
        metadata: {
          orderId: payment.order.id,
          paymentStatus: nextPaymentStatus,
          gateway: resolveGatewayName(session.provider),
          source,
        } satisfies Prisma.InputJsonValue,
        sentAt: processedAt,
      },
    });
  }

  return {
    orderId: payment.order.id,
    orderNumber: payment.order.orderNumber,
    paymentStatus: nextPaymentStatus,
    orderStatus: nextOrderStatus,
    redirectUrl: `/checkout/success?orderId=${encodeURIComponent(payment.order.id)}`,
  };
}

async function getCardPaymentRowByReferenceTx(tx: TxClient, reference: string) {
  return tx.payment.findUnique({
    where: { transactionReference: reference },
    select: {
      id: true,
      orderId: true,
      paymentMethod: true,
      paymentStatus: true,
      gatewayPayload: true,
      order: {
        select: {
          id: true,
          userId: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
        },
      },
    },
  });
}

export async function createCardPaymentSessionForOrderTx(
  tx: TxClient,
  orderId: string,
): Promise<CardPaymentSessionCreateResult> {
  const paymentRow = await tx.payment.findFirst({
    where: {
      orderId,
      paymentMethod: PaymentMethod.CARD,
    },
    select: {
      id: true,
      orderId: true,
      paymentStatus: true,
      currencyCode: true,
      amount: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          customerEmail: true,
        },
      },
    },
  });

  if (!paymentRow) {
    throw new NotFoundError("Card payment record not found.");
  }

  if (paymentRow.order.status === OrderStatus.CANCELLED || paymentRow.order.status === OrderStatus.REFUNDED) {
    throw new AppError(
      "Card payment cannot start for cancelled or refunded orders.",
      400,
      "CARD_ORDER_CLOSED",
    );
  }
  if (paymentRow.order.paymentStatus === PaymentStatus.PAID) {
    throw new AppError("This order is already paid.", 400, "ORDER_ALREADY_PAID");
  }

  const provider = await resolveCardProviderTx(tx);
  const reference = generateCardSessionReference();
  const secret = generateCardSessionSecret();
  const tokenHash = hashCardSessionSecret(secret);
  const localToken = `${reference}.${secret}`;
  const fallbackExpiry = buildSessionExpiryDate().toISOString();

  const session: CardGatewaySessionSnapshot = {
    version: 1,
    provider,
    reference,
    tokenHash,
    status: "PENDING",
    createdAt: new Date().toISOString(),
    expiresAt: fallbackExpiry,
  };

  let checkoutUrl = resolveCardCheckoutUrl(localToken);
  if (provider === "STRIPE_CHECKOUT") {
    const stripeSession = await createStripeCheckoutSession({
      reference,
      orderId: paymentRow.orderId,
      orderNumber: paymentRow.order.orderNumber,
      amount: toNumber(paymentRow.amount),
      currencyCode: paymentRow.currencyCode,
      customerEmail: paymentRow.order.customerEmail,
    });
    session.stripeSessionId = stripeSession.sessionId;
    session.stripeSessionUrl = stripeSession.checkoutUrl;
    session.expiresAt = stripeSession.expiresAt ?? fallbackExpiry;
    checkoutUrl = stripeSession.checkoutUrl;
  }

  await tx.payment.update({
    where: { id: paymentRow.id },
    data: {
      paymentStatus: PaymentStatus.PENDING,
      transactionReference: reference,
      gateway: resolveGatewayName(provider),
      failureReason: null,
      gatewayPayload: buildCardGatewayPayload(session),
    },
  });

  await tx.order.update({
    where: { id: paymentRow.orderId },
    data: {
      paymentStatus: PaymentStatus.PENDING,
    },
    select: { id: true },
  });

  return {
    reference,
    checkoutUrl,
    expiresAt: session.expiresAt,
  };
}

export async function createCardPaymentSessionForOrder(orderId: string) {
  return db.$transaction(async (tx) => createCardPaymentSessionForOrderTx(tx, orderId));
}

export async function getCardPaymentSessionByToken(token: string): Promise<CardPaymentSessionPublic> {
  const { reference, secret } = parseCardToken(token);

  const payment = await db.payment.findUnique({
    where: { transactionReference: reference },
    select: {
      id: true,
      amount: true,
      currencyCode: true,
      paymentStatus: true,
      paymentMethod: true,
      gatewayPayload: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          customerEmail: true,
        },
      },
    },
  });

  if (!payment || payment.paymentMethod !== PaymentMethod.CARD) {
    throw new NotFoundError("Card payment session not found.");
  }

  const parsed = parseCardGatewayPayload(payment.gatewayPayload);
  if (!parsed || parsed.session.reference !== reference) {
    throw new AppError("Card payment session is invalid.", 400, "CARD_SESSION_INVALID");
  }
  verifySessionTokenHash(parsed.session, secret);

  return {
    reference,
    provider: parsed.session.provider,
    orderId: payment.order.id,
    orderNumber: payment.order.orderNumber,
    amount: toNumber(payment.amount),
    currencyCode: payment.currencyCode,
    paymentStatus: payment.paymentStatus,
    orderStatus: payment.order.status,
    customerEmail: payment.order.customerEmail,
    expiresAt: parsed.session.expiresAt,
    checkoutUrl:
      parsed.session.provider === "STRIPE_CHECKOUT"
        ? parsed.session.stripeSessionUrl ?? ""
        : resolveCardCheckoutUrl(token),
  };
}

type CompleteCardPaymentInput = {
  token: string;
  approved: boolean;
  cardBrand?: string;
  cardLast4?: string;
  failureReason?: string;
};

type CompleteCardPaymentResult = {
  orderId: string;
  orderNumber: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  redirectUrl: string;
};

export async function completeCardPaymentByToken(
  input: CompleteCardPaymentInput,
): Promise<CompleteCardPaymentResult> {
  const { reference, secret } = parseCardToken(input.token);
  const now = new Date();

  return db.$transaction(async (tx) => {
    const payment = await getCardPaymentRowByReferenceTx(tx, reference);
    if (!payment || payment.paymentMethod !== PaymentMethod.CARD) {
      throw new NotFoundError("Card payment session not found.");
    }

    const parsed = parseCardGatewayPayload(payment.gatewayPayload);
    if (!parsed || parsed.session.reference !== reference) {
      throw new AppError("Card payment session is invalid.", 400, "CARD_SESSION_INVALID");
    }
    if (parsed.session.provider !== "SANDBOX") {
      throw new AppError(
        "This card payment is hosted externally and cannot be confirmed from sandbox page.",
        400,
        "CARD_SESSION_HOSTED",
      );
    }

    verifySessionTokenHash(parsed.session, secret);

    const expiryDate = new Date(parsed.session.expiresAt);
    if (now > expiryDate) {
      throw new AppError("Card payment session expired. Please retry payment.", 400, "CARD_SESSION_EXPIRED");
    }

    return applyCardPaymentOutcomeTx(tx, {
      payment,
      session: parsed.session,
      outcome: {
        approved: input.approved,
        cardBrand: input.cardBrand,
        cardLast4: input.cardLast4,
        failureReason: input.failureReason,
      },
      processedAt: now,
      source: "SANDBOX_PAGE",
    });
  });
}

type RetryCardPaymentInput = {
  orderId: string;
  session: SessionPayload | null;
  customerEmail?: string;
};

export async function retryCardPaymentSession(
  input: RetryCardPaymentInput,
): Promise<CardPaymentSessionCreateResult> {
  const order = await db.order.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      userId: true,
      customerEmail: true,
      paymentMethod: true,
      status: true,
      paymentStatus: true,
    },
  });

  if (!order) {
    throw new NotFoundError("Order not found.");
  }
  if (order.paymentMethod !== PaymentMethod.CARD) {
    throw new AppError("This order is not a card payment order.", 400, "CARD_RETRY_INVALID_METHOD");
  }
  if (order.paymentStatus === PaymentStatus.PAID) {
    throw new AppError("This order is already paid.", 400, "ORDER_ALREADY_PAID");
  }
  if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.REFUNDED) {
    throw new AppError("Cannot retry payment for closed orders.", 400, "ORDER_CLOSED");
  }

  if (order.userId) {
    const isOwner = input.session?.sub === order.userId;
    const isAdmin =
      input.session?.role === UserRole.ADMIN || input.session?.role === UserRole.SUPER_ADMIN;
    if (!isOwner && !isAdmin) {
      throw new AppError("You are not allowed to retry this payment.", 403, "CARD_RETRY_FORBIDDEN");
    }
  } else {
    const emailFromRequest = normalizeOptionalText(input.customerEmail)?.toLowerCase();
    const emailFromOrder = order.customerEmail.toLowerCase();
    if (!emailFromRequest || emailFromRequest !== emailFromOrder) {
      throw new AppError(
        "Valid customer email is required to retry guest payment.",
        403,
        "CARD_RETRY_FORBIDDEN",
      );
    }
  }

  return createCardPaymentSessionForOrder(order.id);
}

function safeCompareHex(a: string, b: string) {
  try {
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");
    if (left.length === 0 || right.length === 0 || left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function parseStripeSignatureHeader(signatureHeader: string) {
  const parts = signatureHeader.split(",");
  const parsed = new Map<string, string[]>();
  for (const part of parts) {
    const [rawKey, rawValue] = part.split("=", 2);
    const key = rawKey?.trim();
    const value = rawValue?.trim();
    if (!key || !value) continue;
    const existing = parsed.get(key) ?? [];
    existing.push(value);
    parsed.set(key, existing);
  }

  const timestamp = Number(parsed.get("t")?.[0] ?? NaN);
  const signatures = parsed.get("v1") ?? [];
  if (!Number.isFinite(timestamp) || signatures.length === 0) {
    throw new AppError("Invalid Stripe signature header.", 400, "STRIPE_SIGNATURE_INVALID");
  }

  return { timestamp, signatures };
}

function verifyStripeWebhookSignature(rawBody: string, signatureHeader: string) {
  const webhookSecret = normalizeOptionalText(process.env.STRIPE_WEBHOOK_SECRET);
  if (!webhookSecret) {
    throw new AppError(
      "Stripe webhook is not configured. Add STRIPE_WEBHOOK_SECRET.",
      500,
      "STRIPE_WEBHOOK_NOT_CONFIGURED",
    );
  }

  const { timestamp, signatures } = parseStripeSignatureHeader(signatureHeader);
  const currentUnix = Math.floor(Date.now() / 1000);
  if (Math.abs(currentUnix - timestamp) > webhookToleranceSeconds) {
    throw new AppError("Stripe signature timestamp expired.", 400, "STRIPE_SIGNATURE_EXPIRED");
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedSignature = createHmac("sha256", webhookSecret)
    .update(signedPayload)
    .digest("hex");

  const valid = signatures.some((signature) => safeCompareHex(signature, expectedSignature));
  if (!valid) {
    throw new AppError("Stripe signature validation failed.", 400, "STRIPE_SIGNATURE_INVALID");
  }
}

function getObjectRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function getString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function extractStripeReference(eventObject: StripeEventObject) {
  const metadata = getObjectRecord(eventObject.metadata);
  const metadataReference = getString(metadata?.db_reference);
  if (metadataReference) return metadataReference;

  const clientReferenceId = getString(eventObject.client_reference_id);
  if (clientReferenceId) return clientReferenceId;

  return null;
}

function extractStripeFailureReason(eventObject: StripeEventObject) {
  const lastPaymentError = getObjectRecord(eventObject.last_payment_error);
  const message = getString(lastPaymentError?.message);
  if (message) return message;

  const paymentStatus = getString(eventObject.payment_status);
  if (paymentStatus === "unpaid") {
    return "Card payment was not completed.";
  }

  return "Card payment failed.";
}

function parseStripeWebhookEvent(rawBody: string) {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    throw new AppError("Stripe webhook payload is invalid JSON.", 400, "STRIPE_WEBHOOK_INVALID_JSON");
  }

  const eventType = getString(payload.type);
  if (!eventType) {
    throw new AppError("Stripe webhook event type is missing.", 400, "STRIPE_EVENT_INVALID");
  }

  const data = getObjectRecord(payload.data);
  const eventObject = getObjectRecord(data?.object);
  if (!eventObject) {
    throw new AppError("Stripe webhook event object is missing.", 400, "STRIPE_EVENT_INVALID");
  }

  return { eventType, eventObject };
}

function mapLoggedWebhookPayloadToStripeEventObject(payload: Prisma.JsonValue): StripeEventObject {
  const payloadRecord = getObjectRecord(payload);
  if (!payloadRecord) return {};

  const objectRecord = getObjectRecord(payloadRecord.object);
  if (!objectRecord) return {};

  return {
    id: getString(objectRecord.id),
    client_reference_id:
      getString(objectRecord.client_reference_id) ?? getString(objectRecord.clientReferenceId),
    payment_status: getString(objectRecord.payment_status) ?? getString(objectRecord.paymentStatus),
    metadata: getObjectRecord(objectRecord.metadata) ?? {},
  };
}

function mapStripeEventToOutcome(eventType: string, eventObject: StripeEventObject): CardOutcomeInput | null {
  if (eventType === "checkout.session.completed" || eventType === "checkout.session.async_payment_succeeded") {
    return {
      approved: true,
    };
  }

  if (eventType === "checkout.session.expired" || eventType === "checkout.session.async_payment_failed") {
    return {
      approved: false,
      failureReason: extractStripeFailureReason(eventObject),
    };
  }

  return null;
}

export async function processStripeWebhook(
  rawBody: string,
  signatureHeader: string | null,
): Promise<StripeWebhookProcessResult> {
  if (!signatureHeader) {
    throw new AppError("Missing Stripe signature header.", 400, "STRIPE_SIGNATURE_MISSING");
  }

  verifyStripeWebhookSignature(rawBody, signatureHeader);
  const { eventType, eventObject } = parseStripeWebhookEvent(rawBody);
  const eventId = getString(eventObject.id);
  const outcome = mapStripeEventToOutcome(eventType, eventObject);
  if (!outcome) {
    return {
      handled: false,
      eventId,
      eventType,
      reference: null,
    };
  }

  const reference = extractStripeReference(eventObject);
  if (!reference) {
    return {
      handled: false,
      eventId,
      eventType,
      reference: null,
    };
  }

  const stripeSessionId = getString(eventObject.id);

  const result = await db.$transaction(async (tx) => {
    const payment = await getCardPaymentRowByReferenceTx(tx, reference);
    if (!payment || payment.paymentMethod !== PaymentMethod.CARD) {
      return null;
    }

    const parsed = parseCardGatewayPayload(payment.gatewayPayload);
    if (!parsed || parsed.session.reference !== reference) {
      return null;
    }
    if (parsed.session.provider !== "STRIPE_CHECKOUT") {
      return null;
    }
    if (
      stripeSessionId &&
      parsed.session.stripeSessionId &&
      parsed.session.stripeSessionId !== stripeSessionId
    ) {
      return null;
    }

    return applyCardPaymentOutcomeTx(tx, {
      payment,
      session: parsed.session,
      outcome,
      processedAt: new Date(),
      source: "STRIPE_WEBHOOK",
    });
  });

  if (!result) {
    return {
      handled: false,
      eventId,
      eventType,
      reference,
    };
  }

  return {
    handled: true,
    eventId,
    eventType,
    reference,
    paymentStatus: result.paymentStatus,
    orderStatus: result.orderStatus,
  };
}

export async function replayStripeWebhookEventById(
  webhookEventId: string,
): Promise<StripeWebhookReplayResult> {
  const webhookEvent = await db.paymentWebhookEvent.findUnique({
    where: { id: webhookEventId },
    select: {
      id: true,
      provider: true,
      eventType: true,
      reference: true,
      payload: true,
    },
  });

  if (!webhookEvent) {
    throw new NotFoundError("Webhook event not found.");
  }
  if (webhookEvent.provider !== "STRIPE") {
    throw new AppError(
      "Manual replay is currently available only for Stripe webhook events.",
      400,
      "STRIPE_WEBHOOK_REPLAY_PROVIDER_INVALID",
    );
  }

  const eventObject = mapLoggedWebhookPayloadToStripeEventObject(webhookEvent.payload);
  const outcome = mapStripeEventToOutcome(webhookEvent.eventType, eventObject);
  if (!outcome) {
    throw new AppError(
      "This webhook event type cannot be replayed manually.",
      400,
      "STRIPE_WEBHOOK_REPLAY_UNSUPPORTED_EVENT",
    );
  }

  const reference = webhookEvent.reference ?? extractStripeReference(eventObject);
  if (!reference) {
    throw new AppError(
      "Unable to resolve payment reference for this webhook event.",
      400,
      "STRIPE_WEBHOOK_REPLAY_REFERENCE_MISSING",
    );
  }

  const stripeSessionId = getString(eventObject.id);

  try {
    const result = await db.$transaction(async (tx) => {
      const payment = await getCardPaymentRowByReferenceTx(tx, reference);
      if (!payment || payment.paymentMethod !== PaymentMethod.CARD) {
        return null;
      }

      const parsed = parseCardGatewayPayload(payment.gatewayPayload);
      if (!parsed || parsed.session.reference !== reference) {
        return null;
      }
      if (parsed.session.provider !== "STRIPE_CHECKOUT") {
        return null;
      }
      if (
        stripeSessionId &&
        parsed.session.stripeSessionId &&
        parsed.session.stripeSessionId !== stripeSessionId
      ) {
        return null;
      }

      return applyCardPaymentOutcomeTx(tx, {
        payment,
        session: parsed.session,
        outcome,
        processedAt: new Date(),
        source: "STRIPE_WEBHOOK",
      });
    });

    if (!result) {
      throw new AppError(
        "Unable to reconcile this webhook with an active Stripe card payment session.",
        409,
        "STRIPE_WEBHOOK_REPLAY_UNRESOLVED",
      );
    }

    await db.paymentWebhookEvent.update({
      where: { id: webhookEventId },
      data: {
        handled: true,
        success: true,
        reference,
        paymentStatus: result.paymentStatus,
        orderStatus: result.orderStatus,
        errorCode: null,
        errorMessage: null,
        receivedAt: new Date(),
      },
    });

    return {
      webhookEventId,
      handled: true,
      success: true,
      eventType: webhookEvent.eventType,
      reference,
      paymentStatus: result.paymentStatus,
      orderStatus: result.orderStatus,
    };
  } catch (error) {
    const errorCode = error instanceof AppError ? error.code : "STRIPE_WEBHOOK_REPLAY_FAILED";
    const errorMessage =
      error instanceof Error ? error.message : "Unable to replay Stripe webhook event.";

    try {
      await db.paymentWebhookEvent.update({
        where: { id: webhookEventId },
        data: {
          handled: false,
          success: false,
          reference,
          errorCode,
          errorMessage,
          receivedAt: new Date(),
        },
      });
    } catch {
      // Ignore logging failure to preserve original replay error.
    }

    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Unable to replay Stripe webhook event.", 500, "STRIPE_WEBHOOK_REPLAY_FAILED");
  }
}
