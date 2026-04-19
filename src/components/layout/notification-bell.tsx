"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, ExternalLink, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { emitAdminNotificationsUpdated } from "@/lib/events/admin-notification-events";
import type { NotificationsPayload } from "@/types/notification";
import type { AccountNotificationSettingsPayload } from "@/types/settings";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type Props = {
  title: string;
  notificationsEndpoint: string;
  notificationUpdateBasePath: string;
  markAllEndpoint: string;
  viewAllHref: string;
  emptyMessage?: string;
  quickPushToggleEndpoint?: string;
  settingsHref?: string;
  realtimeStreamEndpoint?: string;
};

const POLLING_INTERVAL_MS = 30_000;
const STREAM_RECONNECT_DELAY_MS = 4_000;

function resolveStreamEnabled() {
  const rawFlag = process.env.NEXT_PUBLIC_ENABLE_NOTIFICATION_STREAM?.trim().toLowerCase();
  if (rawFlag === "1" || rawFlag === "true") return true;
  if (rawFlag === "0" || rawFlag === "false") return false;
  return process.env.NODE_ENV !== "production";
}

function formatBadgeCount(value: number) {
  if (value > 99) return "99+";
  return String(value);
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return "Now";

  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export function NotificationBell({
  title,
  notificationsEndpoint,
  notificationUpdateBasePath,
  markAllEndpoint,
  viewAllHref,
  emptyMessage = "No notifications yet.",
  quickPushToggleEndpoint,
  settingsHref = "/account/settings",
  realtimeStreamEndpoint,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<NotificationsPayload | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [markAllBusy, setMarkAllBusy] = useState(false);
  const [settingsPayload, setSettingsPayload] = useState<AccountNotificationSettingsPayload | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [liveUnreadCount, setLiveUnreadCount] = useState<number | null>(null);
  const shouldUseRealtimeStream = Boolean(realtimeStreamEndpoint) && resolveStreamEnabled();

  const unreadCount = liveUnreadCount ?? payload?.summary.unreadCount ?? 0;
  const previewItems = useMemo(() => payload?.items ?? [], [payload?.items]);
  const pushEnabled = settingsPayload?.preferences.channels.push ?? true;

  const loadNotifications = useCallback(
    async (options?: { silent?: boolean }) => {
      const shouldShowLoader = !options?.silent;
      if (shouldShowLoader) {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await fetch(`${notificationsEndpoint}?page=1&limit=6`, {
          cache: "no-store",
        });
        const data = (await response.json()) as ApiEnvelope<NotificationsPayload>;
        if (!response.ok || !data.success || !data.data) {
          throw new Error(data.error ?? "Unable to load notifications");
        }
        setPayload(data.data);
        setLiveUnreadCount(data.data.summary.unreadCount);
        if (notificationsEndpoint.startsWith("/api/admin/notifications")) {
          emitAdminNotificationsUpdated({ unreadCount: data.data.summary.unreadCount });
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load notifications");
      } finally {
        if (shouldShowLoader) {
          setLoading(false);
        }
      }
    },
    [notificationsEndpoint],
  );

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (shouldUseRealtimeStream) {
      return;
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadNotifications({ silent: true });
    }, POLLING_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadNotifications, shouldUseRealtimeStream]);

  useEffect(() => {
    if (!shouldUseRealtimeStream || !realtimeStreamEndpoint) return;

    let isDisposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let eventSource: EventSource | null = null;

    const connect = () => {
      if (isDisposed) return;

      eventSource = new EventSource(realtimeStreamEndpoint);
      const handleUnreadMessage = (rawEvent: MessageEvent<string>) => {
        try {
          const parsed = JSON.parse(rawEvent.data) as { unreadCount?: unknown };
          if (typeof parsed.unreadCount !== "number" || !Number.isFinite(parsed.unreadCount)) {
            return;
          }

          const nextUnreadCount = Math.max(0, Math.floor(parsed.unreadCount));
          setLiveUnreadCount(nextUnreadCount);

          if (notificationsEndpoint.startsWith("/api/admin/notifications")) {
            emitAdminNotificationsUpdated({ unreadCount: nextUnreadCount });
          }
        } catch {
          // Ignore malformed stream messages.
        }
      };
      eventSource.onmessage = handleUnreadMessage;
      eventSource.addEventListener("unread", handleUnreadMessage as EventListener);

      eventSource.onerror = () => {
        eventSource?.close();
        if (isDisposed) return;
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
        }
        reconnectTimer = setTimeout(() => {
          connect();
        }, STREAM_RECONNECT_DELAY_MS);
      };
    };

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      eventSource?.close();
    };
  }, [notificationsEndpoint, realtimeStreamEndpoint, shouldUseRealtimeStream]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target || !wrapperRef.current) return;
      if (!wrapperRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  const loadSettings = useCallback(async () => {
    if (!quickPushToggleEndpoint) return;
    setSettingsLoading(true);
    setError(null);
    try {
      const response = await fetch(quickPushToggleEndpoint, { cache: "no-store" });
      const data = (await response.json()) as ApiEnvelope<AccountNotificationSettingsPayload>;
      if (!response.ok || !data.success || !data.data) {
        throw new Error(data.error ?? "Unable to load preferences");
      }
      setSettingsPayload(data.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load preferences");
    } finally {
      setSettingsLoading(false);
    }
  }, [quickPushToggleEndpoint]);

  useEffect(() => {
    if (!isOpen || !quickPushToggleEndpoint || settingsPayload) return;
    void loadSettings();
  }, [isOpen, loadSettings, quickPushToggleEndpoint, settingsPayload]);

  const handleMarkRead = async (notificationId: string) => {
    setUpdatingId(notificationId);
    setError(null);
    try {
      const response = await fetch(`${notificationUpdateBasePath}/${notificationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });

      const result = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Unable to mark notification as read");
      }
      await loadNotifications({ silent: true });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update notification");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkAllBusy(true);
    setError(null);
    try {
      const response = await fetch(markAllEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = (await response.json()) as ApiEnvelope<{ updatedCount: number }>;
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Unable to mark all notifications as read");
      }
      await loadNotifications({ silent: true });
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : "Unable to update notifications");
    } finally {
      setMarkAllBusy(false);
    }
  };

  const handleTogglePush = async () => {
    if (!quickPushToggleEndpoint) return;

    setToggleBusy(true);
    setError(null);
    try {
      const currentSettings = settingsPayload ?? (await (async () => {
        const response = await fetch(quickPushToggleEndpoint, { cache: "no-store" });
        const data = (await response.json()) as ApiEnvelope<AccountNotificationSettingsPayload>;
        if (!response.ok || !data.success || !data.data) {
          throw new Error(data.error ?? "Unable to load preferences");
        }
        return data.data;
      })());

      const nextPreferences = {
        ...currentSettings.preferences,
        channels: {
          ...currentSettings.preferences.channels,
          push: !currentSettings.preferences.channels.push,
        },
      };

      const response = await fetch(quickPushToggleEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: nextPreferences }),
      });
      const result = (await response.json()) as ApiEnvelope<AccountNotificationSettingsPayload>;
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error ?? "Unable to update preferences");
      }

      setSettingsPayload(result.data);
      await loadNotifications({ silent: true });
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Unable to update preferences");
    } finally {
      setToggleBusy(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Notifications (${unreadCount} unread)`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {formatBadgeCount(unreadCount)}
            </span>
          ) : null}
        </span>
      </Button>

      {isOpen ? (
        <section className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-[11px] text-muted-foreground">{unreadCount} unread</p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => void loadNotifications()}
                aria-label="Refresh notifications"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => void handleMarkAllRead()}
                disabled={markAllBusy || unreadCount === 0}
                aria-label="Mark all notifications as read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
              </Button>
            </div>
          </header>

          {quickPushToggleEndpoint ? (
            <section className="border-b border-border px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                  In-app alerts:{" "}
                  <span className={pushEnabled ? "font-semibold text-foreground" : "font-semibold text-amber-600"}>
                    {settingsLoading ? "Loading..." : pushEnabled ? "On" : "Off"}
                  </span>
                </p>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => void handleTogglePush()}
                    disabled={settingsLoading || toggleBusy}
                  >
                    {toggleBusy ? "Saving..." : pushEnabled ? "Mute In-app" : "Unmute In-app"}
                  </Button>
                  <Button type="button" size="sm" className="h-7 px-2 text-[11px]" asChild>
                    <Link href={settingsHref} onClick={() => setIsOpen(false)}>
                      Preferences
                    </Link>
                  </Button>
                </div>
              </div>
            </section>
          ) : null}

          {error ? (
            <p className="border-b border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-300">
              {error}
            </p>
          ) : null}

          <div className="max-h-[340px] overflow-y-auto">
            {loading && !payload ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">Loading notifications...</p>
            ) : previewItems.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">{emptyMessage}</p>
            ) : (
              <ul className="divide-y divide-border">
                {previewItems.map((item) => (
                  <li key={item.id} className="space-y-2 px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                          item.isRead ? "bg-muted-foreground/40" : "bg-primary"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">{item.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.message}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {formatRelativeTime(item.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pl-4">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => void handleMarkRead(item.id)}
                        disabled={item.isRead || updatingId === item.id}
                      >
                        {updatingId === item.id ? "Saving..." : item.isRead ? "Read" : "Mark Read"}
                      </Button>
                      <Button type="button" size="sm" className="h-7 px-2 text-[11px]" asChild>
                        <Link href={item.linkUrl ?? viewAllHref} onClick={() => setIsOpen(false)}>
                          Open
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <footer className="border-t border-border px-3 py-2">
            <Button type="button" variant="outline" className="h-8 w-full text-xs" asChild>
              <Link href={viewAllHref} onClick={() => setIsOpen(false)}>
                View All Notifications
              </Link>
            </Button>
          </footer>
        </section>
      ) : null}
    </div>
  );
}
