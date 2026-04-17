import { OrderStatus, ShipmentStatus } from "@prisma/client";
import { z } from "zod";

const optionalText = z.string().trim().optional().or(z.literal(""));
const sellerAllowedOrderStatuses = new Set<OrderStatus>([
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
]);
const sellerAllowedShipmentStatuses = new Set<ShipmentStatus>([
  ShipmentStatus.PACKED,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.DELIVERED,
  ShipmentStatus.FAILED,
]);

export const adminOrderStatusUpdateSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  note: optionalText,
});

export const paymentProofReviewSchema = z
  .object({
    action: z.enum(["APPROVE", "REJECT"]),
    reason: optionalText,
  })
  .superRefine((value, context) => {
    if (value.action === "REJECT" && (!value.reason || value.reason.trim().length < 3)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "Please provide a rejection reason",
      });
    }
  });

export const adminOrderTrackingUpdateSchema = z
  .object({
    trackingNumber: optionalText,
    courierName: optionalText,
    shipmentStatus: z.nativeEnum(ShipmentStatus).optional(),
    note: optionalText,
  })
  .superRefine((value, context) => {
    const hasTracking = Boolean(value.trackingNumber && value.trackingNumber.trim().length > 0);
    const hasCourier = Boolean(value.courierName && value.courierName.trim().length > 0);
    const hasStatus = Boolean(value.shipmentStatus);
    const hasNote = Boolean(value.note && value.note.trim().length > 0);

    if (!hasTracking && !hasCourier && !hasStatus && !hasNote) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["trackingNumber"],
        message: "Provide at least one tracking update value",
      });
    }

    if (
      value.shipmentStatus &&
      (value.shipmentStatus === ShipmentStatus.IN_TRANSIT ||
        value.shipmentStatus === ShipmentStatus.DELIVERED) &&
      !hasTracking
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["trackingNumber"],
        message: "Tracking number is required for in-transit or delivered updates",
      });
    }
  });

export const sellerOrderStatusUpdateSchema = z
  .object({
    status: z.nativeEnum(OrderStatus),
    note: optionalText,
  })
  .superRefine((value, context) => {
    if (!sellerAllowedOrderStatuses.has(value.status)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: "Sellers can only move orders to Processing, Shipped, or Delivered",
      });
    }
  });

export const sellerOrderTrackingUpdateSchema = z
  .object({
    trackingNumber: optionalText,
    courierName: optionalText,
    shipmentStatus: z.nativeEnum(ShipmentStatus).optional(),
    note: optionalText,
  })
  .superRefine((value, context) => {
    const hasTracking = Boolean(value.trackingNumber && value.trackingNumber.trim().length > 0);
    const hasCourier = Boolean(value.courierName && value.courierName.trim().length > 0);
    const hasStatus = Boolean(value.shipmentStatus);
    const hasNote = Boolean(value.note && value.note.trim().length > 0);

    if (!hasTracking && !hasCourier && !hasStatus && !hasNote) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["trackingNumber"],
        message: "Provide at least one tracking update value",
      });
    }

    if (value.shipmentStatus && !sellerAllowedShipmentStatuses.has(value.shipmentStatus)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shipmentStatus"],
        message: "Sellers can set shipment to Packed, In Transit, Delivered, or Failed",
      });
    }

    if (
      value.shipmentStatus &&
      (value.shipmentStatus === ShipmentStatus.IN_TRANSIT ||
        value.shipmentStatus === ShipmentStatus.DELIVERED) &&
      !hasTracking
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["trackingNumber"],
        message: "Tracking number is required for in-transit or delivered updates",
      });
    }
  });

export type AdminOrderStatusUpdateInput = z.infer<typeof adminOrderStatusUpdateSchema>;
export type PaymentProofReviewInput = z.infer<typeof paymentProofReviewSchema>;
export type AdminOrderTrackingUpdateInput = z.infer<typeof adminOrderTrackingUpdateSchema>;
export type SellerOrderStatusUpdateInput = z.infer<typeof sellerOrderStatusUpdateSchema>;
export type SellerOrderTrackingUpdateInput = z.infer<typeof sellerOrderTrackingUpdateSchema>;
