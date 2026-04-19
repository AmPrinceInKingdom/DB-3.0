import {
  DiscountScope,
  DiscountType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  StockStatus,
} from "@prisma/client";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  defaultBankTransferDetails,
  defaultPaymentOptions,
  defaultShippingMethods,
  defaultTaxRatePercentage,
  type BankTransferDetails,
  type PaymentOption,
  type ShippingMethodOption,
} from "@/lib/constants/checkout";
import {
  convertFromBaseCurrency,
  getCurrencyDecimals,
  getExchangeRateToBase,
  roundMoney,
} from "@/lib/constants/exchange-rates";
import type { SessionPayload } from "@/lib/auth/types";
import type { CreateOrderInput, PreviewCouponInput } from "@/lib/validators/checkout";
import {
  createCardPaymentSessionForOrder,
  createCardPaymentSessionForOrderTx,
  type CardPaymentSessionCreateResult,
} from "@/lib/services/card-payment-service";
import { emitLowStockAdminAlerts } from "@/lib/services/stock-alert-service";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const CHECKOUT_OPTIONS_CACHE_TAG = "checkout-options";

function isUuid(value: string) {
  return uuidPattern.test(value);
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  if (typeof value === "bigint") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  if (value && typeof value === "object") {
    const decimalLike = value as {
      toNumber?: () => number;
      toString?: () => string;
      valueOf?: () => unknown;
    };

    if (typeof decimalLike.toNumber === "function") {
      const parsed = decimalLike.toNumber();
      if (Number.isFinite(parsed)) return parsed;
    }

    if (typeof decimalLike.toString === "function") {
      const parsed = Number(decimalLike.toString());
      if (Number.isFinite(parsed)) return parsed;
    }

    if (typeof decimalLike.valueOf === "function") {
      const parsed = Number(decimalLike.valueOf());
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
}

function isKnownPrismaError(error: unknown, code: string) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === code
  );
}

function parseNumberSetting(value: unknown, fallback: number) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function parseBooleanSetting(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function toStringSetting(value: unknown, fallback: string) {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return fallback;
}

function hasEnvValue(value: string | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function isStripeCheckoutEnvironmentReady() {
  return (
    hasEnvValue(process.env.STRIPE_SECRET_KEY) &&
    hasEnvValue(process.env.STRIPE_WEBHOOK_SECRET) &&
    hasEnvValue(process.env.NEXT_PUBLIC_APP_URL)
  );
}

function buildOrderNumber() {
  const now = new Date();
  const date = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(
    now.getUTCDate(),
  ).padStart(2, "0")}`;
  const random = Math.floor(100000 + Math.random() * 900000);
  return `DB-${date}-${random}`;
}

function normalizeOptionalText(value: string | null | undefined, fallback = "") {
  const text = value?.trim();
  return text && text.length > 0 ? text : fallback;
}

const clientRequestIdPattern = /^[A-Za-z0-9._:-]{8,120}$/;
let orderClientRequestIdColumnSupported: boolean | null = null;

async function supportsOrderClientRequestIdColumn() {
  if (orderClientRequestIdColumnSupported !== null) {
    return orderClientRequestIdColumnSupported;
  }

  try {
    const rows = await db.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'orders'
          AND column_name = 'client_request_id'
      ) AS "exists"
    `;
    orderClientRequestIdColumnSupported = rows[0]?.exists === true;
  } catch {
    orderClientRequestIdColumnSupported = false;
  }

  return orderClientRequestIdColumnSupported;
}

function normalizeClientRequestId(value?: string | null) {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (!clientRequestIdPattern.test(normalized)) {
    throw new AppError("Checkout request key format is invalid.", 400, "CHECKOUT_REQUEST_KEY_INVALID");
  }
  return normalized;
}

function serializeAddress(address: CreateOrderInput["billingAddress"]) {
  return {
    firstName: address.firstName,
    lastName: address.lastName,
    company: address.company,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    countryCode: address.countryCode,
  };
}

export type CheckoutOptions = {
  shippingMethods: ShippingMethodOption[];
  paymentMethods: PaymentOption[];
  bankTransfer: BankTransferDetails;
  taxRatePercentage: number;
  cardPaymentProvider: "SANDBOX" | "STRIPE_CHECKOUT";
  cardPaymentProviderReady: boolean;
  cardPaymentProviderLabel: string;
  cardPaymentProviderUnavailableReason: string | null;
};

async function loadCheckoutOptions(): Promise<CheckoutOptions> {
  try {
    const [shippingMethodsDb, settings] = await Promise.all([
      db.shippingMethod.findMany({
        where: { isActive: true },
        orderBy: [{ estimatedDaysMin: "asc" }, { baseFee: "asc" }],
      }),
      db.siteSetting.findMany({
        where: {
          settingKey: {
            in: [
              "tax_rate_percentage",
              "bank_transfer_account_name",
              "bank_transfer_bank_name",
              "bank_transfer_account_number",
              "bank_transfer_branch",
              "bank_transfer_swift",
              "bank_transfer_note",
              "card_payment_enabled",
              "card_payment_provider",
              "bank_transfer_enabled",
              "cash_on_delivery_enabled",
            ],
          },
        },
      }),
    ]);

    const settingsMap = new Map(settings.map((setting) => [setting.settingKey, setting.settingValue]));

    const shippingMethods: ShippingMethodOption[] = shippingMethodsDb.length
      ? shippingMethodsDb.map((method) => ({
          code: method.code,
          name: method.name,
          description: method.description ?? "",
          baseFeeLkr: toNumber(method.baseFee),
          estimatedDaysMin: method.estimatedDaysMin,
          estimatedDaysMax: method.estimatedDaysMax,
        }))
      : defaultShippingMethods;

    const taxRatePercentage = parseNumberSetting(
      settingsMap.get("tax_rate_percentage"),
      defaultTaxRatePercentage,
    );

    const cardPaymentEnabled = parseBooleanSetting(
      settingsMap.get("card_payment_enabled"),
      defaultPaymentOptions.find((method) => method.code === "CARD")?.enabled ?? true,
    );
    const cardPaymentProvider =
      toStringSetting(settingsMap.get("card_payment_provider"), "SANDBOX").toUpperCase() ===
      "STRIPE_CHECKOUT"
        ? "STRIPE_CHECKOUT"
        : "SANDBOX";
    const bankTransferEnabled = parseBooleanSetting(
      settingsMap.get("bank_transfer_enabled"),
      defaultPaymentOptions.find((method) => method.code === "BANK_TRANSFER")?.enabled ?? true,
    );
    const cashOnDeliveryEnabled = parseBooleanSetting(
      settingsMap.get("cash_on_delivery_enabled"),
      defaultPaymentOptions.find((method) => method.code === "CASH_ON_DELIVERY")?.enabled ?? false,
    );

    const stripeEnvironmentReady =
      cardPaymentProvider !== "STRIPE_CHECKOUT" || isStripeCheckoutEnvironmentReady();
    const effectiveCardPaymentEnabled = cardPaymentEnabled && stripeEnvironmentReady;

    const bankTransfer: BankTransferDetails = {
      accountName: toStringSetting(
        settingsMap.get("bank_transfer_account_name"),
        defaultBankTransferDetails.accountName,
      ),
      bankName: toStringSetting(
        settingsMap.get("bank_transfer_bank_name"),
        defaultBankTransferDetails.bankName,
      ),
      accountNumber: toStringSetting(
        settingsMap.get("bank_transfer_account_number"),
        defaultBankTransferDetails.accountNumber,
      ),
      branch: toStringSetting(settingsMap.get("bank_transfer_branch"), defaultBankTransferDetails.branch),
      swiftCode: toStringSetting(
        settingsMap.get("bank_transfer_swift"),
        defaultBankTransferDetails.swiftCode,
      ),
      note: toStringSetting(settingsMap.get("bank_transfer_note"), defaultBankTransferDetails.note),
    };

    const missingBankTransferFields: string[] = [];
    if (!bankTransfer.accountName.trim()) missingBankTransferFields.push("Account name");
    if (!bankTransfer.bankName.trim()) missingBankTransferFields.push("Bank name");
    if (!bankTransfer.accountNumber.trim()) missingBankTransferFields.push("Account number");

    const bankTransferReady = missingBankTransferFields.length === 0;
    const effectiveBankTransferEnabled = bankTransferEnabled && bankTransferReady;
    const cardPaymentProviderLabel =
      cardPaymentProvider === "STRIPE_CHECKOUT" ? "Stripe Checkout" : "Deal Bazaar Sandbox";
    const cardPaymentProviderUnavailableReason =
      cardPaymentProvider === "STRIPE_CHECKOUT" && !stripeEnvironmentReady
        ? "Card gateway is temporarily unavailable due to incomplete Stripe configuration."
        : null;

    const paymentMethods: PaymentOption[] = defaultPaymentOptions.map((method) => {
      if (method.code === "CARD") {
        return {
          ...method,
          enabled: effectiveCardPaymentEnabled,
          description:
            cardPaymentProvider === "STRIPE_CHECKOUT"
              ? "Pay securely through Stripe hosted checkout."
              : method.description,
          unavailableReason: !effectiveCardPaymentEnabled
            ? cardPaymentProvider === "STRIPE_CHECKOUT" && !stripeEnvironmentReady
              ? "Card payment is temporarily unavailable. Please use bank transfer until the card gateway is fully configured."
              : "Card payment is currently disabled by the store."
            : null,
        };
      }
      if (method.code === "BANK_TRANSFER") {
        return {
          ...method,
          enabled: effectiveBankTransferEnabled,
          unavailableReason: !effectiveBankTransferEnabled
            ? bankTransferEnabled
              ? `Bank transfer details are incomplete (${missingBankTransferFields.join(", ")}). Please try again later.`
              : "Bank transfer is currently disabled by the store."
            : null,
        };
      }
      return {
        ...method,
        enabled: cashOnDeliveryEnabled,
        unavailableReason: cashOnDeliveryEnabled ? null : "Cash on delivery is coming soon.",
      };
    });

    return {
      shippingMethods,
      paymentMethods,
      bankTransfer,
      taxRatePercentage,
      cardPaymentProvider,
      cardPaymentProviderReady: stripeEnvironmentReady,
      cardPaymentProviderLabel,
      cardPaymentProviderUnavailableReason,
    };
  } catch {
    return {
      shippingMethods: defaultShippingMethods,
      paymentMethods: defaultPaymentOptions,
      bankTransfer: defaultBankTransferDetails,
      taxRatePercentage: defaultTaxRatePercentage,
      cardPaymentProvider: "SANDBOX",
      cardPaymentProviderReady: true,
      cardPaymentProviderLabel: "Deal Bazaar Sandbox",
      cardPaymentProviderUnavailableReason: null,
    };
  }
}

const getCachedCheckoutOptions = unstable_cache(
  loadCheckoutOptions,
  ["checkout-options-cache"],
  {
    tags: [CHECKOUT_OPTIONS_CACHE_TAG],
    revalidate: 120,
  },
);

export async function getCheckoutOptions(): Promise<CheckoutOptions> {
  return getCachedCheckoutOptions();
}

type CalculatedLine = {
  productId: string;
  sellerId: string | null;
  variantId?: string | null;
  variantLabel?: string | null;
  productName: string;
  slug: string;
  brand: string;
  imageUrl: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  unitPriceBase: number;
};

type TrustedCheckoutItem = {
  productId: string;
  sellerId: string | null;
  categoryId?: string | null;
  variantId?: string | null;
  variantLabel?: string | null;
  productName: string;
  slug: string;
  brand: string;
  imageUrl: string;
  quantity: number;
  unitPriceBase: number;
};

type CouponDbClient = Pick<typeof db, "coupon" | "couponUsage">;

type AppliedCoupon = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  discountType: DiscountType;
  discountScope: DiscountScope;
  discountAmountBase: number;
};

type ProductStockAdjustment = {
  productId: string;
  productName: string;
  quantity: number;
};

type VariantStockAdjustment = {
  productId: string;
  productName: string;
  variantId: string;
  variantLabel: string | null;
  quantity: number;
};

const fallbackImageUrl = "/next.svg";

function resolveStockStatus(quantity: number, minStockLevel: number): StockStatus {
  if (quantity <= 0) return StockStatus.OUT_OF_STOCK;
  if (quantity <= minStockLevel) return StockStatus.LOW_STOCK;
  return StockStatus.IN_STOCK;
}

async function resolveTrustedCheckoutItems(items: CreateOrderInput["items"]): Promise<TrustedCheckoutItem[]> {
  const uuidProductIds = Array.from(new Set(items.map((item) => item.productId).filter(isUuid)));
  const uuidVariantIds = Array.from(
    new Set(
      items
        .map((item) => item.variantId)
        .filter((variantId): variantId is string => Boolean(variantId && isUuid(variantId))),
    ),
  );

  const [products, variants] = await Promise.all([
    uuidProductIds.length
      ? db.product.findMany({
          where: {
            id: { in: uuidProductIds },
          },
          select: {
            id: true,
            sellerId: true,
            categoryId: true,
            slug: true,
            name: true,
            status: true,
            currentPrice: true,
            stockQuantity: true,
            brand: {
              select: {
                name: true,
              },
            },
            images: {
              where: { isMain: true },
              select: {
                imageUrl: true,
              },
              take: 1,
            },
          },
        })
      : Promise.resolve([]),
    uuidVariantIds.length
      ? db.productVariant.findMany({
          where: {
            id: { in: uuidVariantIds },
          },
          select: {
            id: true,
            productId: true,
            sku: true,
            name: true,
            price: true,
            stockQuantity: true,
            isActive: true,
            imageUrl: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const productMap = new Map(products.map((product) => [product.id, product]));
  const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

  return items.map((item) => {
    if (!isUuid(item.productId)) {
      throw new AppError(
        "One or more selected products are invalid. Please refresh your cart and try again.",
        400,
        "PRODUCT_NOT_FOUND",
      );
    }

    const product = productMap.get(item.productId);
    if (!product) {
      throw new AppError("One or more selected products are invalid. Please refresh cart.", 400, "PRODUCT_NOT_FOUND");
    }
    if (product.status !== "ACTIVE") {
      throw new AppError(`${product.name} is currently unavailable.`, 400, "PRODUCT_INACTIVE");
    }

    const requestedVariantId = item.variantId?.trim();
    const hasVariantRequest = Boolean(requestedVariantId);

    if (hasVariantRequest && !isUuid(requestedVariantId!)) {
      throw new AppError(`Invalid variant selected for ${product.name}.`, 400, "INVALID_VARIANT");
    }

    const variant = requestedVariantId ? variantMap.get(requestedVariantId) : null;
    if (requestedVariantId && (!variant || variant.productId !== product.id)) {
      throw new AppError(`Selected variant for ${product.name} is no longer available.`, 400, "INVALID_VARIANT");
    }
    if (variant && !variant.isActive) {
      throw new AppError(`Selected variant for ${product.name} is inactive.`, 400, "VARIANT_INACTIVE");
    }

    const availableStock = variant ? variant.stockQuantity : product.stockQuantity;
    if (item.quantity > availableStock) {
      throw new AppError(
        `Only ${availableStock} unit(s) available for ${product.name}.`,
        400,
        "INSUFFICIENT_STOCK",
      );
    }

    const productPriceBase = toNumber(product.currentPrice);
    const variantPriceBase = variant ? toNumber(variant.price, productPriceBase) : null;
    const unitPriceBase =
      variantPriceBase !== null && variantPriceBase > 0 ? variantPriceBase : productPriceBase;
    if (unitPriceBase <= 0) {
      throw new AppError(`Invalid pricing detected for ${product.name}.`, 400, "INVALID_PRODUCT_PRICE");
    }

    const resolvedVariantLabel = normalizeOptionalText(item.variantLabel, variant?.name ?? "");

    return {
      productId: product.id,
      sellerId: product.sellerId ?? null,
      categoryId: product.categoryId,
      variantId: variant?.id ?? null,
      variantLabel: resolvedVariantLabel || null,
      productName: product.name,
      slug: product.slug,
      brand: normalizeOptionalText(product.brand?.name, "Deal Bazaar"),
      imageUrl: normalizeOptionalText(variant?.imageUrl, product.images[0]?.imageUrl ?? fallbackImageUrl),
      quantity: item.quantity,
      unitPriceBase,
    } satisfies TrustedCheckoutItem;
  });
}

function resolveShippingMethodOption(
  options: CheckoutOptions,
  shippingMethodCode: string,
) {
  if (!options.shippingMethods.length) {
    throw new AppError(
      "Shipping methods are not configured. Please contact support.",
      500,
      "SHIPPING_METHODS_NOT_CONFIGURED",
    );
  }

  const normalizedCode = shippingMethodCode.trim().toUpperCase();
  const selectedMethod = options.shippingMethods.find(
    (method) => method.code.trim().toUpperCase() === normalizedCode,
  );

  if (!selectedMethod) {
    throw new AppError(
      "Selected shipping method is unavailable. Please refresh checkout and try again.",
      400,
      "SHIPPING_METHOD_INVALID",
    );
  }

  return selectedMethod;
}

function calculateSubtotalBase(items: TrustedCheckoutItem[]) {
  return roundMoney(
    items.reduce((sum, item) => sum + item.unitPriceBase * item.quantity, 0),
    2,
  );
}

function calculateEligibleSubtotalBase(
  items: TrustedCheckoutItem[],
  scope: DiscountScope,
  applicableProductId: string | null,
  applicableCategoryId: string | null,
) {
  if (scope === DiscountScope.ORDER) {
    return calculateSubtotalBase(items);
  }

  if (scope === DiscountScope.PRODUCT) {
    if (!applicableProductId) return 0;
    return roundMoney(
      items
        .filter((item) => item.productId === applicableProductId)
        .reduce((sum, item) => sum + item.unitPriceBase * item.quantity, 0),
      2,
    );
  }

  if (!applicableCategoryId) return 0;
  return roundMoney(
    items
      .filter((item) => item.categoryId === applicableCategoryId)
      .reduce((sum, item) => sum + item.unitPriceBase * item.quantity, 0),
    2,
  );
}

async function resolveCouponDiscount(
  client: CouponDbClient,
  params: {
    couponCode?: string | null;
    items: TrustedCheckoutItem[];
    userId?: string | null;
    reserveUsage?: boolean;
  },
): Promise<AppliedCoupon | null> {
  const couponCode = normalizeOptionalText(params.couponCode, "").toUpperCase();
  if (!couponCode) return null;

  const coupon = await client.coupon.findUnique({
    where: { code: couponCode },
    select: {
      id: true,
      code: true,
      title: true,
      description: true,
      discountType: true,
      discountScope: true,
      discountValue: true,
      minPurchaseAmount: true,
      maxDiscountAmount: true,
      startsAt: true,
      expiresAt: true,
      usageLimit: true,
      usageLimitPerUser: true,
      usedCount: true,
      isActive: true,
      applicableCategoryId: true,
      applicableProductId: true,
    },
  });

  if (!coupon || !coupon.isActive) {
    throw new AppError("Invalid coupon code.", 400, "COUPON_INVALID");
  }

  const now = new Date();
  if (coupon.startsAt && now < coupon.startsAt) {
    throw new AppError("This coupon is not active yet.", 400, "COUPON_NOT_STARTED");
  }
  if (coupon.expiresAt && now > coupon.expiresAt) {
    throw new AppError("This coupon has expired.", 400, "COUPON_EXPIRED");
  }

  if (params.userId && coupon.usageLimitPerUser > 0) {
    const userUsageCount = await client.couponUsage.count({
      where: {
        couponId: coupon.id,
        userId: params.userId,
      },
    });

    if (userUsageCount >= coupon.usageLimitPerUser) {
      throw new AppError(
        "You have already reached the usage limit for this coupon.",
        400,
        "COUPON_USER_LIMIT_REACHED",
      );
    }
  }

  if (params.reserveUsage) {
    if (coupon.usageLimit !== null) {
      const claimed = await client.coupon.updateMany({
        where: {
          id: coupon.id,
          isActive: true,
          usedCount: { lt: coupon.usageLimit },
        },
        data: {
          usedCount: { increment: 1 },
        },
      });

      if (claimed.count === 0) {
        throw new AppError("This coupon has reached its usage limit.", 400, "COUPON_USAGE_LIMIT_REACHED");
      }
    } else {
      await client.coupon.update({
        where: { id: coupon.id },
        data: {
          usedCount: { increment: 1 },
        },
      });
    }
  } else if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw new AppError("This coupon has reached its usage limit.", 400, "COUPON_USAGE_LIMIT_REACHED");
  }

  const subtotalBase = calculateSubtotalBase(params.items);
  const minPurchaseBase = toNumber(coupon.minPurchaseAmount);
  if (subtotalBase < minPurchaseBase) {
    throw new AppError(
      `Minimum purchase for this coupon is LKR ${minPurchaseBase.toFixed(2)}.`,
      400,
      "COUPON_MIN_PURCHASE_NOT_MET",
    );
  }

  const eligibleSubtotalBase = calculateEligibleSubtotalBase(
    params.items,
    coupon.discountScope,
    coupon.applicableProductId,
    coupon.applicableCategoryId,
  );

  if (eligibleSubtotalBase <= 0) {
    throw new AppError("This coupon does not apply to selected items.", 400, "COUPON_NOT_APPLICABLE");
  }

  const rawDiscountBase =
    coupon.discountType === DiscountType.PERCENTAGE
      ? eligibleSubtotalBase * (toNumber(coupon.discountValue) / 100)
      : toNumber(coupon.discountValue);
  const maxDiscountBase =
    coupon.maxDiscountAmount === null ? Number.POSITIVE_INFINITY : toNumber(coupon.maxDiscountAmount);

  const discountAmountBase = roundMoney(
    Math.max(0, Math.min(rawDiscountBase, maxDiscountBase, eligibleSubtotalBase)),
    2,
  );

  if (discountAmountBase <= 0) {
    throw new AppError("This coupon does not provide a discount for selected items.", 400, "COUPON_NOT_APPLICABLE");
  }

  return {
    id: coupon.id,
    code: coupon.code.toUpperCase(),
    title: coupon.title,
    description: coupon.description,
    discountType: coupon.discountType,
    discountScope: coupon.discountScope,
    discountAmountBase,
  };
}

function calculateOrderAmounts(
  items: TrustedCheckoutItem[],
  currencyCode: CreateOrderInput["currencyCode"],
  shippingFeeLkr: number,
  taxRatePercentage: number,
  discountAmountBase = 0,
) {
  const currencyDecimals = getCurrencyDecimals(currencyCode);
  const exchangeRateToBase = getExchangeRateToBase(currencyCode);

  const lines: CalculatedLine[] = items.map((item) => {
    const unitPrice = convertFromBaseCurrency(item.unitPriceBase, currencyCode);
    const lineTotal = roundMoney(unitPrice * item.quantity, currencyDecimals);

    return {
      productId: item.productId,
      sellerId: item.sellerId,
      variantId: item.variantId,
      variantLabel: item.variantLabel,
      productName: item.productName,
      slug: item.slug,
      brand: item.brand,
      imageUrl: item.imageUrl,
      quantity: item.quantity,
      unitPrice,
      lineTotal,
      unitPriceBase: item.unitPriceBase,
    };
  });

  const subtotal = roundMoney(
    lines.reduce((sum, line) => sum + line.lineTotal, 0),
    currencyDecimals,
  );
  const shippingFee = convertFromBaseCurrency(shippingFeeLkr, currencyCode);
  const computedDiscount = convertFromBaseCurrency(discountAmountBase, currencyCode);
  const discountTotal = roundMoney(
    Math.max(0, Math.min(computedDiscount, subtotal)),
    currencyDecimals,
  );
  const taxableSubtotal = roundMoney(
    Math.max(0, subtotal - discountTotal),
    currencyDecimals,
  );
  const taxTotal = roundMoney((taxableSubtotal + shippingFee) * (taxRatePercentage / 100), currencyDecimals);
  const grandTotal = roundMoney(taxableSubtotal + shippingFee + taxTotal, currencyDecimals);

  return {
    lines,
    subtotal,
    discountTotal,
    shippingFee,
    taxTotal,
    grandTotal,
    exchangeRateToBase,
    taxRatePercentage,
  };
}

function collectStockAdjustments(lines: CalculatedLine[]) {
  const productAdjustmentsMap = new Map<string, ProductStockAdjustment>();
  const variantAdjustmentsMap = new Map<string, VariantStockAdjustment>();

  for (const line of lines) {
    if (!isUuid(line.productId)) continue;

    const productExisting = productAdjustmentsMap.get(line.productId);
    if (productExisting) {
      productExisting.quantity += line.quantity;
    } else {
      productAdjustmentsMap.set(line.productId, {
        productId: line.productId,
        productName: line.productName,
        quantity: line.quantity,
      });
    }

    if (line.variantId && isUuid(line.variantId)) {
      const key = `${line.productId}:${line.variantId}`;
      const variantExisting = variantAdjustmentsMap.get(key);
      if (variantExisting) {
        variantExisting.quantity += line.quantity;
      } else {
        variantAdjustmentsMap.set(key, {
          productId: line.productId,
          productName: line.productName,
          variantId: line.variantId,
          variantLabel: line.variantLabel ?? null,
          quantity: line.quantity,
        });
      }
    }
  }

  return {
    productAdjustments: Array.from(productAdjustmentsMap.values()),
    variantAdjustments: Array.from(variantAdjustmentsMap.values()),
  };
}

async function applyOrderStockDeductions(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    orderNumber: string;
    actorUserId?: string | null;
    lines: CalculatedLine[];
  },
): Promise<string[]> {
  const { productAdjustments, variantAdjustments } = collectStockAdjustments(input.lines);
  if (productAdjustments.length === 0 && variantAdjustments.length === 0) {
    return [];
  }

  for (const adjustment of variantAdjustments) {
    const variant = await tx.productVariant.findUnique({
      where: { id: adjustment.variantId },
      select: {
        id: true,
        productId: true,
        isActive: true,
        stockQuantity: true,
      },
    });

    if (!variant || variant.productId !== adjustment.productId) {
      throw new AppError(
        `Selected variant for ${adjustment.productName} is no longer available.`,
        400,
        "INVALID_VARIANT",
      );
    }

    if (!variant.isActive) {
      throw new AppError(
        `Selected variant for ${adjustment.productName} is inactive.`,
        400,
        "VARIANT_INACTIVE",
      );
    }

    const updated = await tx.productVariant.updateMany({
      where: {
        id: adjustment.variantId,
        productId: adjustment.productId,
        isActive: true,
        stockQuantity: { gte: adjustment.quantity },
      },
      data: {
        stockQuantity: { decrement: adjustment.quantity },
      },
    });

    if (updated.count === 0) {
      throw new AppError(
        `Only ${variant.stockQuantity} unit(s) available for ${adjustment.productName}.`,
        400,
        "INSUFFICIENT_STOCK",
      );
    }

    const latestVariant = await tx.productVariant.findUnique({
      where: { id: adjustment.variantId },
      select: { stockQuantity: true },
    });
    const newQuantity = latestVariant?.stockQuantity ?? Math.max(0, variant.stockQuantity - adjustment.quantity);

    await tx.inventoryLog.create({
      data: {
        productId: adjustment.productId,
        variantId: adjustment.variantId,
        changedBy: input.actorUserId ?? null,
        previousQuantity: newQuantity + adjustment.quantity,
        changeAmount: -adjustment.quantity,
        newQuantity,
        reason: `Stock deducted for order ${input.orderNumber}`,
        referenceType: "ORDER_PLACED_VARIANT",
        referenceId: input.orderId,
      },
    });
  }

  for (const adjustment of productAdjustments) {
    const product = await tx.product.findUnique({
      where: { id: adjustment.productId },
      select: {
        id: true,
        name: true,
        status: true,
        stockQuantity: true,
        minStockLevel: true,
      },
    });

    if (!product) {
      throw new AppError("One or more products no longer exist. Please refresh cart.", 400, "PRODUCT_NOT_FOUND");
    }

    if (product.status !== "ACTIVE") {
      throw new AppError(`${product.name} is currently unavailable.`, 400, "PRODUCT_INACTIVE");
    }

    const updated = await tx.product.updateMany({
      where: {
        id: product.id,
        status: "ACTIVE",
        stockQuantity: { gte: adjustment.quantity },
      },
      data: {
        stockQuantity: { decrement: adjustment.quantity },
        totalSold: { increment: adjustment.quantity },
      },
    });

    if (updated.count === 0) {
      throw new AppError(
        `Only ${product.stockQuantity} unit(s) available for ${product.name}.`,
        400,
        "INSUFFICIENT_STOCK",
      );
    }

    const latestProduct = await tx.product.findUnique({
      where: { id: product.id },
      select: {
        stockQuantity: true,
        minStockLevel: true,
      },
    });

    if (!latestProduct) {
      throw new AppError("Unable to update product inventory.", 500, "INVENTORY_UPDATE_FAILED");
    }

    const nextStatus = resolveStockStatus(latestProduct.stockQuantity, latestProduct.minStockLevel);
    await tx.product.update({
      where: { id: product.id },
      data: {
        stockStatus: nextStatus,
      },
    });

    await tx.inventoryLog.create({
      data: {
        productId: product.id,
        changedBy: input.actorUserId ?? null,
        previousQuantity: latestProduct.stockQuantity + adjustment.quantity,
        changeAmount: -adjustment.quantity,
        newQuantity: latestProduct.stockQuantity,
        reason: `Stock deducted for order ${input.orderNumber}`,
        referenceType: "ORDER_PLACED",
        referenceId: input.orderId,
      },
    });
  }

  return productAdjustments.map((adjustment) => adjustment.productId);
}

export async function previewCheckoutCoupon(
  input: PreviewCouponInput,
  session: SessionPayload | null,
) {
  const options = await getCheckoutOptions();
  const trustedItems = await resolveTrustedCheckoutItems(input.items);
  const appliedCoupon = await resolveCouponDiscount(db, {
    couponCode: input.couponCode,
    items: trustedItems,
    userId: session?.sub ?? null,
    reserveUsage: false,
  });

  if (!appliedCoupon) {
    throw new AppError("Please provide a valid coupon code.", 400, "COUPON_REQUIRED");
  }

  const shippingMethod = resolveShippingMethodOption(options, input.shippingMethodCode);
  const amounts = calculateOrderAmounts(
    trustedItems,
    input.currencyCode,
    shippingMethod?.baseFeeLkr ?? defaultShippingMethods[0].baseFeeLkr,
    options.taxRatePercentage,
    appliedCoupon.discountAmountBase,
  );

  return {
    coupon: {
      code: appliedCoupon.code,
      title: appliedCoupon.title,
      description: appliedCoupon.description,
      discountType: appliedCoupon.discountType,
      discountScope: appliedCoupon.discountScope,
    },
    totals: {
      subtotal: amounts.subtotal,
      discountTotal: amounts.discountTotal,
      shippingFee: amounts.shippingFee,
      taxTotal: amounts.taxTotal,
      grandTotal: amounts.grandTotal,
      taxRatePercentage: amounts.taxRatePercentage,
    },
  };
}

type CheckoutCreateOrderRecord = {
  id: string;
  orderNumber: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  grandTotal: Prisma.Decimal | number | string;
  discountTotal: Prisma.Decimal | number | string;
  currencyCode: string;
  createdAt: Date;
};

type CheckoutCreateOrderResponse = CheckoutCreateOrderRecord & {
  grandTotal: number;
  discountTotal: number;
  coupon: { code: string; title: string } | null;
  bankTransfer: BankTransferDetails | null;
  cardPayment: CardPaymentSessionCreateResult | null;
};

type CreateOrderOptions = {
  clientRequestId?: string | null;
};

function toCheckoutCreateOrderResponse(params: {
  created: CheckoutCreateOrderRecord;
  options: CheckoutOptions;
  coupon: { code: string; title: string } | null;
  cardPayment: CardPaymentSessionCreateResult | null;
}): CheckoutCreateOrderResponse {
  const { created, options, coupon, cardPayment } = params;

  return {
    ...created,
    grandTotal: toNumber(created.grandTotal),
    discountTotal: toNumber(created.discountTotal),
    coupon,
    bankTransfer:
      created.paymentMethod === PaymentMethod.BANK_TRANSFER
        ? options.bankTransfer
        : null,
    cardPayment:
      created.paymentMethod === PaymentMethod.CARD
        ? cardPayment
        : null,
  };
}

async function findExistingOrderByClientRequestId(input: {
  clientRequestId: string;
  inputCustomerEmail: string;
  session: SessionPayload | null;
  options: CheckoutOptions;
}): Promise<CheckoutCreateOrderResponse | null> {
  const clientRequestIdSupported = await supportsOrderClientRequestIdColumn();
  if (!clientRequestIdSupported) return null;

  const existing = await db.order.findUnique({
    where: { clientRequestId: input.clientRequestId },
    select: {
      id: true,
      orderNumber: true,
      userId: true,
      customerEmail: true,
      paymentMethod: true,
      paymentStatus: true,
      status: true,
      grandTotal: true,
      discountTotal: true,
      currencyCode: true,
      createdAt: true,
      coupon: {
        select: {
          code: true,
          title: true,
        },
      },
    },
  });

  if (!existing) return null;

  if (input.session?.sub) {
    if (existing.userId !== input.session.sub) {
      throw new AppError(
        "Checkout request key is already used by another account.",
        409,
        "CHECKOUT_REQUEST_KEY_CONFLICT",
      );
    }
  } else if (
    existing.userId !== null ||
    existing.customerEmail.toLowerCase() !== input.inputCustomerEmail.toLowerCase()
  ) {
    throw new AppError(
      "Checkout request key is already used by another session.",
      409,
      "CHECKOUT_REQUEST_KEY_CONFLICT",
    );
  }

  let cardPayment: CardPaymentSessionCreateResult | null = null;
  if (
    existing.paymentMethod === PaymentMethod.CARD &&
    existing.paymentStatus !== PaymentStatus.PAID &&
    existing.status !== OrderStatus.CANCELLED &&
    existing.status !== OrderStatus.REFUNDED
  ) {
    cardPayment = await createCardPaymentSessionForOrder(existing.id);
  }

  return toCheckoutCreateOrderResponse({
    created: existing,
    options: input.options,
    coupon: existing.coupon
      ? {
          code: existing.coupon.code,
          title: existing.coupon.title,
        }
      : null,
    cardPayment,
  });
}

export async function createOrder(
  input: CreateOrderInput,
  session: SessionPayload | null,
  optionsInput: CreateOrderOptions = {},
) {
  const options = await getCheckoutOptions();
  const selectedPaymentMethod = options.paymentMethods.find(
    (method) => method.code === input.paymentMethod,
  );
  if (!selectedPaymentMethod?.enabled) {
    throw new AppError(
      "Selected payment method is currently unavailable. Please choose another method.",
      400,
      "PAYMENT_METHOD_DISABLED",
    );
  }

  const clientRequestId = normalizeClientRequestId(optionsInput.clientRequestId);
  const canUseClientRequestId =
    clientRequestId ? await supportsOrderClientRequestIdColumn() : false;

  if (clientRequestId && canUseClientRequestId) {
    const existingOrder = await findExistingOrderByClientRequestId({
      clientRequestId,
      inputCustomerEmail: input.customerEmail,
      session,
      options,
    });
    if (existingOrder) {
      return existingOrder;
    }
  }

  const shippingMethod = resolveShippingMethodOption(options, input.shippingMethodCode);
  const shippingFeeLkr = shippingMethod?.baseFeeLkr ?? defaultShippingMethods[0].baseFeeLkr;

  const trustedItems = await resolveTrustedCheckoutItems(input.items);

  const shippingMethodRow = await db.shippingMethod.findUnique({
    where: { code: shippingMethod?.code ?? "STANDARD" },
    select: { id: true },
  });

  const addressSnapshot = JSON.stringify({
    billingAddress: serializeAddress(input.billingAddress),
    shippingAddress: serializeAddress(input.shippingAddress),
  });

  const noteParts = [input.notes, `Address snapshot: ${addressSnapshot}`].filter(
    (value): value is string => Boolean(value && value.trim().length),
  );

  const paymentMethodEnum =
    input.paymentMethod === "CARD" ? PaymentMethod.CARD : PaymentMethod.BANK_TRANSFER;
  const initialPaymentStatus =
    paymentMethodEnum === PaymentMethod.BANK_TRANSFER
      ? PaymentStatus.AWAITING_VERIFICATION
      : PaymentStatus.PENDING;

  let responseCoupon: { code: string; title: string } | null = null;
  let responseCardPayment: CardPaymentSessionCreateResult | null = null;
  let stockAlertProductIds: string[] = [];

  let created: CheckoutCreateOrderRecord;
  try {
    created = await db.$transaction(async (tx) => {
      const appliedCoupon = await resolveCouponDiscount(tx, {
        couponCode: input.couponCode,
        items: trustedItems,
        userId: session?.sub ?? null,
        reserveUsage: true,
      });

      responseCoupon = appliedCoupon
        ? { code: appliedCoupon.code, title: appliedCoupon.title }
        : null;

      const amounts = calculateOrderAmounts(
        trustedItems,
        input.currencyCode,
        shippingFeeLkr,
        options.taxRatePercentage,
        appliedCoupon?.discountAmountBase ?? 0,
      );

      let billingAddressId: string | null = null;
      let shippingAddressId: string | null = null;

      if (!session?.sub && (input.billingAddressId || input.shippingAddressId)) {
        throw new AppError(
          "Sign in to use saved addresses from your account.",
          401,
          "AUTH_REQUIRED_FOR_SAVED_ADDRESS",
        );
      }

      if (session?.sub) {
        const selectedAddressIds = [input.billingAddressId, input.shippingAddressId].filter(
          (value): value is string => Boolean(value),
        );

        if (selectedAddressIds.length > 0) {
          const selectedAddresses = await tx.address.findMany({
            where: {
              userId: session.sub,
              id: { in: selectedAddressIds },
            },
            select: { id: true },
          });

          const selectedAddressMap = new Set(selectedAddresses.map((address) => address.id));

          if (input.billingAddressId && !selectedAddressMap.has(input.billingAddressId)) {
            throw new AppError("Selected billing address is invalid.", 400, "INVALID_BILLING_ADDRESS");
          }

          if (input.shippingAddressId && !selectedAddressMap.has(input.shippingAddressId)) {
            throw new AppError(
              "Selected shipping address is invalid.",
              400,
              "INVALID_SHIPPING_ADDRESS",
            );
          }
        }

        if (input.billingAddressId) {
          billingAddressId = input.billingAddressId;
        } else {
          const billingAddress = await tx.address.create({
            data: {
              userId: session.sub,
              label: "Checkout Billing",
              firstName: input.billingAddress.firstName,
              lastName: input.billingAddress.lastName,
              company: input.billingAddress.company,
              phone: input.billingAddress.phone,
              line1: input.billingAddress.line1,
              line2: input.billingAddress.line2,
              city: input.billingAddress.city,
              state: input.billingAddress.state,
              postalCode: input.billingAddress.postalCode,
              countryCode: input.billingAddress.countryCode,
            },
            select: { id: true },
          });
          billingAddressId = billingAddress.id;
        }

        if (input.shippingAddressId) {
          shippingAddressId = input.shippingAddressId;
        } else {
          const shippingAddress = await tx.address.create({
            data: {
              userId: session.sub,
              label: "Checkout Shipping",
              firstName: input.shippingAddress.firstName,
              lastName: input.shippingAddress.lastName,
              company: input.shippingAddress.company,
              phone: input.shippingAddress.phone,
              line1: input.shippingAddress.line1,
              line2: input.shippingAddress.line2,
              city: input.shippingAddress.city,
              state: input.shippingAddress.state,
              postalCode: input.shippingAddress.postalCode,
              countryCode: input.shippingAddress.countryCode,
            },
            select: { id: true },
          });
          shippingAddressId = shippingAddress.id;
        }
      }

      const order = await tx.order.create({
        data: {
          orderNumber: buildOrderNumber(),
          ...(canUseClientRequestId ? { clientRequestId } : {}),
          userId: session?.sub ?? null,
          billingAddressId,
          shippingAddressId,
          shippingMethodId: shippingMethodRow?.id ?? null,
          status: OrderStatus.PENDING,
          paymentStatus: initialPaymentStatus,
          paymentMethod: paymentMethodEnum,
          currencyCode: input.currencyCode,
          exchangeRateToBase: amounts.exchangeRateToBase,
          subtotal: amounts.subtotal,
          discountTotal: amounts.discountTotal,
          shippingFee: amounts.shippingFee,
          taxTotal: amounts.taxTotal,
          grandTotal: amounts.grandTotal,
          couponId: appliedCoupon?.id ?? null,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone,
          notes: noteParts.length ? noteParts.join("\n\n") : null,
        },
        select: {
          id: true,
          orderNumber: true,
          paymentMethod: true,
          paymentStatus: true,
          status: true,
          grandTotal: true,
          discountTotal: true,
          currencyCode: true,
          createdAt: true,
        },
      });

      stockAlertProductIds = await applyOrderStockDeductions(tx, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        actorUserId: session?.sub ?? null,
        lines: amounts.lines,
      });

      await tx.orderItem.createMany({
        data: amounts.lines.map((line) => ({
          orderId: order.id,
          productId: isUuid(line.productId) ? line.productId : null,
          variantId: line.variantId && isUuid(line.variantId) ? line.variantId : null,
          sellerId: line.sellerId && isUuid(line.sellerId) ? line.sellerId : null,
          productName: line.productName,
          sku: null,
          variantName: line.variantLabel,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          lineTotal: line.lineTotal,
          currencyCode: input.currencyCode,
          metadata: {
            slug: line.slug,
            brand: line.brand,
            imageUrl: line.imageUrl,
            unitPriceBase: line.unitPriceBase,
          } satisfies Prisma.InputJsonValue,
        })),
      });

      await tx.payment.create({
        data: {
          orderId: order.id,
          paymentMethod: paymentMethodEnum,
          paymentStatus: initialPaymentStatus,
          transactionReference:
            paymentMethodEnum === PaymentMethod.CARD ? null : `TXN-${order.orderNumber}`,
          gateway:
            paymentMethodEnum === PaymentMethod.CARD
              ? "CARD_GATEWAY_PENDING"
              : "MANUAL_BANK_TRANSFER",
          amount: amounts.grandTotal,
          currencyCode: input.currencyCode,
        },
      });

      if (paymentMethodEnum === PaymentMethod.CARD) {
        responseCardPayment = await createCardPaymentSessionForOrderTx(tx, order.id);
      }

      if (appliedCoupon) {
        await tx.couponUsage.create({
          data: {
            couponId: appliedCoupon.id,
            userId: session?.sub ?? null,
            orderId: order.id,
            discountAmount: appliedCoupon.discountAmountBase,
          },
        });
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          oldStatus: null,
          newStatus: OrderStatus.PENDING,
          changedBy: session?.sub ?? null,
          note: "Order placed from checkout flow",
        },
      });

      return order;
    }, { maxWait: 10_000, timeout: 60_000 });
  } catch (error) {
    if (clientRequestId && canUseClientRequestId && isKnownPrismaError(error, "P2002")) {
      const recoveredOrder = await findExistingOrderByClientRequestId({
        clientRequestId,
        inputCustomerEmail: input.customerEmail,
        session,
        options,
      });
      if (recoveredOrder) {
        return recoveredOrder;
      }
    }
    throw error;
  }

  if (stockAlertProductIds.length > 0) {
    void emitLowStockAdminAlerts(db, {
      productIds: stockAlertProductIds,
      source: "ORDER_PLACED",
    }).catch(() => undefined);
  }

  return toCheckoutCreateOrderResponse({
    created,
    options,
    coupon: responseCoupon,
    cardPayment: responseCardPayment,
  });
}

export async function getOrderSummary(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      currencyCode: true,
      subtotal: true,
      discountTotal: true,
      shippingFee: true,
      taxTotal: true,
      grandTotal: true,
      customerEmail: true,
      customerPhone: true,
      createdAt: true,
      notes: true,
      coupon: {
        select: {
          code: true,
          title: true,
        },
      },
      items: {
        select: {
          id: true,
          productName: true,
          variantName: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          metadata: true,
        },
      },
      paymentProofs: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fileUrl: true,
          fileName: true,
          verificationStatus: true,
          rejectionReason: true,
          createdAt: true,
        },
      },
    },
  });

  if (!order) return null;

  return {
    ...order,
    subtotal: toNumber(order.subtotal),
    discountTotal: toNumber(order.discountTotal),
    shippingFee: toNumber(order.shippingFee),
    taxTotal: toNumber(order.taxTotal),
    grandTotal: toNumber(order.grandTotal),
    items: order.items.map((item) => ({
      ...item,
      unitPrice: toNumber(item.unitPrice),
      lineTotal: toNumber(item.lineTotal),
    })),
  };
}

type AddPaymentProofInput = {
  orderId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  fileUrl: string;
  session: SessionPayload | null;
};

export async function addBankTransferProof(input: AddPaymentProofInput) {
  const order = await db.order.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      paymentMethod: true,
      paymentStatus: true,
    },
  });

  if (!order) return null;
  if (order.paymentMethod !== PaymentMethod.BANK_TRANSFER) return "INVALID_PAYMENT_METHOD" as const;

  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const normalizedFileUrl = input.fileUrl.trim();

  if (!normalizedFileUrl) {
    throw new AppError("Payment proof URL is missing.", 500, "PAYMENT_PROOF_URL_MISSING");
  }

  const proof = await db.$transaction(async (tx) => {
    const createdProof = await tx.paymentProof.create({
      data: {
        orderId: order.id,
        uploadedBy: input.session?.sub ?? null,
        fileUrl: normalizedFileUrl,
        fileName: safeName,
        mimeType: input.mimeType,
        sizeBytes: BigInt(input.sizeBytes),
        verificationStatus: PaymentStatus.AWAITING_VERIFICATION,
      },
      select: {
        id: true,
        fileUrl: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        verificationStatus: true,
        createdAt: true,
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: { paymentStatus: PaymentStatus.AWAITING_VERIFICATION },
      select: { id: true },
    });

    await tx.payment.updateMany({
      where: { orderId: order.id },
      data: { paymentStatus: PaymentStatus.AWAITING_VERIFICATION },
    });

    return createdProof;
  });

  return {
    ...proof,
    sizeBytes: proof.sizeBytes?.toString() ?? null,
  };
}
