import type { ReactNode } from "react";
import { adminNavItems } from "@/lib/constants/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { LogoutButton } from "@/components/auth/logout-button";
import { PanelShell } from "@/components/layout/panel-shell";
import { NotificationBell } from "@/components/layout/notification-bell";

type Props = {
  children: ReactNode;
};

export default function AdminLayout({ children }: Props) {
  return (
    <PanelShell
      sideTitle="Admin Panel"
      nav={<AdminNav items={adminNavItems} />}
      headerEyebrow="Control Center"
      headerTitle="Admin workspace quick access"
      headerAction={
        <div className="flex items-center gap-2">
          <NotificationBell
            title="Admin Notifications"
            notificationsEndpoint="/api/admin/notifications"
            realtimeStreamEndpoint="/api/admin/notifications/stream"
            notificationUpdateBasePath="/api/admin/notifications"
            markAllEndpoint="/api/admin/notifications/read-all"
            viewAllHref="/admin/notifications"
            emptyMessage="No admin alerts right now."
          />
          <LogoutButton variant="danger" />
        </div>
      }
      sidebarClassName="lg:grid-cols-[250px_1fr]"
    >
      {children}
    </PanelShell>
  );
}
