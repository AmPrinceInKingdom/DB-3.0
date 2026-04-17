import type { PayoutStatus } from "@prisma/client";

export type SellerPayoutAccountItem = {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  accountNumberMasked: string;
  branchName: string | null;
  swiftCode: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SellerPayoutItem = {
  id: string;
  amount: number;
  currencyCode: string;
  status: PayoutStatus;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SellerPayoutWorkspace = {
  summary: {
    totalPayouts: number;
    pendingCount: number;
    processingCount: number;
    paidCount: number;
    failedCount: number;
    latestPayoutAt: string | null;
    totalPaidByCurrency: Array<{
      currencyCode: string;
      totalAmount: number;
    }>;
  };
  accounts: SellerPayoutAccountItem[];
  payouts: SellerPayoutItem[];
};

export type AdminPayoutListItem = {
  id: string;
  seller: {
    userId: string;
    storeName: string;
    storeSlug: string;
    email: string;
    defaultPayoutAccount: {
      bankName: string;
      accountName: string;
      accountNumberMasked: string;
      branchName: string | null;
      swiftCode: string | null;
    } | null;
  };
  amount: number;
  currencyCode: string;
  status: PayoutStatus;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminPayoutWorkspace = {
  payouts: AdminPayoutListItem[];
  sellerOptions: Array<{
    userId: string;
    storeName: string;
    storeSlug: string;
    email: string;
  }>;
};
