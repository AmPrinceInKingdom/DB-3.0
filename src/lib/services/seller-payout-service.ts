import {
  AccountStatus,
  NotificationType,
  Prisma,
  PayoutStatus,
  UserRole,
} from "@prisma/client";
import { AppError, NotFoundError } from "@/lib/errors";
import { db } from "@/lib/db";
import {
  getNotificationSettings,
  isNotificationTypeEnabled,
} from "@/lib/services/notification-settings-service";
import { canSendInAppNotification } from "@/lib/services/user-notification-preferences-service";
import type {
  AdminPayoutListItem,
  AdminPayoutWorkspace,
  SellerPayoutAccountItem,
  SellerPayoutWorkspace,
} from "@/types/seller-payout";
import type {
  AdminCreatePayoutInput,
  AdminUpdatePayoutInput,
  SellerPayoutAccountCreateInput,
  SellerPayoutAccountUpdateInput,
} from "@/lib/validators/seller-payout";

type DecimalLike = Prisma.Decimal | number | string | null;

function toNumber(value: DecimalLike, fallback = 0) {
  if (value === null) return fallback;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return Number(value.toString());
}

function normalizeOptionalText(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function maskAccountNumber(accountNumber: string) {
  const trimmed = accountNumber.trim();
  if (trimmed.length <= 4) return trimmed;
  return `${"*".repeat(Math.max(0, trimmed.length - 4))}${trimmed.slice(-4)}`;
}

async function requireActiveSellerProfile(sellerUserId: string) {
  const seller = await db.seller.findUnique({
    where: { userId: sellerUserId },
    select: {
      userId: true,
      status: true,
    },
  });

  if (!seller || seller.status !== "ACTIVE") {
    throw new AppError("Active seller profile required", 403, "SELLER_PROFILE_INACTIVE");
  }

  return seller;
}

function mapSellerPayoutAccount(
  account: {
    id: string;
    bankName: string;
    accountName: string;
    accountNumber: string;
    branchName: string | null;
    swiftCode: string | null;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
): SellerPayoutAccountItem {
  return {
    id: account.id,
    bankName: account.bankName,
    accountName: account.accountName,
    accountNumber: account.accountNumber,
    accountNumberMasked: maskAccountNumber(account.accountNumber),
    branchName: account.branchName,
    swiftCode: account.swiftCode,
    isDefault: account.isDefault,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

function mapAdminPayoutItem(
  item: {
    id: string;
    amount: Prisma.Decimal;
    currencyCode: string;
    status: PayoutStatus;
    periodStart: Date | null;
    periodEnd: Date | null;
    paidAt: Date | null;
    reference: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    seller: {
      userId: string;
      storeName: string;
      storeSlug: string;
      user: {
        email: string;
      };
      payoutAccounts: Array<{
        bankName: string;
        accountName: string;
        accountNumber: string;
        branchName: string | null;
        swiftCode: string | null;
      }>;
    };
  },
): AdminPayoutListItem {
  const defaultAccount = item.seller.payoutAccounts[0];

  return {
    id: item.id,
    seller: {
      userId: item.seller.userId,
      storeName: item.seller.storeName,
      storeSlug: item.seller.storeSlug,
      email: item.seller.user.email,
      defaultPayoutAccount: defaultAccount
        ? {
            bankName: defaultAccount.bankName,
            accountName: defaultAccount.accountName,
            accountNumberMasked: maskAccountNumber(defaultAccount.accountNumber),
            branchName: defaultAccount.branchName,
            swiftCode: defaultAccount.swiftCode,
          }
        : null,
    },
    amount: toNumber(item.amount),
    currencyCode: item.currencyCode,
    status: item.status,
    periodStart: item.periodStart ? item.periodStart.toISOString() : null,
    periodEnd: item.periodEnd ? item.periodEnd.toISOString() : null,
    paidAt: item.paidAt ? item.paidAt.toISOString() : null,
    reference: item.reference,
    notes: item.notes,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

async function ensureSupportedCurrency(currencyCode: string) {
  const currency = await db.supportedCurrency.findUnique({
    where: { code: currencyCode },
    select: {
      code: true,
      isActive: true,
    },
  });

  if (!currency || !currency.isActive) {
    throw new AppError("Selected currency is not supported", 400, "PAYOUT_INVALID_CURRENCY");
  }
}

export async function getSellerPayoutWorkspace(sellerUserId: string): Promise<SellerPayoutWorkspace> {
  await requireActiveSellerProfile(sellerUserId);

  const [accounts, payouts] = await Promise.all([
    db.sellerPayoutAccount.findMany({
      where: { sellerId: sellerUserId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        bankName: true,
        accountName: true,
        accountNumber: true,
        branchName: true,
        swiftCode: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.sellerPayout.findMany({
      where: { sellerId: sellerUserId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        amount: true,
        currencyCode: true,
        status: true,
        periodStart: true,
        periodEnd: true,
        paidAt: true,
        reference: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const totalPaidByCurrencyMap = new Map<string, number>();
  let pendingCount = 0;
  let processingCount = 0;
  let paidCount = 0;
  let failedCount = 0;

  for (const payout of payouts) {
    if (payout.status === PayoutStatus.PENDING) pendingCount += 1;
    if (payout.status === PayoutStatus.PROCESSING) processingCount += 1;
    if (payout.status === PayoutStatus.PAID) {
      paidCount += 1;
      const current = totalPaidByCurrencyMap.get(payout.currencyCode) ?? 0;
      totalPaidByCurrencyMap.set(payout.currencyCode, current + toNumber(payout.amount));
    }
    if (payout.status === PayoutStatus.FAILED) failedCount += 1;
  }

  return {
    summary: {
      totalPayouts: payouts.length,
      pendingCount,
      processingCount,
      paidCount,
      failedCount,
      latestPayoutAt: payouts[0]?.createdAt.toISOString() ?? null,
      totalPaidByCurrency: Array.from(totalPaidByCurrencyMap.entries()).map(
        ([currencyCode, totalAmount]) => ({
          currencyCode,
          totalAmount: Number(totalAmount.toFixed(2)),
        }),
      ),
    },
    accounts: accounts.map(mapSellerPayoutAccount),
    payouts: payouts.map((payout) => ({
      id: payout.id,
      amount: toNumber(payout.amount),
      currencyCode: payout.currencyCode,
      status: payout.status,
      periodStart: payout.periodStart ? payout.periodStart.toISOString() : null,
      periodEnd: payout.periodEnd ? payout.periodEnd.toISOString() : null,
      paidAt: payout.paidAt ? payout.paidAt.toISOString() : null,
      reference: payout.reference,
      notes: payout.notes,
      createdAt: payout.createdAt.toISOString(),
      updatedAt: payout.updatedAt.toISOString(),
    })),
  };
}

export async function createSellerPayoutAccount(
  sellerUserId: string,
  input: SellerPayoutAccountCreateInput,
) {
  await requireActiveSellerProfile(sellerUserId);

  return db.$transaction(async (tx) => {
    const existingCount = await tx.sellerPayoutAccount.count({
      where: { sellerId: sellerUserId },
    });

    const shouldBeDefault = input.isDefault || existingCount === 0;

    if (shouldBeDefault) {
      await tx.sellerPayoutAccount.updateMany({
        where: { sellerId: sellerUserId },
        data: { isDefault: false },
      });
    }

    const account = await tx.sellerPayoutAccount.create({
      data: {
        sellerId: sellerUserId,
        bankName: input.bankName.trim(),
        accountName: input.accountName.trim(),
        accountNumber: input.accountNumber.trim(),
        branchName: normalizeOptionalText(input.branchName),
        swiftCode: normalizeOptionalText(input.swiftCode),
        isDefault: shouldBeDefault,
      },
      select: {
        id: true,
        bankName: true,
        accountName: true,
        accountNumber: true,
        branchName: true,
        swiftCode: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return mapSellerPayoutAccount(account);
  });
}

export async function updateSellerPayoutAccount(
  sellerUserId: string,
  accountId: string,
  input: SellerPayoutAccountUpdateInput,
) {
  await requireActiveSellerProfile(sellerUserId);

  return db.$transaction(async (tx) => {
    const account = await tx.sellerPayoutAccount.findFirst({
      where: {
        id: accountId,
        sellerId: sellerUserId,
      },
      select: {
        id: true,
      },
    });

    if (!account) {
      throw new NotFoundError("Payout account not found");
    }

    if (input.isDefault === true) {
      await tx.sellerPayoutAccount.updateMany({
        where: { sellerId: sellerUserId },
        data: { isDefault: false },
      });
    }

    const updated = await tx.sellerPayoutAccount.update({
      where: { id: account.id },
      data: {
        ...(input.bankName !== undefined ? { bankName: input.bankName.trim() } : {}),
        ...(input.accountName !== undefined ? { accountName: input.accountName.trim() } : {}),
        ...(input.accountNumber !== undefined ? { accountNumber: input.accountNumber.trim() } : {}),
        ...(input.branchName !== undefined
          ? { branchName: normalizeOptionalText(input.branchName) }
          : {}),
        ...(input.swiftCode !== undefined
          ? { swiftCode: normalizeOptionalText(input.swiftCode) }
          : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      },
      select: {
        id: true,
        bankName: true,
        accountName: true,
        accountNumber: true,
        branchName: true,
        swiftCode: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return mapSellerPayoutAccount(updated);
  });
}

export async function deleteSellerPayoutAccount(sellerUserId: string, accountId: string) {
  await requireActiveSellerProfile(sellerUserId);

  return db.$transaction(async (tx) => {
    const account = await tx.sellerPayoutAccount.findFirst({
      where: {
        id: accountId,
        sellerId: sellerUserId,
      },
      select: {
        id: true,
        isDefault: true,
      },
    });

    if (!account) {
      throw new NotFoundError("Payout account not found");
    }

    await tx.sellerPayoutAccount.delete({
      where: { id: account.id },
    });

    if (account.isDefault) {
      const nextAccount = await tx.sellerPayoutAccount.findFirst({
        where: { sellerId: sellerUserId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

      if (nextAccount) {
        await tx.sellerPayoutAccount.update({
          where: { id: nextAccount.id },
          data: { isDefault: true },
        });
      }
    }

    return { id: accountId };
  });
}

type AdminPayoutFilters = {
  query?: string;
  status?: PayoutStatus;
  sellerId?: string;
};

export async function getAdminPayoutWorkspace(
  filters: AdminPayoutFilters = {},
): Promise<AdminPayoutWorkspace> {
  const queryText = normalizeOptionalText(filters.query);

  const where: Prisma.SellerPayoutWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.sellerId ? { sellerId: filters.sellerId } : {}),
    ...(queryText
      ? {
          OR: [
            { reference: { contains: queryText, mode: "insensitive" } },
            { notes: { contains: queryText, mode: "insensitive" } },
            { seller: { storeName: { contains: queryText, mode: "insensitive" } } },
            { seller: { storeSlug: { contains: queryText, mode: "insensitive" } } },
            { seller: { user: { email: { contains: queryText, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const [payouts, sellerOptions] = await Promise.all([
    db.sellerPayout.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 300,
      select: {
        id: true,
        amount: true,
        currencyCode: true,
        status: true,
        periodStart: true,
        periodEnd: true,
        paidAt: true,
        reference: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        seller: {
          select: {
            userId: true,
            storeName: true,
            storeSlug: true,
            user: {
              select: {
                email: true,
              },
            },
            payoutAccounts: {
              where: {
                isDefault: true,
              },
              take: 1,
              select: {
                bankName: true,
                accountName: true,
                accountNumber: true,
                branchName: true,
                swiftCode: true,
              },
            },
          },
        },
      },
    }),
    db.seller.findMany({
      where: {
        status: AccountStatus.ACTIVE,
        user: {
          status: AccountStatus.ACTIVE,
          deletedAt: null,
          role: {
            in: [UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN],
          },
        },
      },
      orderBy: { storeName: "asc" },
      select: {
        userId: true,
        storeName: true,
        storeSlug: true,
        user: {
          select: { email: true },
        },
      },
    }),
  ]);

  return {
    payouts: payouts.map(mapAdminPayoutItem),
    sellerOptions: sellerOptions.map((seller) => ({
      userId: seller.userId,
      storeName: seller.storeName,
      storeSlug: seller.storeSlug,
      email: seller.user.email,
    })),
  };
}

export async function createAdminPayout(input: AdminCreatePayoutInput) {
  await ensureSupportedCurrency(input.currencyCode);

  const seller = await db.seller.findUnique({
    where: { userId: input.sellerId },
    select: {
      userId: true,
      status: true,
      storeName: true,
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  if (!seller || seller.status !== AccountStatus.ACTIVE) {
    throw new AppError("Selected seller is not active", 400, "PAYOUT_SELLER_INACTIVE");
  }

  const created = await db.$transaction(async (tx) => {
    const payout = await tx.sellerPayout.create({
      data: {
        sellerId: input.sellerId,
        amount: input.amount,
        currencyCode: input.currencyCode,
        status: PayoutStatus.PENDING,
        periodStart: input.periodStart ? new Date(input.periodStart) : null,
        periodEnd: input.periodEnd ? new Date(input.periodEnd) : null,
        reference: normalizeOptionalText(input.reference),
        notes: normalizeOptionalText(input.notes),
      },
      select: {
        id: true,
      },
    });

    const settings = await getNotificationSettings(tx);
    const canSendPayoutNotification = isNotificationTypeEnabled(settings, NotificationType.SYSTEM)
      ? await canSendInAppNotification(tx, seller.user.id, NotificationType.SYSTEM)
      : false;

    if (canSendPayoutNotification) {
      await tx.notification.create({
        data: {
          userId: seller.user.id,
          type: NotificationType.SYSTEM,
          title: "Payout initiated",
          message: `A payout of ${input.currencyCode} ${input.amount.toFixed(
            2,
          )} has been created for your store.`,
          linkUrl: "/seller/payouts",
          metadata: {
            payoutId: payout.id,
            sellerId: seller.userId,
          } satisfies Prisma.InputJsonValue,
          sentAt: new Date(),
        },
      });
    }

    return payout;
  });

  return created;
}

const allowedPayoutTransitions: Record<PayoutStatus, PayoutStatus[]> = {
  PENDING: [PayoutStatus.PROCESSING, PayoutStatus.PAID, PayoutStatus.FAILED],
  PROCESSING: [PayoutStatus.PAID, PayoutStatus.FAILED],
  PAID: [],
  FAILED: [PayoutStatus.PROCESSING, PayoutStatus.PAID],
};

export async function updateAdminPayout(payoutId: string, input: AdminUpdatePayoutInput) {
  return db.$transaction(async (tx) => {
    const current = await tx.sellerPayout.findUnique({
      where: { id: payoutId },
      select: {
        id: true,
        sellerId: true,
        status: true,
        amount: true,
        currencyCode: true,
        seller: {
          select: {
            storeName: true,
            user: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!current) {
      throw new NotFoundError("Payout not found");
    }

    if (input.status && input.status !== current.status) {
      const allowed = allowedPayoutTransitions[current.status] ?? [];
      if (!allowed.includes(input.status)) {
        throw new AppError(
          `Cannot change payout from ${current.status} to ${input.status}`,
          400,
          "PAYOUT_INVALID_STATUS_TRANSITION",
        );
      }
    }

    const nextStatus = input.status ?? current.status;
    const updated = await tx.sellerPayout.update({
      where: { id: current.id },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.reference !== undefined ? { reference: normalizeOptionalText(input.reference) } : {}),
        ...(input.notes !== undefined ? { notes: normalizeOptionalText(input.notes) } : {}),
        ...(input.paidAt !== undefined
          ? { paidAt: input.paidAt ? new Date(input.paidAt) : null }
          : nextStatus === PayoutStatus.PAID
            ? { paidAt: new Date() }
            : {}),
      },
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    });

    if (input.status && input.status !== current.status) {
      const settings = await getNotificationSettings(tx);
      const canSendStatusNotification = isNotificationTypeEnabled(
        settings,
        NotificationType.SYSTEM,
      )
        ? await canSendInAppNotification(tx, current.seller.user.id, NotificationType.SYSTEM)
        : false;

      if (canSendStatusNotification) {
        await tx.notification.create({
          data: {
            userId: current.seller.user.id,
            type: NotificationType.SYSTEM,
            title:
              nextStatus === PayoutStatus.PAID
                ? "Payout completed"
                : nextStatus === PayoutStatus.FAILED
                  ? "Payout failed"
                  : "Payout status updated",
            message:
              nextStatus === PayoutStatus.PAID
                ? `Your payout of ${current.currencyCode} ${toNumber(current.amount).toFixed(
                    2,
                  )} has been marked as paid.`
                : `Payout status for ${current.seller.storeName} is now ${nextStatus}.`,
            linkUrl: "/seller/payouts",
            metadata: {
              payoutId: current.id,
              status: nextStatus,
            } satisfies Prisma.InputJsonValue,
            sentAt: new Date(),
          },
        });
      }
    }

    return updated;
  });
}
