import { Prisma, UserRole } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { db } from "@/lib/db";
import type {
  AdminDbExportFormat,
  AdminDbExportPanelPayload,
  AdminDbExportScope,
} from "@/types/admin-db-export";

type CsvRow = Record<string, unknown>;

type ScopeSnapshot = {
  scope: Exclude<AdminDbExportScope, "all">;
  data: Record<string, unknown>;
  tableCounts: Record<string, number>;
  csvRows: CsvRow[];
};

type ExportSnapshot = {
  scope: AdminDbExportScope;
  data: Record<string, unknown>;
  tableCounts: Record<string, number>;
  csvRows: CsvRow[];
};

const exportScopeOptions: AdminDbExportPanelPayload["scopes"] = [
  {
    value: "all",
    label: "Full Marketplace Backup",
    description: "Export all core marketplace modules in one file.",
    tables: [
      "categories",
      "subcategories",
      "brands",
      "products",
      "users",
      "user_profiles",
      "addresses",
      "orders",
      "order_items",
      "payments",
      "payment_proofs",
      "sellers",
      "seller_payouts",
      "inventory_logs",
      "notifications",
      "audit_logs",
      "site_settings",
      "supported_currencies",
      "currency_rates",
      "shipping_methods",
      "homepage_sections",
      "banners",
    ],
  },
  {
    value: "catalog",
    label: "Catalog Data",
    description: "Products, categories, brands, media, and variants.",
    tables: [
      "categories",
      "subcategories",
      "brands",
      "products",
      "product_images",
      "product_variants",
      "product_tags",
    ],
  },
  {
    value: "customers",
    label: "Customers Data",
    description: "Customer accounts, profiles, addresses, carts, and wishlists.",
    tables: ["users", "user_profiles", "addresses", "carts", "cart_items", "wishlists", "wishlist_items"],
  },
  {
    value: "orders",
    label: "Orders & Payments",
    description: "Orders, line items, payments, proofs, and shipment records.",
    tables: [
      "orders",
      "order_items",
      "payments",
      "payment_proofs",
      "shipments",
      "order_status_history",
    ],
  },
  {
    value: "sellers",
    label: "Seller Operations",
    description: "Seller applications, payout accounts, and payout history.",
    tables: ["sellers", "seller_payout_accounts", "seller_payouts"],
  },
  {
    value: "operations",
    label: "Operations Logs",
    description: "Inventory movements, notifications, audit logs, and webhooks.",
    tables: ["inventory_logs", "notifications", "audit_logs", "payment_webhook_events"],
  },
  {
    value: "settings",
    label: "Platform Settings",
    description: "Site settings, currencies, rates, shipping methods, and homepage controls.",
    tables: [
      "site_settings",
      "supported_currencies",
      "currency_rates",
      "shipping_methods",
      "homepage_sections",
      "banners",
    ],
  },
];

const exportFormatOptions: AdminDbExportPanelPayload["formats"] = [
  {
    value: "json",
    label: "JSON (Full Structure)",
    description: "Best for full backup and restore workflows.",
  },
  {
    value: "csv",
    label: "CSV (Summary Rows)",
    description: "Best for quick review in Excel or Google Sheets.",
  },
];

const validScopes = new Set<AdminDbExportScope>([
  "all",
  "catalog",
  "customers",
  "orders",
  "sellers",
  "operations",
  "settings",
]);
const validFormats = new Set<AdminDbExportFormat>(["json", "csv"]);

function normalizeOptionalText(value: string | null | undefined) {
  if (!value) return "";
  return value.trim();
}

function fileTimestamp(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  const second = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return '""';
  const text =
    typeof value === "string"
      ? value
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(rows: CsvRow[]) {
  if (!rows.length) return "message\n\"No rows available for selected scope.\"";

  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const headerLine = headers.map((header) => csvEscape(header)).join(",");
  const lines = rows.map((row) =>
    headers.map((header) => csvEscape(row[header] ?? "")).join(","),
  );

  return `${headerLine}\n${lines.join("\n")}`;
}

function toSerializable(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Prisma.Decimal) return value.toString();
  if (Array.isArray(value)) return value.map((item) => toSerializable(item));
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      output[key] = toSerializable(nested);
    }
    return output;
  }
  return value;
}

function createFilename(scope: AdminDbExportScope, format: AdminDbExportFormat) {
  return `deal-bazaar-db-export-${scope}-${fileTimestamp()}.${format}`;
}

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value.toString());
}

function buildScopeRows(scope: ScopeSnapshot): CsvRow[] {
  if (scope.scope === "catalog") {
    const products = (scope.data.products ?? []) as Array<{
      id: string;
      name: string;
      sku: string;
      status: string;
      stockStatus: string;
      stockQuantity: number;
      currentPrice: Prisma.Decimal;
      oldPrice: Prisma.Decimal | null;
      category: { name: string };
      subcategory: { name: string } | null;
      brand: { name: string } | null;
      seller: { storeName: string } | null;
      updatedAt: Date;
    }>;

    return products.map((product) => ({
      productId: product.id,
      name: product.name,
      sku: product.sku,
      status: product.status,
      stockStatus: product.stockStatus,
      stockQuantity: product.stockQuantity,
      currentPrice: toNumber(product.currentPrice),
      oldPrice: product.oldPrice ? toNumber(product.oldPrice) : "",
      category: product.category.name,
      subcategory: product.subcategory?.name ?? "",
      brand: product.brand?.name ?? "",
      seller: product.seller?.storeName ?? "Deal Bazaar",
      updatedAt: product.updatedAt.toISOString(),
    }));
  }

  if (scope.scope === "customers") {
    const users = (scope.data.users ?? []) as Array<{
      id: string;
      email: string;
      status: string;
      phone: string | null;
      createdAt: Date;
      profile: {
        firstName: string | null;
        lastName: string | null;
        preferredCurrency: string;
        preferredLanguage: string;
      } | null;
      _count: {
        addresses: number;
        orders: number;
        wishlists: number;
      };
    }>;

    return users.map((user) => ({
      userId: user.id,
      email: user.email,
      status: user.status,
      firstName: user.profile?.firstName ?? "",
      lastName: user.profile?.lastName ?? "",
      phone: user.phone ?? "",
      preferredCurrency: user.profile?.preferredCurrency ?? "",
      preferredLanguage: user.profile?.preferredLanguage ?? "",
      addresses: user._count.addresses,
      orders: user._count.orders,
      wishlists: user._count.wishlists,
      createdAt: user.createdAt.toISOString(),
    }));
  }

  if (scope.scope === "orders") {
    const orders = (scope.data.orders ?? []) as Array<{
      id: string;
      orderNumber: string;
      status: string;
      paymentStatus: string;
      paymentMethod: string;
      currencyCode: string;
      customerEmail: string;
      grandTotal: Prisma.Decimal;
      items: Array<{ quantity: number }>;
      payment: { transactionReference: string | null } | null;
      shipment: { status: string } | null;
      createdAt: Date;
    }>;

    return orders.map((order) => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      currencyCode: order.currencyCode,
      customerEmail: order.customerEmail,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      grandTotal: toNumber(order.grandTotal),
      transactionReference: order.payment?.transactionReference ?? "",
      shipmentStatus: order.shipment?.status ?? "",
      createdAt: order.createdAt.toISOString(),
    }));
  }

  if (scope.scope === "sellers") {
    const sellers = (scope.data.sellers ?? []) as Array<{
      userId: string;
      storeName: string;
      storeSlug: string;
      status: string;
      supportEmail: string | null;
      supportPhone: string | null;
      commissionRate: Prisma.Decimal;
      user: { email: string };
      _count: { products: number };
      createdAt: Date;
    }>;

    return sellers.map((seller) => ({
      sellerUserId: seller.userId,
      storeName: seller.storeName,
      storeSlug: seller.storeSlug,
      status: seller.status,
      supportEmail: seller.supportEmail ?? "",
      supportPhone: seller.supportPhone ?? "",
      ownerEmail: seller.user.email,
      commissionRate: toNumber(seller.commissionRate),
      products: seller._count.products,
      createdAt: seller.createdAt.toISOString(),
    }));
  }

  if (scope.scope === "operations") {
    const webhookEvents = (scope.data.paymentWebhookEvents ?? []) as Array<{
      id: string;
      provider: string;
      eventType: string;
      eventId: string | null;
      reference: string | null;
      handled: boolean;
      success: boolean;
      errorCode: string | null;
      createdAt: Date;
    }>;

    return webhookEvents.map((event) => ({
      webhookEventId: event.id,
      provider: event.provider,
      eventType: event.eventType,
      eventId: event.eventId ?? "",
      reference: event.reference ?? "",
      handled: event.handled,
      success: event.success,
      errorCode: event.errorCode ?? "",
      createdAt: event.createdAt.toISOString(),
    }));
  }

  const siteSettings = (scope.data.siteSettings ?? []) as Array<{
    settingGroup: string;
    settingKey: string;
    settingValue: unknown;
    isPublic: boolean;
    updatedAt: Date;
  }>;

  return siteSettings.map((item) => ({
    settingGroup: item.settingGroup,
    settingKey: item.settingKey,
    isPublic: item.isPublic,
    settingValue: JSON.stringify(item.settingValue),
    updatedAt: item.updatedAt.toISOString(),
  }));
}

async function fetchCatalogScope(): Promise<ScopeSnapshot> {
  const [categories, subcategories, brands, products, productTags] = await Promise.all([
    db.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: {
            products: true,
            subcategories: true,
          },
        },
      },
    }),
    db.subcategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: { products: true },
        },
      },
    }),
    db.brand.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { products: true },
        },
      },
    }),
    db.product.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        status: true,
        stockStatus: true,
        stockQuantity: true,
        currentPrice: true,
        oldPrice: true,
        discountPercentage: true,
        totalSold: true,
        averageRating: true,
        featured: true,
        trending: true,
        bestSeller: true,
        newArrival: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: { id: true, name: true, slug: true },
        },
        subcategory: {
          select: { id: true, name: true, slug: true },
        },
        brand: {
          select: { id: true, name: true, slug: true },
        },
        seller: {
          select: { userId: true, storeName: true },
        },
        images: {
          select: {
            id: true,
            imageUrl: true,
            isMain: true,
            sortOrder: true,
          },
          orderBy: { sortOrder: "asc" },
        },
        variants: {
          select: {
            id: true,
            sku: true,
            name: true,
            price: true,
            oldPrice: true,
            stockQuantity: true,
            isDefault: true,
            isActive: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    db.productTag.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { mappings: true },
        },
      },
    }),
  ]);

  const tableCounts = {
    categories: categories.length,
    subcategories: subcategories.length,
    brands: brands.length,
    products: products.length,
    product_images: products.reduce((sum, product) => sum + product.images.length, 0),
    product_variants: products.reduce((sum, product) => sum + product.variants.length, 0),
    product_tags: productTags.length,
  };

  const base: ScopeSnapshot = {
    scope: "catalog",
    data: {
      categories,
      subcategories,
      brands,
      products,
      productTags,
    },
    tableCounts,
    csvRows: [],
  };
  base.csvRows = buildScopeRows(base);
  return base;
}

async function fetchCustomersScope(): Promise<ScopeSnapshot> {
  const [users, profiles, addresses, carts, wishlists] = await Promise.all([
    db.user.findMany({
      where: {
        role: UserRole.CUSTOMER,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        phone: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
            preferredCurrency: true,
            preferredLanguage: true,
            themePreference: true,
          },
        },
        _count: {
          select: {
            addresses: true,
            orders: true,
            wishlists: true,
          },
        },
      },
    }),
    db.userProfile.findMany({
      where: {
        user: { role: UserRole.CUSTOMER },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.address.findMany({
      where: {
        user: { role: UserRole.CUSTOMER },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.cart.findMany({
      where: {
        user: { role: UserRole.CUSTOMER },
      },
      orderBy: { updatedAt: "desc" },
      include: {
        items: {
          select: {
            id: true,
            productId: true,
            variantId: true,
            quantity: true,
            unitPrice: true,
            currencyCode: true,
            updatedAt: true,
          },
        },
      },
    }),
    db.wishlist.findMany({
      where: {
        user: { role: UserRole.CUSTOMER },
      },
      orderBy: { updatedAt: "desc" },
      include: {
        items: {
          select: {
            id: true,
            productId: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);

  const tableCounts = {
    users: users.length,
    user_profiles: profiles.length,
    addresses: addresses.length,
    carts: carts.length,
    cart_items: carts.reduce((sum, cart) => sum + cart.items.length, 0),
    wishlists: wishlists.length,
    wishlist_items: wishlists.reduce((sum, wishlist) => sum + wishlist.items.length, 0),
  };

  const base: ScopeSnapshot = {
    scope: "customers",
    data: {
      users,
      profiles,
      addresses,
      carts,
      wishlists,
    },
    tableCounts,
    csvRows: [],
  };
  base.csvRows = buildScopeRows(base);
  return base;
}

async function fetchOrdersScope(): Promise<ScopeSnapshot> {
  const [orders, orderStatusHistory] = await Promise.all([
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        billingAddress: true,
        shippingAddress: true,
        shippingMethod: {
          select: { id: true, code: true, name: true, baseFee: true },
        },
        items: {
          orderBy: { createdAt: "asc" },
        },
        payment: true,
        paymentProofs: {
          orderBy: { createdAt: "desc" },
        },
        shipment: true,
        coupon: {
          select: {
            id: true,
            code: true,
            title: true,
            discountType: true,
            discountValue: true,
          },
        },
      },
    }),
    db.orderStatusHistory.findMany({
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const tableCounts = {
    orders: orders.length,
    order_items: orders.reduce((sum, order) => sum + order.items.length, 0),
    payments: orders.reduce((sum, order) => sum + (order.payment ? 1 : 0), 0),
    payment_proofs: orders.reduce((sum, order) => sum + order.paymentProofs.length, 0),
    shipments: orders.reduce((sum, order) => sum + (order.shipment ? 1 : 0), 0),
    order_status_history: orderStatusHistory.length,
  };

  const base: ScopeSnapshot = {
    scope: "orders",
    data: {
      orders,
      orderStatusHistory,
    },
    tableCounts,
    csvRows: [],
  };
  base.csvRows = buildScopeRows(base);
  return base;
}

async function fetchSellersScope(): Promise<ScopeSnapshot> {
  const [sellers, payoutAccounts, payouts] = await Promise.all([
    db.seller.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            phone: true,
            createdAt: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        _count: {
          select: {
            products: true,
            orderItems: true,
            payoutAccounts: true,
            payouts: true,
          },
        },
      },
    }),
    db.sellerPayoutAccount.findMany({
      orderBy: { createdAt: "desc" },
    }),
    db.sellerPayout.findMany({
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const tableCounts = {
    sellers: sellers.length,
    seller_payout_accounts: payoutAccounts.length,
    seller_payouts: payouts.length,
  };

  const base: ScopeSnapshot = {
    scope: "sellers",
    data: {
      sellers,
      payoutAccounts,
      payouts,
    },
    tableCounts,
    csvRows: [],
  };
  base.csvRows = buildScopeRows(base);
  return base;
}

async function fetchOperationsScope(): Promise<ScopeSnapshot> {
  const [inventoryLogs, notifications, auditLogs, paymentWebhookEvents] = await Promise.all([
    db.inventoryLog.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        product: {
          select: { id: true, name: true, sku: true },
        },
        variant: {
          select: { id: true, sku: true, name: true },
        },
        actor: {
          select: { id: true, email: true },
        },
      },
    }),
    db.notification.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, email: true, role: true },
        },
      },
    }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        actor: {
          select: { id: true, email: true, role: true },
        },
      },
    }),
    db.paymentWebhookEvent.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          select: { id: true, orderNumber: true, customerEmail: true },
        },
        payment: {
          select: { id: true, paymentMethod: true, paymentStatus: true, transactionReference: true },
        },
      },
    }),
  ]);

  const tableCounts = {
    inventory_logs: inventoryLogs.length,
    notifications: notifications.length,
    audit_logs: auditLogs.length,
    payment_webhook_events: paymentWebhookEvents.length,
  };

  const base: ScopeSnapshot = {
    scope: "operations",
    data: {
      inventoryLogs,
      notifications,
      auditLogs,
      paymentWebhookEvents,
    },
    tableCounts,
    csvRows: [],
  };
  base.csvRows = buildScopeRows(base);
  return base;
}

async function fetchSettingsScope(): Promise<ScopeSnapshot> {
  const [siteSettings, supportedCurrencies, currencyRates, shippingMethods, homepageSections, banners] =
    await Promise.all([
      db.siteSetting.findMany({
        orderBy: [{ settingGroup: "asc" }, { settingKey: "asc" }],
        include: {
          updater: {
            select: { id: true, email: true },
          },
        },
      }),
      db.supportedCurrency.findMany({
        orderBy: { code: "asc" },
      }),
      db.currencyRate.findMany({
        orderBy: [{ effectiveDate: "desc" }, { fetchedAt: "desc" }],
      }),
      db.shippingMethod.findMany({
        orderBy: { code: "asc" },
      }),
      db.homepageSection.findMany({
        orderBy: { sectionKey: "asc" },
      }),
      db.banner.findMany({
        orderBy: [{ position: "asc" }, { createdAt: "desc" }],
      }),
    ]);

  const tableCounts = {
    site_settings: siteSettings.length,
    supported_currencies: supportedCurrencies.length,
    currency_rates: currencyRates.length,
    shipping_methods: shippingMethods.length,
    homepage_sections: homepageSections.length,
    banners: banners.length,
  };

  const base: ScopeSnapshot = {
    scope: "settings",
    data: {
      siteSettings,
      supportedCurrencies,
      currencyRates,
      shippingMethods,
      homepageSections,
      banners,
    },
    tableCounts,
    csvRows: [],
  };
  base.csvRows = buildScopeRows(base);
  return base;
}

async function fetchScopeSnapshot(scope: Exclude<AdminDbExportScope, "all">): Promise<ScopeSnapshot> {
  if (scope === "catalog") return fetchCatalogScope();
  if (scope === "customers") return fetchCustomersScope();
  if (scope === "orders") return fetchOrdersScope();
  if (scope === "sellers") return fetchSellersScope();
  if (scope === "operations") return fetchOperationsScope();
  return fetchSettingsScope();
}

async function buildSnapshot(scope: AdminDbExportScope): Promise<ExportSnapshot> {
  if (scope !== "all") {
    const one = await fetchScopeSnapshot(scope);
    return one;
  }

  const [catalog, customers, orders, sellers, operations, settings] = await Promise.all([
    fetchCatalogScope(),
    fetchCustomersScope(),
    fetchOrdersScope(),
    fetchSellersScope(),
    fetchOperationsScope(),
    fetchSettingsScope(),
  ]);

  const tableCounts = {
    ...catalog.tableCounts,
    ...customers.tableCounts,
    ...orders.tableCounts,
    ...sellers.tableCounts,
    ...operations.tableCounts,
    ...settings.tableCounts,
  };

  const csvRows = Object.entries(tableCounts).map(([table, records]) => ({
    table,
    records,
  }));

  return {
    scope: "all",
    data: {
      catalog: catalog.data,
      customers: customers.data,
      orders: orders.data,
      sellers: sellers.data,
      operations: operations.data,
      settings: settings.data,
    },
    tableCounts,
    csvRows,
  };
}

export function parseAdminDbExportScope(value: string | null | undefined) {
  const normalized = normalizeOptionalText(value).toLowerCase();
  if (!normalized.length) return null;
  return validScopes.has(normalized as AdminDbExportScope)
    ? (normalized as AdminDbExportScope)
    : null;
}

export function parseAdminDbExportFormat(value: string | null | undefined) {
  const normalized = normalizeOptionalText(value).toLowerCase();
  if (!normalized.length) return null;
  return validFormats.has(normalized as AdminDbExportFormat)
    ? (normalized as AdminDbExportFormat)
    : null;
}

export async function getAdminDbExportPanel(): Promise<AdminDbExportPanelPayload> {
  return {
    defaultScope: "all",
    defaultFormat: "json",
    scopes: exportScopeOptions,
    formats: exportFormatOptions,
    generatedAt: new Date().toISOString(),
  };
}

export async function createAdminDbExportFile(input: {
  scope: AdminDbExportScope;
  format: AdminDbExportFormat;
}) {
  const snapshot = await buildSnapshot(input.scope);
  const filename = createFilename(input.scope, input.format);

  if (input.format === "json") {
    const content = JSON.stringify(
      toSerializable({
        generatedAt: new Date().toISOString(),
        scope: input.scope,
        tableCounts: snapshot.tableCounts,
        data: snapshot.data,
      }),
      null,
      2,
    );

    return {
      filename,
      contentType: "application/json; charset=utf-8",
      body: content,
      tableCounts: snapshot.tableCounts,
    };
  }

  if (!snapshot.csvRows.length) {
    throw new AppError("No rows available for CSV export in selected scope.", 400, "DB_EXPORT_EMPTY");
  }

  const csv = toCsv(toSerializable(snapshot.csvRows) as CsvRow[]);
  return {
    filename,
    contentType: "text/csv; charset=utf-8",
    body: `\uFEFF${csv}`,
    tableCounts: snapshot.tableCounts,
  };
}
