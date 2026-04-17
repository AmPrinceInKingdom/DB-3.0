import type { OrderStatus, PaymentMethod, PaymentStatus, ShipmentStatus } from "@prisma/client";

export type SellerOrderItem = {
  id: string;
  productId: string | null;
  productName: string;
  sku: string | null;
  variantName: string | null;
  quantity: number;
  lineTotal: number;
  currencyCode: string;
};

export type SellerOrderListItem = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  currencyCode: string;
  grandTotal: number;
  sellerSubtotal: number;
  sellerItemCount: number;
  sellerUnits: number;
  totalOrderItemCount: number;
  isMultiSellerOrder: boolean;
  customerEmail: string;
  customerPhone: string | null;
  trackingNumber: string | null;
  createdAt: string;
  shipment: {
    status: ShipmentStatus;
    trackingNumber: string | null;
    courierName: string | null;
    updatedAt: string;
  } | null;
  items: SellerOrderItem[];
};
