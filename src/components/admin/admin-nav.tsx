"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { subscribeAdminNotificationsUpdated } from "@/lib/events/admin-notification-events";
import type { NavItem } from "@/lib/constants/navigation";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type NotificationsSummaryResponse = {
  summary: {
    unreadCount: number;
  };
};

type Props = {
  items: NavItem[];
};

function formatUnreadCount(value: number) {
  if (value > 99) return "99+";
  return String(value);
}

export function AdminNav({ items }: Props) {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  const notificationHref = useMemo(() => "/admin/notifications", []);

  useEffect(() => {
    let isActive = true;

    const loadUnreadCount = async () => {
      try {
        const response = await fetch("/api/admin/notifications?read=unread", {
          cache: "no-store",
        });
        const payload = (await response.json()) as ApiEnvelope<NotificationsSummaryResponse>;
        if (!isActive || !response.ok || !payload.success || !payload.data) return;
        setUnreadCount(payload.data.summary.unreadCount);
      } catch {
        // Keep silent here to avoid disrupting nav experience on transient failures.
      }
    };

    void loadUnreadCount();
    const interval = window.setInterval(() => {
      void loadUnreadCount();
    }, 30000);

    const unsubscribe = subscribeAdminNotificationsUpdated((detail) => {
      if (typeof detail.unreadCount === "number") {
        setUnreadCount(detail.unreadCount);
        return;
      }
      void loadUnreadCount();
    });

    return () => {
      isActive = false;
      unsubscribe();
      window.clearInterval(interval);
    };
  }, []);

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const isNotificationLink = item.href === notificationHref;
        const shouldShowUnread = isNotificationLink && unreadCount > 0;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition",
              isActive
                ? "bg-primary/10 text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <span>{item.label}</span>
            {shouldShowUnread ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {formatUnreadCount(unreadCount)}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
