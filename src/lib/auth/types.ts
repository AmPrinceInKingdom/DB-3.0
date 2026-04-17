import type { UserRole } from "@prisma/client";

export type SessionPayload = {
  sub: string;
  email: string;
  role: UserRole;
};

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
};
