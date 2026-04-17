"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AccountStatus, UserRole } from "@prisma/client";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import type { AdminUserListItem } from "@/types/user";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

const roleOptions: UserRole[] = ["CUSTOMER", "SELLER", "ADMIN", "SUPER_ADMIN"];
const statusOptions: AccountStatus[] = ["ACTIVE", "PENDING", "SUSPENDED", "DELETED"];

type UserDraftState = {
  role: UserRole;
  status: AccountStatus;
};

type VerificationAction = "RESEND_EMAIL_LINK" | "RESEND_OTP" | "REVOKE_PENDING";

type VerificationActionResult = {
  targetUserId: string;
  targetEmail: string;
  action: VerificationAction;
  message: string;
  debugVerificationUrl?: string;
  debugOtpCode?: string;
  tokenExpiresAt?: string;
  otpExpiresAt?: string;
  revokedTokens?: number;
  revokedOtps?: number;
};

function formatRole(value: UserRole) {
  return value.replaceAll("_", " ");
}

function formatVerificationAction(value: string) {
  return value
    .replace("ADMIN_USER_VERIFICATION_", "")
    .replaceAll("_", " ")
    .trim();
}

export function UsersManager() {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, UserDraftState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [statusFilter, setStatusFilter] = useState<AccountStatus | "">("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [verificationActionUserId, setVerificationActionUserId] = useState<string | null>(null);
  const [verificationResults, setVerificationResults] = useState<
    Record<string, VerificationActionResult | null>
  >({});

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (roleFilter) params.set("role", roleFilter);
    if (statusFilter) params.set("status", statusFilter);
    return params.toString();
  }, [query, roleFilter, statusFilter]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users${queryParams ? `?${queryParams}` : ""}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiEnvelope<AdminUserListItem[]>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to load users");
      }

      const records = payload.data ?? [];
      setUsers(records);
      setDrafts((current) => {
        const next = { ...current };
        for (const user of records) {
          next[user.id] = next[user.id] ?? { role: user.role, status: user.status };
        }
        return next;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load users");
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const hasDraftChanges = (user: AdminUserListItem) => {
    const draft = drafts[user.id];
    if (!draft) return false;
    return draft.role !== user.role || draft.status !== user.status;
  };

  const saveUserChanges = async (user: AdminUserListItem) => {
    const draft = drafts[user.id];
    if (!draft) return;

    const payload: Partial<UserDraftState> = {};
    if (draft.role !== user.role) payload.role = draft.role;
    if (draft.status !== user.status) payload.status = draft.status;
    if (!payload.role && !payload.status) return;

    setUpdatingUserId(user.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Unable to update user");
      }

      await loadUsers();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update user");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const runVerificationAction = async (
    user: AdminUserListItem,
    action: VerificationAction,
  ) => {
    setVerificationActionUserId(user.id);
    setError(null);
    setVerificationResults((current) => ({ ...current, [user.id]: null }));

    try {
      const response = await fetch(`/api/admin/users/${user.id}/verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json()) as ApiEnvelope<VerificationActionResult>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to run verification action");
      }

      setVerificationResults((current) => ({
        ...current,
        [user.id]: payload.data ?? null,
      }));
      await loadUsers();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to run verification action",
      );
    } finally {
      setVerificationActionUserId(null);
    }
  };

  return (
    <div className="space-y-4">
      <section className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Search name, email, or phone"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as UserRole | "")}>
          <option value="">All Roles</option>
          {roleOptions.map((role) => (
            <option key={role} value={role}>
              {formatRole(role)}
            </option>
          ))}
        </Select>
        <Select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as AccountStatus | "")}
        >
          <option value="">All Statuses</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
        <Button variant="outline" onClick={() => void loadUsers()}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Loading users...</p>
        </section>
      ) : users.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">No users found for selected filters.</p>
        </section>
      ) : (
        <section className="space-y-3">
          {users.map((user) => (
            <article key={user.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    {(user.profile?.firstName || user.profile?.lastName
                      ? `${user.profile?.firstName ?? ""} ${user.profile?.lastName ?? ""}`
                      : "Unnamed User"
                    ).trim()}
                  </p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    {formatRole(user.role)}
                  </span>
                  <StatusPill value={user.status} />
                </div>
              </div>

              <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <p className="text-muted-foreground">
                  Phone: <span className="font-semibold text-foreground">{user.phone ?? "-"}</span>
                </p>
                <p className="text-muted-foreground">
                  Orders: <span className="font-semibold text-foreground">{user.orderCount}</span>
                </p>
                <p className="text-muted-foreground">
                  Joined:{" "}
                  <span className="font-semibold text-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Last Login:{" "}
                  <span className="font-semibold text-foreground">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}
                  </span>
                </p>
              </div>

              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p className="text-muted-foreground">
                  Email Verified:{" "}
                  <span className="font-semibold text-foreground">
                    {user.emailVerifiedAt ? "Yes" : "No"}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Seller Store:{" "}
                  <span className="font-semibold text-foreground">{user.seller?.storeName ?? "-"}</span>
                </p>
              </div>

              {user.role === "CUSTOMER" ? (
                <section className="space-y-2 rounded-xl border border-border bg-background p-3">
                  <div className="grid gap-1 text-xs sm:grid-cols-2">
                    <p className="text-muted-foreground">
                      Pending Email Tokens:{" "}
                      <span className="font-semibold text-foreground">
                        {user.pendingEmailVerificationTokens}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      Pending OTP Codes:{" "}
                      <span className="font-semibold text-foreground">
                        {user.pendingEmailVerificationOtps}
                      </span>
                    </p>
                  </div>

                  {user.lastVerificationAudit ? (
                    <p className="text-xs text-muted-foreground">
                      Last verification action:{" "}
                      <span className="font-semibold text-foreground">
                        {formatVerificationAction(user.lastVerificationAudit.action)}
                      </span>{" "}
                      by{" "}
                      <span className="font-semibold text-foreground">
                        {user.lastVerificationAudit.actorEmail ?? "System"}
                      </span>{" "}
                      on{" "}
                      <span className="font-semibold text-foreground">
                        {new Date(user.lastVerificationAudit.createdAt).toLocaleString()}
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No verification audit actions yet.
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void runVerificationAction(user, "RESEND_EMAIL_LINK")}
                      disabled={
                        verificationActionUserId === user.id ||
                        Boolean(user.emailVerifiedAt)
                      }
                    >
                      Resend Link
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void runVerificationAction(user, "RESEND_OTP")}
                      disabled={
                        verificationActionUserId === user.id ||
                        Boolean(user.emailVerifiedAt)
                      }
                    >
                      Resend OTP
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void runVerificationAction(user, "REVOKE_PENDING")}
                      disabled={verificationActionUserId === user.id}
                    >
                      Revoke Pending
                    </Button>
                  </div>

                  {verificationResults[user.id] ? (
                    <div className="space-y-1 rounded-lg border border-primary/30 bg-primary/5 p-2 text-xs">
                      <p className="font-semibold text-primary">
                        {verificationResults[user.id]?.message}
                      </p>
                      {verificationResults[user.id]?.debugVerificationUrl ? (
                        <p className="break-all text-primary">
                          Dev Link: {verificationResults[user.id]?.debugVerificationUrl}
                        </p>
                      ) : null}
                      {verificationResults[user.id]?.debugOtpCode ? (
                        <p className="text-primary">
                          Dev OTP: {verificationResults[user.id]?.debugOtpCode}
                        </p>
                      ) : null}
                      {verificationResults[user.id]?.action === "REVOKE_PENDING" ? (
                        <p className="text-primary">
                          Revoked tokens: {verificationResults[user.id]?.revokedTokens ?? 0} |
                          Revoked OTPs: {verificationResults[user.id]?.revokedOtps ?? 0}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              ) : null}

              {user.admin?.canManageAdmins ? (
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  This account has admin-management privileges.
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Select
                  className="min-w-[170px]"
                  value={drafts[user.id]?.role ?? user.role}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [user.id]: {
                        role: event.target.value as UserRole,
                        status: current[user.id]?.status ?? user.status,
                      },
                    }))
                  }
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {formatRole(role)}
                    </option>
                  ))}
                </Select>

                <Select
                  className="min-w-[170px]"
                  value={drafts[user.id]?.status ?? user.status}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [user.id]: {
                        role: current[user.id]?.role ?? user.role,
                        status: event.target.value as AccountStatus,
                      },
                    }))
                  }
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status.replaceAll("_", " ")}
                    </option>
                  ))}
                </Select>

                <Button
                  size="sm"
                  type="button"
                  onClick={() => void saveUserChanges(user)}
                  disabled={updatingUserId === user.id || !hasDraftChanges(user)}
                >
                  {updatingUserId === user.id ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
