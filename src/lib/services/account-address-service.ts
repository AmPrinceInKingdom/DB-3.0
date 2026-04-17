import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import type {
  AccountAddressCreateInput,
  AccountAddressUpdateInput,
} from "@/lib/validators/account-addresses";
import type { AccountAddress } from "@/types/address";

type AddressRecord = {
  id: string;
  label: string | null;
  firstName: string;
  lastName: string;
  company: string | null;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  countryCode: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function serializeAddress(address: AddressRecord): AccountAddress {
  return {
    id: address.id,
    label: address.label,
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
    isDefaultShipping: address.isDefaultShipping,
    isDefaultBilling: address.isDefaultBilling,
    createdAt: address.createdAt.toISOString(),
    updatedAt: address.updatedAt.toISOString(),
  };
}

async function ensureAtLeastOneDefaultAddress(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  const addresses = await tx.address.findMany({
    where: { userId },
    select: {
      id: true,
      isDefaultShipping: true,
      isDefaultBilling: true,
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  if (addresses.length === 0) return;

  if (!addresses.some((address) => address.isDefaultShipping)) {
    await tx.address.update({
      where: { id: addresses[0].id },
      data: { isDefaultShipping: true },
    });
  }

  if (!addresses.some((address) => address.isDefaultBilling)) {
    await tx.address.update({
      where: { id: addresses[0].id },
      data: { isDefaultBilling: true },
    });
  }
}

export async function listAccountAddresses(userId: string): Promise<AccountAddress[]> {
  const addresses = await db.address.findMany({
    where: { userId },
    orderBy: [{ isDefaultShipping: "desc" }, { isDefaultBilling: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      label: true,
      firstName: true,
      lastName: true,
      company: true,
      phone: true,
      line1: true,
      line2: true,
      city: true,
      state: true,
      postalCode: true,
      countryCode: true,
      isDefaultShipping: true,
      isDefaultBilling: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return addresses.map(serializeAddress);
}

export async function createAccountAddress(
  userId: string,
  input: AccountAddressCreateInput,
): Promise<AccountAddress> {
  const address = await db.$transaction(async (tx) => {
    const existingCount = await tx.address.count({ where: { userId } });
    const autoDefault = existingCount === 0;
    const shouldSetDefaultShipping = autoDefault || input.isDefaultShipping;
    const shouldSetDefaultBilling = autoDefault || input.isDefaultBilling;

    if (shouldSetDefaultShipping) {
      await tx.address.updateMany({
        where: { userId },
        data: { isDefaultShipping: false },
      });
    }

    if (shouldSetDefaultBilling) {
      await tx.address.updateMany({
        where: { userId },
        data: { isDefaultBilling: false },
      });
    }

    return tx.address.create({
      data: {
        userId,
        label: input.label,
        firstName: input.firstName,
        lastName: input.lastName,
        company: input.company,
        phone: input.phone,
        line1: input.line1,
        line2: input.line2,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        countryCode: input.countryCode,
        isDefaultShipping: shouldSetDefaultShipping,
        isDefaultBilling: shouldSetDefaultBilling,
      },
      select: {
        id: true,
        label: true,
        firstName: true,
        lastName: true,
        company: true,
        phone: true,
        line1: true,
        line2: true,
        city: true,
        state: true,
        postalCode: true,
        countryCode: true,
        isDefaultShipping: true,
        isDefaultBilling: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  return serializeAddress(address);
}

export async function updateAccountAddress(
  userId: string,
  addressId: string,
  input: AccountAddressUpdateInput,
): Promise<AccountAddress> {
  const updated = await db.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({
      where: { id: addressId, userId },
      select: { id: true, isDefaultShipping: true, isDefaultBilling: true },
    });

    if (!existing) {
      throw new NotFoundError("Address not found");
    }

    if (input.isDefaultShipping === true) {
      await tx.address.updateMany({
        where: { userId, id: { not: addressId } },
        data: { isDefaultShipping: false },
      });
    }

    if (input.isDefaultBilling === true) {
      await tx.address.updateMany({
        where: { userId, id: { not: addressId } },
        data: { isDefaultBilling: false },
      });
    }

    const address = await tx.address.update({
      where: { id: addressId },
      data: {
        label: input.label,
        firstName: input.firstName,
        lastName: input.lastName,
        company: input.company,
        phone: input.phone,
        line1: input.line1,
        line2: input.line2,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        countryCode: input.countryCode,
        isDefaultShipping: input.isDefaultShipping,
        isDefaultBilling: input.isDefaultBilling,
      },
      select: {
        id: true,
        label: true,
        firstName: true,
        lastName: true,
        company: true,
        phone: true,
        line1: true,
        line2: true,
        city: true,
        state: true,
        postalCode: true,
        countryCode: true,
        isDefaultShipping: true,
        isDefaultBilling: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await ensureAtLeastOneDefaultAddress(tx, userId);
    return address;
  });

  return serializeAddress(updated);
}

export async function deleteAccountAddress(userId: string, addressId: string) {
  await db.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({
      where: { id: addressId, userId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundError("Address not found");
    }

    await tx.address.delete({
      where: { id: addressId },
    });

    await ensureAtLeastOneDefaultAddress(tx, userId);
  });

  return { id: addressId };
}
