import { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type WebhookProvider = "STRIPE";

type CreatePaymentWebhookEventInput = {
  provider: WebhookProvider;
  eventId?: string | null;
  eventType?: string | null;
  reference?: string | null;
  orderId?: string | null;
  paymentId?: string | null;
  handled: boolean;
  success: boolean;
  paymentStatus?: PaymentStatus | null;
  orderStatus?: OrderStatus | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  payload?: unknown;
};

type ListPaymentWebhookEventsFilters = {
  search?: string;
  reference?: string;
  eventType?: string;
  dateFrom?: Date;
  dateTo?: Date;
  handled?: boolean;
  success?: boolean;
  limit?: number;
};

function normalizeOptionalText(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toPayloadJson(value: unknown): Prisma.InputJsonValue {
  if (value === undefined) return {} as Prisma.InputJsonValue;
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return {
      message: "Unable to serialize webhook payload",
    } satisfies Prisma.InputJsonValue;
  }
}

function isMissingTableError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021";
}

export async function createPaymentWebhookEventLog(input: CreatePaymentWebhookEventInput) {
  const normalizedReference = normalizeOptionalText(input.reference);
  const normalizedEventType = normalizeOptionalText(input.eventType) ?? "unknown";
  const normalizedErrorCode = normalizeOptionalText(input.errorCode);
  const normalizedErrorMessage = normalizeOptionalText(input.errorMessage);
  const normalizedOrderId = normalizeOptionalText(input.orderId);
  const normalizedPaymentId = normalizeOptionalText(input.paymentId);

  let resolvedOrderId = normalizedOrderId;
  let resolvedPaymentId = normalizedPaymentId;

  if ((!resolvedOrderId || !resolvedPaymentId) && normalizedReference) {
    const payment = await db.payment.findUnique({
      where: { transactionReference: normalizedReference },
      select: { id: true, orderId: true },
    });
    if (payment) {
      resolvedOrderId = resolvedOrderId ?? payment.orderId;
      resolvedPaymentId = resolvedPaymentId ?? payment.id;
    }
  }

  try {
    await db.paymentWebhookEvent.create({
      data: {
        provider: input.provider,
        eventId: normalizeOptionalText(input.eventId),
        eventType: normalizedEventType,
        reference: normalizedReference,
        orderId: resolvedOrderId,
        paymentId: resolvedPaymentId,
        handled: input.handled,
        success: input.success,
        paymentStatus: input.paymentStatus ?? null,
        orderStatus: input.orderStatus ?? null,
        errorCode: normalizedErrorCode,
        errorMessage: normalizedErrorMessage,
        payload: toPayloadJson(input.payload),
        receivedAt: new Date(),
      },
    });
  } catch (error) {
    if (isMissingTableError(error)) return;
    throw error;
  }
}

export async function listAdminPaymentWebhookEvents(filters: ListPaymentWebhookEventsFilters = {}) {
  const take = Math.min(Math.max(filters.limit ?? 80, 10), 5000);
  const searchQuery = normalizeOptionalText(filters.search);
  const referenceQuery = normalizeOptionalText(filters.reference);
  const eventTypeQuery = normalizeOptionalText(filters.eventType);
  const dateFrom = filters.dateFrom;
  const dateTo = filters.dateTo;

  const whereClauses: Prisma.PaymentWebhookEventWhereInput[] = [{ provider: "STRIPE" }];

  if (referenceQuery) {
    whereClauses.push({
      reference: {
        contains: referenceQuery,
        mode: "insensitive",
      },
    });
  }

  if (eventTypeQuery) {
    whereClauses.push({
      eventType: {
        contains: eventTypeQuery,
        mode: "insensitive",
      },
    });
  }

  if (searchQuery) {
    whereClauses.push({
      OR: [
        {
          reference: {
            contains: searchQuery,
            mode: "insensitive",
          },
        },
        {
          eventType: {
            contains: searchQuery,
            mode: "insensitive",
          },
        },
        {
          eventId: {
            contains: searchQuery,
            mode: "insensitive",
          },
        },
        {
          order: {
            is: {
              orderNumber: {
                contains: searchQuery,
                mode: "insensitive",
              },
            },
          },
        },
      ],
    });
  }

  if (dateFrom || dateTo) {
    whereClauses.push({
      createdAt: {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      },
    });
  }

  if (typeof filters.handled === "boolean") {
    whereClauses.push({ handled: filters.handled });
  }
  if (typeof filters.success === "boolean") {
    whereClauses.push({ success: filters.success });
  }

  try {
    const events = await db.paymentWebhookEvent.findMany({
      where: { AND: whereClauses },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        provider: true,
        eventId: true,
        eventType: true,
        reference: true,
        handled: true,
        success: true,
        paymentStatus: true,
        orderStatus: true,
        errorCode: true,
        errorMessage: true,
        payload: true,
        createdAt: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            currencyCode: true,
            grandTotal: true,
            customerEmail: true,
          },
        },
        payment: {
          select: {
            id: true,
            paymentMethod: true,
            paymentStatus: true,
            amount: true,
            currencyCode: true,
            transactionReference: true,
          },
        },
      },
    });

    return events;
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
}
