import { db } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import type { AccountProfilePayload } from "@/types/account-profile";
import type { AccountProfileUpdateInput } from "@/lib/validators/account-profile";

const languageOptions: AccountProfilePayload["options"]["languages"] = [
  { code: "en", label: "English" },
  { code: "si", label: "Sinhala" },
];

const themeModes: AccountProfilePayload["options"]["themeModes"] = ["system", "light", "dark"];

export async function getAccountProfile(userId: string): Promise<AccountProfilePayload> {
  const [user, currencies] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        createdAt: true,
        lastLoginAt: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
            preferredCurrency: true,
            preferredLanguage: true,
            themePreference: true,
          },
        },
      },
    }),
    db.supportedCurrency.findMany({
      where: { isActive: true },
      orderBy: [{ code: "asc" }],
      select: {
        code: true,
        name: true,
        symbol: true,
      },
    }),
  ]);

  if (!user) {
    throw new NotFoundError("User not found");
  }

  return {
    profile: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.profile?.firstName ?? "",
      lastName: user.profile?.lastName ?? "",
      preferredCurrency: user.profile?.preferredCurrency ?? "LKR",
      preferredLanguage: user.profile?.preferredLanguage === "si" ? "si" : "en",
      themePreference:
        user.profile?.themePreference === "dark" || user.profile?.themePreference === "light"
          ? user.profile.themePreference
          : "system",
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    },
    options: {
      currencies,
      languages: languageOptions,
      themeModes,
    },
  };
}

export async function updateAccountProfile(
  userId: string,
  input: AccountProfileUpdateInput,
): Promise<AccountProfilePayload> {
  const supportedCurrency = await db.supportedCurrency.findFirst({
    where: { code: input.preferredCurrency, isActive: true },
    select: { code: true },
  });

  if (!supportedCurrency) {
    throw new AppError("Selected currency is not supported.", 400, "UNSUPPORTED_CURRENCY");
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        phone: input.phone,
      },
      select: { id: true },
    });

    await tx.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        firstName: input.firstName,
        lastName: input.lastName,
        preferredCurrency: input.preferredCurrency,
        preferredLanguage: input.preferredLanguage,
        themePreference: input.themePreference,
      },
      update: {
        firstName: input.firstName,
        lastName: input.lastName,
        preferredCurrency: input.preferredCurrency,
        preferredLanguage: input.preferredLanguage,
        themePreference: input.themePreference,
      },
      select: { userId: true },
    });
  });

  return getAccountProfile(userId);
}
