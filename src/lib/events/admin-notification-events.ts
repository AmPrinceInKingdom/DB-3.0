export const ADMIN_NOTIFICATIONS_UPDATED_EVENT = "deal-bazaar:admin-notifications-updated";

export type AdminNotificationsUpdatedDetail = {
  unreadCount?: number;
};

export function emitAdminNotificationsUpdated(detail: AdminNotificationsUpdatedDetail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ADMIN_NOTIFICATIONS_UPDATED_EVENT, { detail }));
}

export function subscribeAdminNotificationsUpdated(
  handler: (detail: AdminNotificationsUpdatedDetail) => void,
) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const listener: EventListener = (event) => {
    const customEvent = event as CustomEvent<AdminNotificationsUpdatedDetail>;
    handler(customEvent.detail ?? {});
  };

  window.addEventListener(ADMIN_NOTIFICATIONS_UPDATED_EVENT, listener);

  return () => {
    window.removeEventListener(ADMIN_NOTIFICATIONS_UPDATED_EVENT, listener);
  };
}
