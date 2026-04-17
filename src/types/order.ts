import type { OrderStatus, PaymentMethod, PaymentStatus, ShipmentStatus } from "@prisma/client";

export type CustomerOrderListItem = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  currencyCode: string;
  grandTotal: number;
  createdAt: string;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    lineTotal: number;
  }>;
};

export type CustomerOrderDetail = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  currencyCode: string;
  subtotal: number;
  shippingFee: number;
  taxTotal: number;
  grandTotal: number;
  customerEmail: string;
  customerPhone: string | null;
  trackingNumber: string | null;
  notes: string | null;
  placedAt: string;
  deliveredAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  shippingMethod: {
    code: string;
    name: string;
    estimatedDaysMin: number;
    estimatedDaysMax: number;
  } | null;
  items: Array<{
    id: string;
    productName: string;
    variantName: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  statusHistory: Array<{
    id: string;
    oldStatus: OrderStatus | null;
    newStatus: OrderStatus;
    note: string | null;
    createdAt: string;
  }>;
  paymentProofs: Array<{
    id: string;
    fileName: string | null;
    verificationStatus: PaymentStatus;
    rejectionReason: string | null;
    createdAt: string;
  }>;
};

export type AdminOrderListItem = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  currencyCode: string;
  grandTotal: number;
  customerEmail: string;
  customerPhone: string | null;
  trackingNumber: string | null;
  createdAt: string;
  customer: {
    id: string;
    email: string;
    profile: {
      firstName: string | null;
      lastName: string | null;
    } | null;
  } | null;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    lineTotal: number;
  }>;
};

export type AdminPaymentProofItem = {
  id: string;
  fileUrl: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: string | null;
  verificationStatus: PaymentStatus;
  rejectionReason: string | null;
  createdAt: string;
  verifiedAt: string | null;
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    paymentMethod: PaymentMethod;
    currencyCode: string;
    grandTotal: number;
    customerEmail: string;
    customerPhone: string | null;
    userId: string | null;
  };
  uploader: {
    id: string;
    email: string;
  } | null;
  verifier: {
    id: string;
    email: string;
  } | null;
};

export type AdminPaymentWebhookEventItem = {
  id: string;
  provider: string;
  eventId: string | null;
  eventType: string;
  reference: string | null;
  handled: boolean;
  success: boolean;
  paymentStatus: PaymentStatus | null;
  orderStatus: OrderStatus | null;
  errorCode: string | null;
  errorMessage: string | null;
  payload: unknown;
  createdAt: string;
  order: {
    id: string;
    orderNumber: string;
  } | null;
  payment: {
    id: string;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
  } | null;
};

export type AdminPaymentAuditLogItem = {
  id: string;
  action: string;
  targetTable: string | null;
  targetId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  oldValues: unknown;
  newValues: unknown;
  createdAt: string;
  actor: {
    id: string;
    email: string;
  } | null;
};

export type AdminPaymentAuditLogPage = {
  items: AdminPaymentAuditLogItem[];
  page: number;
  limit: number;
  hasMore: boolean;
};

export type AdminOrderDetail = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  currencyCode: string;
  exchangeRateToBase: number;
  subtotal: number;
  discountTotal: number;
  shippingFee: number;
  taxTotal: number;
  grandTotal: number;
  customerEmail: string;
  customerPhone: string | null;
  trackingNumber: string | null;
  notes: string | null;
  adminNotes: string | null;
  placedAt: string;
  deliveredAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    email: string;
    profile: {
      firstName: string | null;
      lastName: string | null;
    } | null;
  } | null;
  billingAddress: {
    id: string;
    label: string;
    firstName: string;
    lastName: string;
    company: string | null;
    phone: string | null;
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    postalCode: string | null;
    countryCode: string;
  } | null;
  shippingAddress: {
    id: string;
    label: string;
    firstName: string;
    lastName: string;
    company: string | null;
    phone: string | null;
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    postalCode: string | null;
    countryCode: string;
  } | null;
  shippingMethod: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    estimatedDaysMin: number;
    estimatedDaysMax: number;
  } | null;
  items: Array<{
    id: string;
    productId: string | null;
    variantId: string | null;
    productName: string;
    sku: string | null;
    variantName: string | null;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    currencyCode: string;
    metadata: unknown;
  }>;
  statusHistory: Array<{
    id: string;
    oldStatus: OrderStatus | null;
    newStatus: OrderStatus;
    note: string | null;
    createdAt: string;
    changer: {
      id: string;
      email: string;
    } | null;
  }>;
  payment: {
    id: string;
    paymentStatus: PaymentStatus;
    paymentMethod: PaymentMethod;
    transactionReference: string | null;
    gateway: string | null;
    amount: number;
    currencyCode: string;
    paidAt: string | null;
    failureReason: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  paymentProofs: Array<{
    id: string;
    fileUrl: string;
    fileName: string | null;
    verificationStatus: PaymentStatus;
    rejectionReason: string | null;
    createdAt: string;
    verifiedAt: string | null;
    uploader: {
      id: string;
      email: string;
    } | null;
    verifier: {
      id: string;
      email: string;
    } | null;
  }>;
  shipment: {
    id: string;
    status: ShipmentStatus;
    trackingNumber: string | null;
    courierName: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    shippingMethod: {
      id: string;
      code: string;
      name: string;
    } | null;
  } | null;
};
