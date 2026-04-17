import { OrderStatus, PaymentStatus, Prisma, ShipmentStatus } from "@prisma/client";
import { AppError, NotFoundError } from "@/lib/errors";
import { db } from "@/lib/db";
import {
  updateOrderStatus,
  updateOrderTracking,
} from "@/lib/services/order-management-service";
import type { SellerOrderListItem } from "@/types/seller-order";

type DecimalLike = Prisma.Decimal | number | string | null;

type SellerOrderFilters = {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  query?: string;
};

const sellerAllowedOrderTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [],
  CONFIRMED: [OrderStatus.PROCESSING],
  PROCESSING: [OrderStatus.SHIPPED],
  SHIPPED: [OrderStatus.DELIVERED],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
};

const sellerAllowedShipmentStatuses = new Set<ShipmentStatus>([
  ShipmentStatus.PACKED,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.DELIVERED,
  ShipmentStatus.FAILED,
]);

function normalizeOptionalText(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toNumber(value: DecimalLike, fallback = 0) {
  if (value === null) return fallback;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return Number(value.toString());
}

async function requireActiveSellerProfile(sellerUserId: string) {
  const seller = await db.seller.findUnique({
    where: { userId: sellerUserId },
    select: {
      userId: true,
      status: true,
    },
  });

  if (!seller || seller.status !== "ACTIVE") {
    throw new AppError("Active seller profile required", 403, "SELLER_PROFILE_INACTIVE");
  }
}

async function getSellerOrderAccess(orderId: string, sellerUserId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      trackingNumber: true,
      items: {
        select: {
          id: true,
          sellerId: true,
        },
      },
      shipment: {
        select: {
          status: true,
          trackingNumber: true,
          courierName: true,
        },
      },
    },
  });

  if (!order) {
    throw new NotFoundError("Seller order not found");
  }

  const sellerItems = order.items.filter((item) => item.sellerId === sellerUserId);
  if (sellerItems.length === 0) {
    throw new NotFoundError("Seller order not found");
  }

  return {
    ...order,
    sellerItemCount: sellerItems.length,
    totalItemCount: order.items.length,
    isMultiSellerOrder: order.items.length > sellerItems.length,
  };
}

export async function listSellerOrders(
  sellerUserId: string,
  filters: SellerOrderFilters = {},
): Promise<SellerOrderListItem[]> {
  await requireActiveSellerProfile(sellerUserId);

  const queryText = normalizeOptionalText(filters.query);

  const where: Prisma.OrderWhereInput = {
    items: {
      some: {
        sellerId: sellerUserId,
      },
    },
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.paymentStatus ? { paymentStatus: filters.paymentStatus } : {}),
    ...(queryText
      ? {
          OR: [
            { orderNumber: { contains: queryText, mode: "insensitive" } },
            { customerEmail: { contains: queryText, mode: "insensitive" } },
            { trackingNumber: { contains: queryText, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const orders = await db.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      currencyCode: true,
      grandTotal: true,
      customerEmail: true,
      customerPhone: true,
      trackingNumber: true,
      createdAt: true,
      shipment: {
        select: {
          status: true,
          trackingNumber: true,
          courierName: true,
          updatedAt: true,
        },
      },
      items: {
        where: {
          sellerId: sellerUserId,
        },
        select: {
          id: true,
          productId: true,
          productName: true,
          sku: true,
          variantName: true,
          quantity: true,
          lineTotal: true,
          currencyCode: true,
        },
      },
      _count: {
        select: {
          items: true,
        },
      },
    },
  });

  return orders.map((order) => {
    const mappedItems = order.items.map((item) => ({
      ...item,
      lineTotal: toNumber(item.lineTotal),
    }));

    const sellerSubtotal = mappedItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const sellerUnits = mappedItems.reduce((sum, item) => sum + item.quantity, 0);

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      currencyCode: order.currencyCode,
      grandTotal: toNumber(order.grandTotal),
      sellerSubtotal,
      sellerItemCount: mappedItems.length,
      sellerUnits,
      totalOrderItemCount: order._count.items,
      isMultiSellerOrder: order._count.items > mappedItems.length,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      trackingNumber: order.trackingNumber,
      createdAt: order.createdAt.toISOString(),
      shipment: order.shipment
        ? {
            ...order.shipment,
            updatedAt: order.shipment.updatedAt.toISOString(),
          }
        : null,
      items: mappedItems,
    };
  });
}

type SellerOrderStatusUpdateInput = {
  sellerUserId: string;
  orderId: string;
  status: OrderStatus;
  note?: string;
};

export async function updateSellerOrderStatus(input: SellerOrderStatusUpdateInput) {
  await requireActiveSellerProfile(input.sellerUserId);

  const access = await getSellerOrderAccess(input.orderId, input.sellerUserId);

  if (access.isMultiSellerOrder) {
    throw new AppError(
      "Multi-seller orders must be updated by admin fulfillment flow.",
      409,
      "MULTI_SELLER_ORDER_LOCKED",
    );
  }

  if (access.status === input.status) {
    throw new AppError("Order is already in this status.", 400, "ORDER_STATUS_ALREADY_SET");
  }

  const allowedNext = sellerAllowedOrderTransitions[access.status] ?? [];
  if (!allowedNext.includes(input.status)) {
    throw new AppError(
      `Sellers cannot change order from ${access.status} to ${input.status}.`,
      400,
      "SELLER_ORDER_STATUS_TRANSITION_BLOCKED",
    );
  }

  if (
    access.paymentStatus === PaymentStatus.PENDING ||
    access.paymentStatus === PaymentStatus.AWAITING_VERIFICATION ||
    access.paymentStatus === PaymentStatus.FAILED
  ) {
    throw new AppError(
      "Payment must be verified before seller fulfillment updates.",
      400,
      "PAYMENT_NOT_VERIFIED",
    );
  }

  return updateOrderStatus({
    orderId: input.orderId,
    status: input.status,
    note: input.note,
    changedByUserId: input.sellerUserId,
  });
}

type SellerTrackingUpdateInput = {
  sellerUserId: string;
  orderId: string;
  trackingNumber?: string;
  courierName?: string;
  shipmentStatus?: ShipmentStatus;
  note?: string;
};

export async function updateSellerOrderTracking(input: SellerTrackingUpdateInput) {
  await requireActiveSellerProfile(input.sellerUserId);

  const access = await getSellerOrderAccess(input.orderId, input.sellerUserId);

  if (access.isMultiSellerOrder) {
    throw new AppError(
      "Multi-seller orders must be updated by admin fulfillment flow.",
      409,
      "MULTI_SELLER_ORDER_LOCKED",
    );
  }

  if (access.status === OrderStatus.CANCELLED || access.status === OrderStatus.REFUNDED) {
    throw new AppError("Cannot update tracking for cancelled/refunded orders.", 400, "ORDER_CLOSED");
  }

  if (input.shipmentStatus && !sellerAllowedShipmentStatuses.has(input.shipmentStatus)) {
    throw new AppError(
      "Sellers can set shipment to Packed, In Transit, Delivered, or Failed.",
      400,
      "SELLER_SHIPMENT_STATUS_BLOCKED",
    );
  }

  const hasTrackingValue = Object.prototype.hasOwnProperty.call(input, "trackingNumber");
  const hasCourierValue = Object.prototype.hasOwnProperty.call(input, "courierName");
  const hasNoteValue = Object.prototype.hasOwnProperty.call(input, "note");

  const normalizedTracking = normalizeOptionalText(input.trackingNumber);
  const effectiveTracking =
    normalizedTracking ?? access.shipment?.trackingNumber ?? access.trackingNumber ?? null;

  if (
    input.shipmentStatus &&
    (input.shipmentStatus === ShipmentStatus.IN_TRANSIT ||
      input.shipmentStatus === ShipmentStatus.DELIVERED) &&
    !effectiveTracking
  ) {
    throw new AppError(
      "Tracking number is required for in-transit or delivered updates.",
      400,
      "TRACKING_REQUIRED",
    );
  }

  return updateOrderTracking({
    orderId: input.orderId,
    trackingNumber: hasTrackingValue ? (input.trackingNumber ?? "") : undefined,
    courierName: hasCourierValue ? (input.courierName ?? "") : undefined,
    shipmentStatus: input.shipmentStatus,
    note: hasNoteValue ? (input.note ?? "") : undefined,
    updatedByUserId: input.sellerUserId,
  });
}
