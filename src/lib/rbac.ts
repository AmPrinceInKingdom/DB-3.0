import type { UserRole } from "@prisma/client";

const roleOrder: Record<UserRole, number> = {
  CUSTOMER: 1,
  SELLER: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

export function hasMinimumRole(userRole: UserRole, minimumRole: UserRole) {
  return roleOrder[userRole] >= roleOrder[minimumRole];
}

export function hasAnyRole(userRole: UserRole, allowedRoles: UserRole[]) {
  return allowedRoles.includes(userRole);
}
