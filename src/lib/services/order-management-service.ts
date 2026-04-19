import {
  NotificationType,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ShipmentStatus,
  StockStatus,
} from "@prisma/client";
import { AppError, NotFoundError } from "@/lib/errors";
import { db } from "@/lib/db";
import {
  getNotificationSettings,
  isNotificationTypeEnabled,
} from "@/lib/services/notification-settings-service";
import { canSendInAppNotification } from "@/lib/services/user-notification-preferences-service";

type DecimalLike = Prisma.Decimal | number | string | null;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toNumber(value: DecimalLike, fallback = 0) {
  if (value === null) return fallback;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return Number(value.toString());
}

function isUuid(value?: string | null): value is string {
  if (!value) return false;
  return uuidPattern.test(value);
}

function resolveStockStatus(quantity: number, minStockLevel: number): StockStatus {
  if (quantity <= 0) return StockStatus.OUT_OF_STOCK;
  if (quantity <= minStockLevel) return StockStatus.LOW_STOCK;
  return StockStatus.IN_STOCK;
}

const allowedStatusTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED, OrderStatus.REFUNDED],
  DELIVERED: [OrderStatus.REFUNDED],
  CANCELLED: [],
  REFUNDED: [],
};

const allowedShipmentTransitions: Record<ShipmentStatus, ShipmentStatus[]> = {
  PENDING: [ShipmentStatus.PACKED, ShipmentStatus.IN_TRANSIT, ShipmentStatus.FAILED],
  PACKED: [ShipmentStatus.IN_TRANSIT, ShipmentStatus.FAILED],
  IN_TRANSIT: [ShipmentStatus.DELIVERED, ShipmentStatus.FAILED, ShipmentStatus.RETURNED],
  DELIVERED: [ShipmentStatus.RETURNED],
  FAILED: [ShipmentStatus.PACKED, ShipmentStatus.IN_TRANSIT, ShipmentStatus.RETURNED],
  RETURNED: [],
};

function normalizeOptionalText(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function mapShipmentStatusToOrderStatus(shipmentStatus: ShipmentStatus) {
  if (shipmentStatus === ShipmentStatus.PACKED) return OrderStatus.PROCESSING;
  if (shipmentStatus === ShipmentStatus.IN_TRANSIT) return OrderStatus.SHIPPED;
  if (shipmentStatus === ShipmentStatus.DELIVERED) return OrderStatus.DELIVERED;
  return null;
}

export async function listCustomerOrders(userId: string) {
  const orders = await db.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      currencyCode: true,
      grandTotal: true,
      createdAt: true,
      items: {
        select: {
          id: true,
          productName: true,
          quantity: true,
          lineTotal: true,
        },
      },
    },
  });

  return orders.map((order) => ({
    ...order,
    grandTotal: toNumber(order.grandTotal),
    items: order.items.map((item) => ({
      ...item,
      lineTotal: toNumber(item.lineTotal),
    })),
  }));
}

export async function getCustomerOrderDetail(userId: string, orderId: string) {
  const order = await db.order.findFirst({
    where: { id: orderId, userId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      currencyCode: true,
      subtotal: true,
      shippingFee: true,
      taxTotal: true,
      grandTotal: true,
      customerEmail: true,
      customerPhone: true,
      trackingNumber: true,
      notes: true,
      placedAt: true,
      deliveredAt: true,
      cancelledAt: true,
      createdAt: true,
      shippingMethod: {
        select: {
          code: true,
          name: true,
          estimatedDaysMin: true,
          estimatedDaysMax: true,
        },
      },
      items: {
        select: {
          id: true,
          productName: true,
          variantName: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
        },
      },
      statusHistory: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          oldStatus: true,
          newStatus: true,
          note: true,
          createdAt: true,
        },
      },
      paymentProofs: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fileName: true,
          verificationStatus: true,
          rejectionReason: true,
          createdAt: true,
        },
      },
    },
  });

  if (!order) return null;

  return {
    ...order,
    subtotal: toNumber(order.subtotal),
    shippingFee: toNumber(order.shippingFee),
    taxTotal: toNumber(order.taxTotal),
    grandTotal: toNumber(order.grandTotal),
    items: order.items.map((item) => ({
      ...item,
      unitPrice: toNumber(item.unitPrice),
      lineTotal: toNumber(item.lineTotal),
    })),
  };
}

type AdminOrderListFilters = {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  query?: string;
};

export async function listAdminOrders(filters: AdminOrderListFilters = {}) {
  const queryText = normalizeOptionalText(filters.query);

  const where: Prisma.OrderWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.paymentStatus ? { paymentStatus: filters.paymentStatus } : {}),
    ...(queryText
      ? {
          OR: [
            { orderNumber: { contains: queryText, mode: "insensitive" } },
            { customerEmail: { contains: queryText, mode: "insensitive" } },
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
      customer: {
        select: {
          id: true,
          email: true,
          profile: {
            select: { firstName: true, lastName: true },
          },
        },
      },
      items: {
        select: {
          id: true,
          productName: true,
          quantity: true,
          lineTotal: true,
        },
      },
    },
  });

  return orders.map((order) => ({
    ...order,
    grandTotal: toNumber(order.grandTotal),
    items: order.items.map((item) => ({
      ...item,
      lineTotal: toNumber(item.lineTotal),
    })),
  }));
}

export async function getAdminOrderDetail(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      currencyCode: true,
      exchangeRateToBase: true,
      subtotal: true,
      discountTotal: true,
      shippingFee: true,
      taxTotal: true,
      grandTotal: true,
      customerEmail: true,
      customerPhone: true,
      trackingNumber: true,
      notes: true,
      adminNotes: true,
      placedAt: true,
      deliveredAt: true,
      cancelledAt: true,
      createdAt: true,
      updatedAt: true,
      customer: {
        select: {
          id: true,
          email: true,
          profile: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      billingAddress: {
        select: {
          id: true,
          label: true,
          firstName: true,
          lastName: true,
          company: true,
          phone: true,
          line1: true,
          line2: true,
          city: true,
          state: true,
          postalCode: true,
          countryCode: true,
        },
      },
      shippingAddress: {
        select: {
          id: true,
          label: true,
          firstName: true,
          lastName: true,
          company: true,
          phone: true,
          line1: true,
          line2: true,
          city: true,
          state: true,
          postalCode: true,
          countryCode: true,
        },
      },
      shippingMethod: {
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          estimatedDaysMin: true,
          estimatedDaysMax: true,
        },
      },
      items: {
        select: {
          id: true,
          productId: true,
          variantId: true,
          productName: true,
          sku: true,
          variantName: true,
          unitPrice: true,
          quantity: true,
          lineTotal: true,
          currencyCode: true,
          metadata: true,
        },
      },
      statusHistory: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          oldStatus: true,
          newStatus: true,
          note: true,
          createdAt: true,
          changer: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      },
      payment: {
        select: {
          id: true,
          paymentStatus: true,
          paymentMethod: true,
          transactionReference: true,
          gateway: true,
          amount: true,
          currencyCode: true,
          paidAt: true,
          failureReason: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      paymentProofs: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fileUrl: true,
          fileName: true,
          verificationStatus: true,
          rejectionReason: true,
          createdAt: true,
          verifiedAt: true,
          uploader: {
            select: { id: true, email: true },
          },
          verifier: {
            select: { id: true, email: true },
          },
        },
      },
      shipment: {
        select: {
          id: true,
          status: true,
          trackingNumber: true,
          courierName: true,
          shippedAt: true,
          deliveredAt: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          shippingMethod: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!order) return null;

  return {
    ...order,
    exchangeRateToBase: toNumber(order.exchangeRateToBase, 1),
    subtotal: toNumber(order.subtotal),
    discountTotal: toNumber(order.discountTotal),
    shippingFee: toNumber(order.shippingFee),
    taxTotal: toNumber(order.taxTotal),
    grandTotal: toNumber(order.grandTotal),
    items: order.items.map((item) => ({
      ...item,
      unitPrice: toNumber(item.unitPrice),
      lineTotal: toNumber(item.lineTotal),
    })),
    payment: order.payment
      ? {
          ...order.payment,
          amount: toNumber(order.payment.amount),
        }
      : null,
  };
}

type StockRestoreLine = {
  productId: string | null;
  productName: string;
  variantId: string | null;
  variantName: string | null;
  quantity: number;
};

async function restoreOrderInventory(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    orderNumber: string;
    lines: StockRestoreLine[];
    actorUserId?: string | null;
    reasonPrefix: "ORDER_CANCELLED" | "ORDER_REFUNDED";
  },
) {
  const productAdjustments = new Map<string, { productName: string; quantity: number }>();
  const variantAdjustments = new Map<
    string,
    { productId: string; productName: string; variantId: string; variantName: string | null; quantity: number }
  >();

  for (const line of input.lines) {
    if (!isUuid(line.productId)) continue;

    const productExisting = productAdjustments.get(line.productId);
    if (productExisting) {
      productExisting.quantity += line.quantity;
    } else {
      productAdjustments.set(line.productId, {
        productName: line.productName,
        quantity: line.quantity,
      });
    }

    if (isUuid(line.variantId)) {
      const key = `${line.productId}:${line.variantId}`;
      const variantExisting = variantAdjustments.get(key);
      if (variantExisting) {
        variantExisting.quantity += line.quantity;
      } else {
        variantAdjustments.set(key, {
          productId: line.productId,
          productName: line.productName,
          variantId: line.variantId,
          variantName: line.variantName ?? null,
          quantity: line.quantity,
        });
      }
    }
  }

  for (const adjustment of variantAdjustments.values()) {
    const variant = await tx.productVariant.findUnique({
      where: { id: adjustment.variantId },
      select: {
        id: true,
        productId: true,
        stockQuantity: true,
      },
    });

    if (!variant || variant.productId !== adjustment.productId) {
      continue;
    }

    await tx.productVariant.update({
      where: { id: variant.id },
      data: {
        stockQuantity: { increment: adjustment.quantity },
      },
    });

    const newQuantity = variant.stockQuantity + adjustment.quantity;
    await tx.inventoryLog.create({
      data: {
        productId: adjustment.productId,
        variantId: adjustment.variantId,
        changedBy: input.actorUserId ?? null,
        previousQuantity: variant.stockQuantity,
        changeAmount: adjustment.quantity,
        newQuantity,
        reason: `${input.reasonPrefix.replaceAll("_", " ")} stock restore for order ${input.orderNumber}`,
        referenceType: input.reasonPrefix === "ORDER_CANCELLED" ? "ORDER_CANCELLED_VARIANT" : "ORDER_REFUNDED_VARIANT",
        referenceId: input.orderId,
      },
    });
  }

  for (const [productId, adjustment] of productAdjustments.entries()) {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        stockQuantity: true,
        minStockLevel: true,
        totalSold: true,
      },
    });

    if (!product) {
      continue;
    }

    const newStockQuantity = product.stockQuantity + adjustment.quantity;
    const nextStockStatus = resolveStockStatus(newStockQuantity, product.minStockLevel);
    const nextTotalSold = Math.max(0, product.totalSold - adjustment.quantity);

    await tx.product.update({
      where: { id: product.id },
      data: {
        stockQuantity: newStockQuantity,
        stockStatus: nextStockStatus,
        totalSold: nextTotalSold,
      },
    });

    await tx.inventoryLog.create({
      data: {
        productId: product.id,
        changedBy: input.actorUserId ?? null,
        previousQuantity: product.stockQuantity,
        changeAmount: adjustment.quantity,
        newQuantity: newStockQuantity,
        reason: `${input.reasonPrefix.replaceAll("_", " ")} stock restore for order ${input.orderNumber}`,
        referenceType: input.reasonPrefix,
        referenceId: input.orderId,
      },
    });
  }
}

type UpdateOrderStatusInput = {
  orderId: string;
  status: OrderStatus;
  note?: string;
  changedByUserId?: string | null;
};

export async function updateOrderStatus(input: UpdateOrderStatusInput) {
  const updated = await db.$transaction(async (tx) => {
    const currentOrder = await tx.order.findUnique({
      where: { id: input.orderId },
      select: {
        id: true,
        userId: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        items: {
          select: {
            productId: true,
            productName: true,
            variantId: true,
            variantName: true,
            quantity: true,
          },
        },
      },
    });

    if (!currentOrder) {
      throw new NotFoundError("Order not found");
    }

    if (currentOrder.status !== input.status) {
      const allowed = allowedStatusTransitions[currentOrder.status];
      if (!allowed.includes(input.status)) {
        throw new AppError(
          `Cannot change status from ${currentOrder.status} to ${input.status}`,
          400,
          "INVALID_ORDER_STATUS_TRANSITION",
        );
      }
    }

    const orderUpdate: Prisma.OrderUpdateInput = {
      status: input.status,
      ...(input.status === OrderStatus.DELIVERED ? { deliveredAt: new Date() } : {}),
      ...(input.status === OrderStatus.CANCELLED ? { cancelledAt: new Date() } : {}),
      ...(input.status === OrderStatus.REFUNDED ? { paymentStatus: PaymentStatus.REFUNDED } : {}),
    };

    const shouldRestoreInventory =
      currentOrder.status !== input.status &&
      (input.status === OrderStatus.CANCELLED || input.status === OrderStatus.REFUNDED);

    const order = await tx.order.update({
      where: { id: currentOrder.id },
      data: orderUpdate,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        currencyCode: true,
        grandTotal: true,
        createdAt: true,
      },
    });

    if (shouldRestoreInventory) {
      await restoreOrderInventory(tx, {
        orderId: currentOrder.id,
        orderNumber: currentOrder.orderNumber,
        lines: currentOrder.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          variantId: item.variantId,
          variantName: item.variantName,
          quantity: item.quantity,
        })),
        actorUserId: input.changedByUserId ?? null,
        reasonPrefix:
          input.status === OrderStatus.CANCELLED ? "ORDER_CANCELLED" : "ORDER_REFUNDED",
      });
    }

    if (input.status === OrderStatus.REFUNDED) {
      await tx.payment.updateMany({
        where: { orderId: currentOrder.id },
        data: {
          paymentStatus: PaymentStatus.REFUNDED,
        },
      });
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId: currentOrder.id,
        oldStatus: currentOrder.status,
        newStatus: input.status,
        changedBy: input.changedByUserId ?? null,
        note: normalizeOptionalText(input.note),
      },
    });

    const notificationSettings = await getNotificationSettings(tx);
    const canSendOrderNotification =
      currentOrder.userId &&
      isNotificationTypeEnabled(notificationSettings, NotificationType.ORDER)
        ? await canSendInAppNotification(tx, currentOrder.userId, NotificationType.ORDER)
        : false;

    if (currentOrder.userId && canSendOrderNotification) {
      await tx.notification.create({
        data: {
          userId: currentOrder.userId,
          type: NotificationType.ORDER,
          title: "Order status updated",
          message: `Your order ${currentOrder.orderNumber} is now ${input.status}.`,
          metadata: {
            orderId: currentOrder.id,
            status: input.status,
          },
        },
      });
    }

    return order;
  });

  return {
    ...updated,
    grandTotal: toNumber(updated.grandTotal),
  };
}

type UpdateOrderTrackingInput = {
  orderId: string;
  trackingNumber?: string;
  courierName?: string;
  shipmentStatus?: ShipmentStatus;
  note?: string;
  updatedByUserId?: string | null;
};

export async function updateOrderTracking(input: UpdateOrderTrackingInput) {
  return db.$transaction(async (tx) => {
    const currentOrder = await tx.order.findUnique({
      where: { id: input.orderId },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        status: true,
        trackingNumber: true,
        shippingMethodId: true,
        shipment: {
          select: {
            id: true,
            status: true,
            trackingNumber: true,
            courierName: true,
            notes: true,
            shippedAt: true,
            deliveredAt: true,
          },
        },
      },
    });

    if (!currentOrder) {
      throw new NotFoundError("Order not found");
    }

    if (
      currentOrder.shipment &&
      input.shipmentStatus &&
      input.shipmentStatus !== currentOrder.shipment.status
    ) {
      const allowed = allowedShipmentTransitions[currentOrder.shipment.status];
      if (!allowed.includes(input.shipmentStatus)) {
        throw new AppError(
          `Cannot change shipment status from ${currentOrder.shipment.status} to ${input.shipmentStatus}`,
          400,
          "INVALID_SHIPMENT_STATUS_TRANSITION",
        );
      }
    }

    const nextTrackingNumber =
      input.trackingNumber !== undefined
        ? normalizeOptionalText(input.trackingNumber)
        : currentOrder.trackingNumber;
    const nextCourierName =
      input.courierName !== undefined
        ? normalizeOptionalText(input.courierName)
        : currentOrder.shipment?.courierName ?? null;
    const nextShipmentStatus =
      input.shipmentStatus ?? currentOrder.shipment?.status ?? ShipmentStatus.PENDING;
    const updateNote = normalizeOptionalText(input.note);

    const shipmentUpdate: Prisma.ShipmentUpdateInput = {
      status: nextShipmentStatus,
      trackingNumber: nextTrackingNumber,
      courierName: nextCourierName,
      ...(updateNote !== null ? { notes: updateNote } : {}),
    };

    if (input.shipmentStatus === ShipmentStatus.IN_TRANSIT) {
      shipmentUpdate.shippedAt = currentOrder.shipment?.shippedAt ?? new Date();
      shipmentUpdate.deliveredAt = null;
    }

    if (input.shipmentStatus === ShipmentStatus.DELIVERED) {
      shipmentUpdate.shippedAt = currentOrder.shipment?.shippedAt ?? new Date();
      shipmentUpdate.deliveredAt = new Date();
    }

    const shipment = await tx.shipment.upsert({
      where: { orderId: currentOrder.id },
      create: {
        orderId: currentOrder.id,
        shippingMethodId: currentOrder.shippingMethodId,
        status: nextShipmentStatus,
        trackingNumber: nextTrackingNumber,
        courierName: nextCourierName,
        ...(nextShipmentStatus === ShipmentStatus.IN_TRANSIT
          ? { shippedAt: new Date() }
          : {}),
        ...(nextShipmentStatus === ShipmentStatus.DELIVERED
          ? { shippedAt: new Date(), deliveredAt: new Date() }
          : {}),
        ...(updateNote !== null ? { notes: updateNote } : {}),
      },
      update: shipmentUpdate,
      select: {
        id: true,
        status: true,
        trackingNumber: true,
        courierName: true,
        shippedAt: true,
        deliveredAt: true,
        notes: true,
        updatedAt: true,
      },
    });

    let nextOrderStatus = currentOrder.status;
    const mappedOrderStatus = mapShipmentStatusToOrderStatus(nextShipmentStatus);
    if (mappedOrderStatus && mappedOrderStatus !== currentOrder.status) {
      const allowedOrderStatus = allowedStatusTransitions[currentOrder.status];
      if (allowedOrderStatus.includes(mappedOrderStatus)) {
        nextOrderStatus = mappedOrderStatus;
      }
    }

    const updatedOrder = await tx.order.update({
      where: { id: currentOrder.id },
      data: {
        trackingNumber: nextTrackingNumber,
        ...(nextOrderStatus !== currentOrder.status ? { status: nextOrderStatus } : {}),
        ...(nextOrderStatus === OrderStatus.DELIVERED ? { deliveredAt: new Date() } : {}),
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        trackingNumber: true,
      },
    });

    const historyFragments: string[] = [];

    if (input.shipmentStatus && input.shipmentStatus !== currentOrder.shipment?.status) {
      historyFragments.push(`Shipment status updated to ${input.shipmentStatus.replaceAll("_", " ")}.`);
    }

    if (input.trackingNumber !== undefined && nextTrackingNumber !== currentOrder.trackingNumber) {
      historyFragments.push(
        nextTrackingNumber ? `Tracking number set to ${nextTrackingNumber}.` : "Tracking number removed.",
      );
    }

    if (input.courierName !== undefined && nextCourierName !== currentOrder.shipment?.courierName) {
      historyFragments.push(
        nextCourierName ? `Courier set to ${nextCourierName}.` : "Courier name removed.",
      );
    }

    if (updateNote) {
      historyFragments.push(updateNote);
    }

    if (nextOrderStatus !== currentOrder.status || historyFragments.length > 0) {
      await tx.orderStatusHistory.create({
        data: {
          orderId: currentOrder.id,
          oldStatus: currentOrder.status,
          newStatus: nextOrderStatus,
          changedBy: input.updatedByUserId ?? null,
          note: historyFragments.length ? historyFragments.join(" ") : null,
        },
      });
    }

    const notificationSettings = await getNotificationSettings(tx);
    const canSendTrackingNotification =
      currentOrder.userId &&
      (historyFragments.length > 0 || nextOrderStatus !== currentOrder.status) &&
      isNotificationTypeEnabled(notificationSettings, NotificationType.ORDER)
        ? await canSendInAppNotification(tx, currentOrder.userId, NotificationType.ORDER)
        : false;

    if (currentOrder.userId && canSendTrackingNotification) {
      await tx.notification.create({
        data: {
          userId: currentOrder.userId,
          type: NotificationType.ORDER,
          title: "Tracking updated",
          message: nextTrackingNumber
            ? `Tracking for order ${currentOrder.orderNumber} is now ${nextTrackingNumber}.`
            : `Tracking details for order ${currentOrder.orderNumber} were updated.`,
          metadata: {
            orderId: currentOrder.id,
            trackingNumber: nextTrackingNumber,
            shipmentStatus: nextShipmentStatus,
          },
        },
      });
    }

    return {
      ...updatedOrder,
      shipment,
    };
  });
}

type PaymentProofFilters = {
  verificationStatus?: PaymentStatus;
};

export async function listAdminPaymentProofs(filters: PaymentProofFilters = {}) {
  const proofs = await db.paymentProof.findMany({
    where: {
      ...(filters.verificationStatus
        ? { verificationStatus: filters.verificationStatus }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      fileUrl: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      verificationStatus: true,
      rejectionReason: true,
      createdAt: true,
      verifiedAt: true,
      order: {
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
          userId: true,
        },
      },
      uploader: {
        select: {
          id: true,
          email: true,
        },
      },
      verifier: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  return proofs.map((proof) => ({
    ...proof,
    sizeBytes: proof.sizeBytes?.toString() ?? null,
    order: {
      ...proof.order,
      grandTotal: toNumber(proof.order.grandTotal),
    },
  }));
}

type ReviewPaymentProofInput = {
  proofId: string;
  action: "APPROVE" | "REJECT";
  reason?: string;
  reviewedByUserId?: string | null;
};

export async function reviewPaymentProof(input: ReviewPaymentProofInput) {
  const reviewNote = normalizeOptionalText(input.reason);

  const result = await db.$transaction(async (tx) => {
    const proof = await tx.paymentProof.findUnique({
      where: { id: input.proofId },
      select: {
        id: true,
        orderId: true,
        verificationStatus: true,
        order: {
          select: {
            id: true,
            userId: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            paymentMethod: true,
          },
        },
      },
    });

    if (!proof) {
      throw new NotFoundError("Payment proof not found");
    }

    const isApprove = input.action === "APPROVE";
    const nextPaymentStatus = isApprove ? PaymentStatus.PAID : PaymentStatus.FAILED;

    const updatedProof = await tx.paymentProof.update({
      where: { id: proof.id },
      data: {
        verificationStatus: nextPaymentStatus,
        verifiedBy: input.reviewedByUserId ?? null,
        verifiedAt: new Date(),
        rejectionReason: isApprove ? null : reviewNote,
      },
      select: {
        id: true,
        orderId: true,
        verificationStatus: true,
        rejectionReason: true,
        verifiedAt: true,
      },
    });

    await tx.order.update({
      where: { id: proof.order.id },
      data: {
        paymentStatus: nextPaymentStatus,
        ...(isApprove && proof.order.status === OrderStatus.PENDING
          ? { status: OrderStatus.CONFIRMED }
          : {}),
      },
      select: { id: true },
    });

    await tx.payment.updateMany({
      where: { orderId: proof.order.id },
      data: {
        paymentStatus: nextPaymentStatus,
        ...(isApprove ? { paidAt: new Date(), failureReason: null } : { failureReason: reviewNote }),
      },
    });

    if (isApprove && proof.order.status === OrderStatus.PENDING) {
      await tx.orderStatusHistory.create({
        data: {
          orderId: proof.order.id,
          oldStatus: OrderStatus.PENDING,
          newStatus: OrderStatus.CONFIRMED,
          changedBy: input.reviewedByUserId ?? null,
          note: "Auto-confirmed after payment proof approval",
        },
      });
    }

    const notificationSettings = await getNotificationSettings(tx);
    const canSendPaymentNotification =
      proof.order.userId &&
      isNotificationTypeEnabled(notificationSettings, NotificationType.PAYMENT)
        ? await canSendInAppNotification(tx, proof.order.userId, NotificationType.PAYMENT)
        : false;

    if (proof.order.userId && canSendPaymentNotification) {
      await tx.notification.create({
        data: {
          userId: proof.order.userId,
          type: NotificationType.PAYMENT,
          title: isApprove ? "Payment verified" : "Payment proof rejected",
          message: isApprove
            ? `Your payment for order ${proof.order.orderNumber} has been verified.`
            : `Payment proof for order ${proof.order.orderNumber} was rejected. ${
                reviewNote ?? "Please upload a new proof."
              }`,
          metadata: {
            orderId: proof.order.id,
            action: input.action,
          },
        },
      });
    }

    return updatedProof;
  });

  return result;
}
