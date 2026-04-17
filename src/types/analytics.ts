export type AdminAnalyticsPayload = {
  rangeDays: number;
  summary: {
    totalRevenue: number;
    previousPeriodRevenue: number;
    revenueChangePercent: number | null;
    totalOrders: number;
    paidOrders: number;
    paymentSuccessCount: number;
    paymentPendingCount: number;
    paymentFailedCount: number;
    paymentAwaitingVerificationCount: number;
    paymentSuccessRatePercent: number | null;
    pendingOrders: number;
    totalCustomers: number;
    totalProducts: number;
    pendingPaymentVerifications: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  trends: Array<{
    date: string;
    revenue: number;
    orders: number;
    paidOrders: number;
  }>;
  paymentMethodUsage: Array<{
    method: string;
    count: number;
  }>;
  topProducts: Array<{
    productId: string | null;
    name: string;
    unitsSold: number;
    revenue: number;
  }>;
  topCategories: Array<{
    category: string;
    revenue: number;
  }>;
  customerGrowth: Array<{
    month: string;
    customers: number;
  }>;
  lowStockAlerts: Array<{
    id: string;
    name: string;
    sku: string;
    stockQuantity: number;
    minStockLevel: number;
    stockStatus: string;
  }>;
};

export type SellerAnalyticsPayload = {
  rangeDays: number;
  currencyCode: string;
  summary: {
    totalRevenueBase: number;
    previousPeriodRevenueBase: number;
    revenueChangePercent: number | null;
    totalOrders: number;
    paidOrders: number;
    processingOrders: number;
    shippedOrders: number;
    deliveredOrders: number;
    avgOrderValueBase: number;
    activeProducts: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  trends: Array<{
    date: string;
    revenueBase: number;
    orders: number;
    units: number;
  }>;
  paymentMethodUsage: Array<{
    method: string;
    count: number;
  }>;
  orderStatusBreakdown: Array<{
    status: string;
    count: number;
  }>;
  topProducts: Array<{
    productId: string | null;
    name: string;
    unitsSold: number;
    ordersCount: number;
    revenueBase: number;
    stockQuantity: number | null;
    stockStatus: string | null;
  }>;
  monthlyRevenue: Array<{
    month: string;
    revenueBase: number;
    orders: number;
  }>;
  lowStockAlerts: Array<{
    id: string;
    name: string;
    sku: string;
    stockQuantity: number;
    minStockLevel: number;
    stockStatus: string;
  }>;
};
