import { NotificationsManager } from "@/components/admin/notifications-manager";

export default function AdminNotificationsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Notifications Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor stock alerts and operational updates, then mark items as read once handled.
        </p>
      </header>
      <NotificationsManager />
    </div>
  );
}

