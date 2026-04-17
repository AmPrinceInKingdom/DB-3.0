import type { AccountStatus, UserRole } from "@prisma/client";

export type AdminUserListItem = {
  id: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  phone: string | null;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  profile: {
    firstName: string | null;
    lastName: string | null;
  } | null;
  admin: {
    canManageAdmins: boolean;
  } | null;
  seller: {
    storeName: string;
    status: AccountStatus;
  } | null;
  orderCount: number;
  pendingEmailVerificationTokens: number;
  pendingEmailVerificationOtps: number;
  lastVerificationAudit: {
    action: string;
    createdAt: string;
    actorEmail: string | null;
  } | null;
};
