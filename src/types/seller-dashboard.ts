import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  StockStatus,
} from "@prisma/client";

export type SellerDashboardSummary = {
  revenueLast30DaysBase: number;
  ordersLast30Days: number;
  paidOrdersLast30Days: number;
  avgOrderValueLast30Base: number;
  pendingOrders: number;
  processingOrders: number;
  activeProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  payoutPendingCount: number;
  payoutProcessingCount: number;
  lastPayoutAt: string | null;
};

export type SellerDashboardRevenuePoint = {
  date: string;
  orders: number;
  revenueBase: number;
};

export type SellerDashboardRecentOrder = {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  currencyCode: string;
  customerEmail: string;
  sellerSubtotal: number;
  sellerUnits: number;
  sellerItems: number;
  totalOrderItems: number;
  isMultiSellerOrder: boolean;
};

export type SellerDashboardTopProduct = {
  productId: string | null;
  name: string;
  sku: string | null;
  stockStatus: StockStatus | null;
  stockQuantity: number | null;
  mainImageUrl: string | null;
  unitsSoldLast30Days: number;
  ordersLast30Days: number;
  revenueLast30DaysBase: number;
};

export type SellerDashboardLowStockProduct = {
  id: string;
  name: string;
  sku: string;
  stockStatus: StockStatus;
  stockQuantity: number;
  minStockLevel: number;
  updatedAt: string;
};

export type SellerDashboardPayload = {
  generatedAt: string;
  rangeDays: number;
  currencyCode: string;
  summary: SellerDashboardSummary;
  revenueTrend: SellerDashboardRevenuePoint[];
  recentOrders: SellerDashboardRecentOrder[];
  topProducts: SellerDashboardTopProduct[];
  lowStockProducts: SellerDashboardLowStockProduct[];
};
