"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, ChevronLeft, ChevronRight, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { emitAdminNotificationsUpdated } from "@/lib/events/admin-notification-events";
import type { AdminNotificationsPayload } from "@/types/notification";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type NotificationTypeFilter =
  | "all"
  | "STOCK"
  | "ORDER"
  | "PAYMENT"
  | "REVIEW"
  | "PROMOTION"
  | "SYSTEM";
type NotificationReadFilter = "all" | "unread" | "read";

const NOTIFICATION_PAGE_SIZES = [10, 20, 50] as const;
const POLLING_INTERVAL_MS = 30_000;

function formatFilterLabel(value: string) {
  if (value === "all") return "All";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toMetadataMap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function buildPageWindow(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  let start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, start + 4);
  start = Math.max(1, end - 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function NotificationsManager() {
  const [payload, setPayload] = useState<AdminNotificationsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<NotificationTypeFilter>("all");
  const [readFilter, setReadFilter] = useState<NotificationReadFilter>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof NOTIFICATION_PAGE_SIZES)[number]>(20);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchInput.trim());
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [query, readFilter, typeFilter, limit]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (readFilter !== "all") params.set("read", readFilter);
    params.set("page", String(page));
    params.set("limit", String(limit));
    return params.toString();
  }, [limit, page, query, readFilter, typeFilter]);

  const loadNotifications = useCallback(
    async (options?: { silent?: boolean }) => {
      const shouldShowLoader = !options?.silent;
      if (shouldShowLoader) {
        setLoading(true);
      }
      setError(null);
      try {
        const response = await fetch(`/api/admin/notifications${queryString ? `?${queryString}` : ""}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as ApiEnvelope<AdminNotificationsPayload>;
        if (!response.ok || !data.success || !data.data) {
          throw new Error(data.error ?? "Unable to load notifications");
        }
        const nextPayload = data.data;
        setPayload(nextPayload);
        emitAdminNotificationsUpdated({ unreadCount: nextPayload.summary.unreadCount });
        setPage((currentPage) =>
          currentPage === nextPayload.pagination.page ? currentPage : nextPayload.pagination.page,
        );
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load notifications");
      } finally {
        if (shouldShowLoader) {
          setLoading(false);
        }
      }
    },
    [queryString],
  );

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadNotifications({ silent: true });
    }, POLLING_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadNotifications]);

  const toggleRead = async (notificationId: string, isRead: boolean) => {
    setUpdatingId(notificationId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/notifications/${notificationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead }),
      });
      const result = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Unable to update notification");
      }
      await loadNotifications({ silent: true });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update notification");
    } finally {
      setUpdatingId(null);
    }
  };

  const markAllAsRead = async () => {
    setMarkingAllRead(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/notifications/read-all", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(typeFilter !== "all" ? { type: typeFilter } : {}),
          ...(query ? { query } : {}),
        }),
      });
      const result = (await response.json()) as ApiEnvelope<{ updatedCount: number }>;
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Unable to mark notifications as read");
      }
      await loadNotifications({ silent: true });
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : "Unable to mark notifications as read");
    } finally {
      setMarkingAllRead(false);
    }
  };

  const pageNumbers = useMemo(() => {
    if (!payload) return [];
    return buildPageWindow(payload.pagination.page, payload.pagination.totalPages);
  }, [payload]);

  const showingStart = useMemo(() => {
    if (!payload || payload.summary.totalCount === 0) return 0;
    return (payload.pagination.page - 1) * payload.pagination.limit + 1;
  }, [payload]);

  const showingEnd = useMemo(() => {
    if (!payload || payload.summary.totalCount === 0) return 0;
    return Math.min(payload.pagination.page * payload.pagination.limit, payload.summary.totalCount);
  }, [payload]);

  return (
    <div className="space-y-4">
      <section className="grid gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-2 xl:grid-cols-6">
        <Input
          placeholder="Search title or message"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
        <Select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as NotificationTypeFilter)}
        >
          {(["all", "STOCK", "ORDER", "PAYMENT", "REVIEW", "PROMOTION", "SYSTEM"] as const).map((option) => (
            <option key={option} value={option}>
              Type: {formatFilterLabel(option)}
            </option>
          ))}
        </Select>
        <Select
          value={readFilter}
          onChange={(event) => setReadFilter(event.target.value as NotificationReadFilter)}
        >
          {(["all", "unread", "read"] as const).map((option) => (
            <option key={option} value={option}>
              {formatFilterLabel(option)}
            </option>
          ))}
        </Select>
        <Select
          value={String(limit)}
          onChange={(event) => setLimit(Number(event.target.value) as (typeof NOTIFICATION_PAGE_SIZES)[number])}
        >
          {NOTIFICATION_PAGE_SIZES.map((option) => (
            <option key={option} value={option}>
              Page Size: {option}
            </option>
          ))}
        </Select>
        <Button variant="outline" onClick={() => void loadNotifications()}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void markAllAsRead()}
          disabled={markingAllRead || (payload?.summary.filteredUnreadCount ?? 0) === 0}
        >
          <CheckCheck className="mr-2 h-4 w-4" />
          {markingAllRead ? "Marking..." : "Mark All Read"}
        </Button>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {payload ? (
        <section className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Total Notifications</p>
            <p className="mt-2 text-2xl font-bold">{payload.summary.totalCount}</p>
          </article>
          <article className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Unread Notifications</p>
            <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
              {payload.summary.unreadCount}
            </p>
          </article>
          <article className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Unread In Results</p>
            <p className="mt-2 text-2xl font-bold text-primary">{payload.summary.filteredUnreadCount}</p>
          </article>
        </section>
      ) : null}

      {loading && !payload ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Loading notifications...</p>
        </section>
      ) : !payload || payload.items.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">No notifications found for selected filters.</p>
        </section>
      ) : (
        <section className="space-y-3">
          {payload.items.map((item) => {
            const metadata = toMetadataMap(item.metadata);
            const source = typeof metadata?.source === "string" ? metadata.source : null;
            const stockQuantity =
              typeof metadata?.stockQuantity === "number" ? metadata.stockQuantity : null;
            return (
              <article
                key={item.id}
                className={`space-y-3 rounded-xl border p-4 ${
                  item.isRead ? "border-border bg-card" : "border-amber-500/40 bg-amber-500/5"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill value={item.type} />
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        item.isRead
                          ? "bg-muted text-muted-foreground"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      {item.isRead ? "Read" : "Unread"}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">{item.message}</p>

                {source || stockQuantity !== null ? (
                  <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                    <p className="flex items-center gap-2">
                      <Bell className="h-3.5 w-3.5" />
                      Source: {source ?? "-"}
                      {stockQuantity !== null ? ` | Current stock: ${stockQuantity}` : ""}
                    </p>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updatingId === item.id}
                    onClick={() => void toggleRead(item.id, !item.isRead)}
                  >
                    {updatingId === item.id
                      ? "Updating..."
                      : item.isRead
                        ? "Mark Unread"
                        : "Mark Read"}
                  </Button>
                  {item.linkUrl ? (
                    <Button size="sm" asChild>
                      <Link href={item.linkUrl}>Open Related Page</Link>
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}

          <footer className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Showing {showingStart}-{showingEnd} of {payload.summary.totalCount} notifications
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={loading || !payload.pagination.hasPreviousPage}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Prev
                </Button>
                {pageNumbers.map((pageNumber) => (
                  <Button
                    key={pageNumber}
                    size="sm"
                    variant={pageNumber === payload.pagination.page ? "primary" : "outline"}
                    onClick={() => setPage(pageNumber)}
                    disabled={loading}
                  >
                    {pageNumber}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setPage((current) =>
                      Math.min(payload.pagination.totalPages, current + 1),
                    )
                  }
                  disabled={loading || !payload.pagination.hasNextPage}
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          </footer>
        </section>
      )}
    </div>
  );
}
