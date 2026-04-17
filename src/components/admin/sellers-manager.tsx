"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AccountStatus } from "@prisma/client";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { useToastStore } from "@/store/toast-store";
import type { AdminSellerListItem } from "@/types/seller";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type SellerAction = "APPROVE" | "SUSPEND" | "REJECT";

const sellerStatusFilters: Array<{ label: string; value: AccountStatus | "" }> = [
  { label: "All Statuses", value: "" },
  { label: "Pending", value: "PENDING" },
  { label: "Active", value: "ACTIVE" },
  { label: "Suspended", value: "SUSPENDED" },
];

function fullName(firstName: string | null, lastName: string | null) {
  const merged = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return merged.length ? merged : "Unnamed";
}

export function SellersManager() {
  const pushToast = useToastStore((state) => state.pushToast);
  const [items, setItems] = useState<AdminSellerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AccountStatus | "">("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (status) params.set("status", status);
    return params.toString();
  }, [query, status]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/sellers${queryString ? `?${queryString}` : ""}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiEnvelope<AdminSellerListItem[]>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to load seller applications");
      }
      setItems(payload.data ?? []);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Unable to load seller applications";
      setError(message);
      pushToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [pushToast, queryString]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const applyAction = async (sellerUserId: string, action: SellerAction) => {
    setUpdatingId(sellerUserId);
    setError(null);
    try {
      const reason = reasons[sellerUserId]?.trim();
      const response = await fetch(`/api/admin/sellers/${sellerUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(reason ? { reason } : {}),
        }),
      });
      const payload = (await response.json()) as ApiEnvelope<AdminSellerListItem>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to update seller application");
      }

      setItems((current) =>
        current.map((item) => (item.userId === sellerUserId ? payload.data! : item)),
      );
      pushToast("Seller application updated", "success");
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : "Unable to update seller application";
      setError(message);
      pushToast(message, "error");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <section className="grid gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-3">
        <Input
          placeholder="Search store, slug, email, phone"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select value={status} onChange={(event) => setStatus(event.target.value as AccountStatus | "")}>
          {sellerStatusFilters.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Button variant="outline" onClick={() => void loadItems()}>
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
          <p className="text-sm text-muted-foreground">Loading seller applications...</p>
        </section>
      ) : items.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">No seller applications found for selected filters.</p>
        </section>
      ) : (
        <section className="space-y-3">
          {items.map((item) => {
            const busy = updatingId === item.userId;
            return (
              <article key={item.userId} className="space-y-3 rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{item.storeName}</p>
                    <p className="text-xs text-muted-foreground">{item.storeSlug}</p>
                  </div>
                  <StatusPill value={item.status} />
                </div>

                <div className="grid gap-2 text-sm md:grid-cols-2">
                  <p className="text-muted-foreground">
                    Seller:{" "}
                    <span className="font-semibold text-foreground">
                      {fullName(item.user.firstName, item.user.lastName)}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    Email: <span className="font-semibold text-foreground">{item.user.email}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Role: <span className="font-semibold text-foreground">{item.user.role}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Phone: <span className="font-semibold text-foreground">{item.supportPhone ?? "-"}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Support Email:{" "}
                    <span className="font-semibold text-foreground">{item.supportEmail ?? "-"}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Tax ID: <span className="font-semibold text-foreground">{item.taxId ?? "-"}</span>
                  </p>
                </div>

                {item.description ? (
                  <p className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                ) : null}

                <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                  <p>Applied: {new Date(item.createdAt).toLocaleString()}</p>
                  <p>Updated: {new Date(item.updatedAt).toLocaleString()}</p>
                  <p>
                    Approved At: {item.approvedAt ? new Date(item.approvedAt).toLocaleString() : "-"}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">Admin Note (Optional)</label>
                  <Input
                    value={reasons[item.userId] ?? ""}
                    onChange={(event) =>
                      setReasons((current) => ({
                        ...current,
                        [item.userId]: event.target.value,
                      }))
                    }
                    placeholder="Reason for approve/reject/suspend"
                    disabled={busy}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {item.status !== "ACTIVE" ? (
                    <Button
                      size="sm"
                      onClick={() => void applyAction(item.userId, "APPROVE")}
                      disabled={busy}
                    >
                      {busy ? "Updating..." : "Approve"}
                    </Button>
                  ) : null}
                  {item.status === "PENDING" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void applyAction(item.userId, "REJECT")}
                      disabled={busy}
                    >
                      {busy ? "Updating..." : "Reject"}
                    </Button>
                  ) : null}
                  {item.status === "ACTIVE" ? (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => void applyAction(item.userId, "SUSPEND")}
                      disabled={busy}
                    >
                      {busy ? "Updating..." : "Suspend"}
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
