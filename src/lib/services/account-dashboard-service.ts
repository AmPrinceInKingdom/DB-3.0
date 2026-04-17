import { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";

export type AccountDashboardStats = {
  activeOrders: number;
  wishlistItems: number;
  savedForLaterItems: number;
  savedAddresses: number;
  unreadNotifications: number;
};

const activeOrderStatuses: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
];

export async function getAccountDashboardStats(userId: string): Promise<AccountDashboardStats> {
  const [activeOrders, wishlistItems, savedForLaterItems, savedAddresses, unreadNotifications] =
    await db.$transaction([
    db.order.count({
      where: {
        userId,
        status: { in: activeOrderStatuses },
      },
    }),
    db.wishlistItem.count({
      where: {
        wishlist: {
          userId,
        },
      },
    }),
    db.savedCartItem.count({
      where: {
        userId,
      },
    }),
    db.address.count({
      where: { userId },
    }),
    db.notification.count({
      where: {
        userId,
        isRead: false,
      },
    }),
  ]);

  return {
    activeOrders,
    wishlistItems,
    savedForLaterItems,
    savedAddresses,
    unreadNotifications,
  };
}
