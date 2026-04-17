import {
  AccountStatus,
  NotificationType,
  Prisma,
  StockStatus,
  UserRole,
} from "@prisma/client";
import { getNotificationSettings } from "@/lib/services/notification-settings-service";

type StockAlertSource = "ORDER_PLACED" | "ADMIN_MANUAL_ADJUSTMENT";

type EmitStockAlertsInput = {
  productIds: string[];
  source: StockAlertSource;
};

function toTitle(status: StockStatus) {
  if (status === StockStatus.OUT_OF_STOCK) return "Out of stock alert";
  return "Low stock alert";
}

function toMessage(productName: string, status: StockStatus, stockQuantity: number) {
  if (status === StockStatus.OUT_OF_STOCK) {
    return `${productName} is out of stock. Please replenish inventory immediately.`;
  }
  return `${productName} is low on stock (${stockQuantity} left). Consider restocking soon.`;
}

export async function emitLowStockAdminAlerts(
  tx: Prisma.TransactionClient,
  input: EmitStockAlertsInput,
) {
  const productIds = Array.from(new Set(input.productIds.filter((id) => id.trim().length > 0)));
  if (productIds.length === 0) return;

  const notificationSettings = await getNotificationSettings(tx);
  if (!notificationSettings.autoStockAlertsEnabled) return;
  const lowStockThreshold = Math.max(1, notificationSettings.lowStockThreshold);

  const [admins, lowStockProducts] = await Promise.all([
    tx.user.findMany({
      where: {
        role: {
          in: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
        },
        status: AccountStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    }),
    tx.product.findMany({
      where: {
        id: { in: productIds },
        OR: [
          {
            stockStatus: {
              in: [StockStatus.LOW_STOCK, StockStatus.OUT_OF_STOCK],
            },
          },
          {
            stockQuantity: {
              lte: lowStockThreshold,
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        stockStatus: true,
        stockQuantity: true,
        minStockLevel: true,
      },
    }),
  ]);

  if (admins.length === 0 || lowStockProducts.length === 0) return;

  const rows: Prisma.NotificationCreateManyInput[] = [];

  for (const admin of admins) {
    for (const product of lowStockProducts) {
      const effectiveStatus =
        product.stockQuantity <= 0 || product.stockStatus === StockStatus.OUT_OF_STOCK
          ? StockStatus.OUT_OF_STOCK
          : StockStatus.LOW_STOCK;

      rows.push({
        userId: admin.id,
        type: NotificationType.STOCK,
        title: toTitle(effectiveStatus),
        message: toMessage(product.name, effectiveStatus, product.stockQuantity),
        linkUrl: `/admin/inventory?query=${encodeURIComponent(product.name)}`,
        metadata: {
          productId: product.id,
          productSlug: product.slug,
          stockStatus: effectiveStatus,
          stockQuantity: product.stockQuantity,
          minStockLevel: product.minStockLevel,
          configuredThreshold: lowStockThreshold,
          source: input.source,
        } satisfies Prisma.InputJsonValue,
        sentAt: new Date(),
      });
    }
  }

  await tx.notification.createMany({
    data: rows,
  });
}
