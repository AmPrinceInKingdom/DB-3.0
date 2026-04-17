import type { AccountStatus, UserRole } from "@prisma/client";

export type SellerApplicationRecord = {
  userId: string;
  storeName: string;
  storeSlug: string;
  status: AccountStatus;
  supportEmail: string | null;
  supportPhone: string | null;
  taxId: string | null;
  description: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  userRole: UserRole;
};

export type SellerApplicationPayload = {
  application: SellerApplicationRecord | null;
};

export type SellerStoreProfile = {
  userId: string;
  storeName: string;
  storeSlug: string;
  status: AccountStatus;
  supportEmail: string | null;
  supportPhone: string | null;
  taxId: string | null;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  commissionRate: number;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  owner: {
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
};

export type SellerStoreProfilePayload = {
  profile: SellerStoreProfile | null;
};

export type AdminSellerListItem = {
  userId: string;
  storeName: string;
  storeSlug: string;
  status: AccountStatus;
  supportEmail: string | null;
  supportPhone: string | null;
  taxId: string | null;
  description: string | null;
  commissionRate: number;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  approvedBy: {
    id: string;
    email: string;
  } | null;
  user: {
    id: string;
    email: string;
    role: UserRole;
    status: AccountStatus;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
  };
};
