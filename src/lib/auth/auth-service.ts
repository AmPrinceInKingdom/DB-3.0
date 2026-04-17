import { createHash, randomBytes, randomInt } from "node:crypto";
import { AccountStatus, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, UnauthorizedError } from "@/lib/errors";
import { createSessionToken } from "@/lib/auth/jwt";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { sendVerificationEmail } from "@/lib/services/email-service";
import type {
  EmailVerificationRequestInput,
  EmailVerificationTokenInput,
  ForgotPasswordInput,
  LoginInput,
  OtpVerificationInput,
  OtpVerificationRequestInput,
  RegisterInput,
  ResetPasswordInput,
} from "@/lib/validators/auth";

const emailVerificationPurpose = "EMAIL_VERIFICATION";
const otpLength = 6;
const emailVerificationTokenTtlMinutes = 24 * 60;
const emailVerificationOtpTtlMinutes = 10;
const passwordResetTokenTtlMinutes = 30;
const genericPasswordResetMessage =
  "If your email exists in our system, a password reset link has been sent.";
const genericEmailVerificationMessage =
  "If your email exists in our system, a verification message has been sent.";
const otpPepper = (process.env.OTP_PEPPER ?? "deal-bazaar-otp-pepper").trim();

function shouldRequireEmailVerification(role: UserRole) {
  return role === UserRole.CUSTOMER;
}

function normalizeAppUrl(appUrl?: string) {
  const resolved = (appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
  if (!resolved) return "";
  return resolved.replace(/\/+$/, "");
}

function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

function generateOpaqueTokenSecret() {
  return randomBytes(32).toString("hex");
}

function generateNumericOtpCode() {
  return String(randomInt(0, 10 ** otpLength)).padStart(otpLength, "0");
}

function hashOtpCode(email: string, code: string) {
  return hashSecret(`${otpPepper}:${emailVerificationPurpose}:${email.toLowerCase()}:${code}`);
}

function buildResetUrl(appUrl: string, token: string) {
  return `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
}

function buildEmailVerificationUrl(appUrl: string, token: string) {
  return `${appUrl}/email-verification?token=${encodeURIComponent(token)}`;
}

function logVerificationDebugArtifacts(email: string, verificationUrl: string, otpCode: string | null) {
  if (verificationUrl) {
    console.info(`[auth] Email verification link for ${email}: ${verificationUrl}`);
  }
  if (otpCode) {
    console.info(`[auth] Email verification OTP for ${email}: ${otpCode}`);
  }
}

async function deliverVerificationEmail(params: {
  email: string;
  firstName?: string | null;
  verificationUrl: string;
  otpCode: string | null;
  otpExpiresAt: Date | null;
}) {
  if (!params.verificationUrl && !params.otpCode) {
    return;
  }

  try {
    await sendVerificationEmail({
      toEmail: params.email,
      firstName: params.firstName,
      verificationUrl: params.verificationUrl || undefined,
      otpCode: params.otpCode,
      otpExpiresAt: params.otpExpiresAt,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown email delivery error";
    console.error(`[auth] Unable to send verification email to ${params.email}: ${errorMessage}`);
    const runtimeEnv = String(process.env.NODE_ENV ?? "").toLowerCase();

    if (runtimeEnv === "production") {
      throw new AppError(
        "Unable to send verification email right now. Please try again.",
        503,
        "EMAIL_DELIVERY_FAILED",
      );
    }

    if (runtimeEnv !== "production") {
      logVerificationDebugArtifacts(params.email, params.verificationUrl, params.otpCode);
    }
  }
}

type PublicAuthUser = {
  id: string;
  email: string;
  role: UserRole;
  firstName: string | null;
  lastName: string | null;
  emailVerifiedAt: string | null;
};

type UserSnapshot = {
  id: string;
  email: string;
  role: UserRole;
  emailVerifiedAt: Date | null;
  profile: {
    firstName: string | null;
    lastName: string | null;
  } | null;
};

function toPublicAuthUser(user: UserSnapshot): PublicAuthUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.profile?.firstName ?? null,
    lastName: user.profile?.lastName ?? null,
    emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
  };
}

type VerificationArtifacts = {
  tokenSecret: string | null;
  tokenExpiresAt: Date | null;
  otpCode: string | null;
  otpExpiresAt: Date | null;
};

type VerificationIssueOptions = {
  issueToken: boolean;
  issueOtp: boolean;
};

async function issueEmailVerificationArtifacts(
  userId: string,
  email: string,
  options: VerificationIssueOptions,
): Promise<VerificationArtifacts> {
  const now = new Date();
  const tokenSecret = options.issueToken ? generateOpaqueTokenSecret() : null;
  const tokenExpiresAt = options.issueToken
    ? new Date(Date.now() + emailVerificationTokenTtlMinutes * 60 * 1000)
    : null;
  const otpCode = options.issueOtp ? generateNumericOtpCode() : null;
  const otpExpiresAt = options.issueOtp
    ? new Date(Date.now() + emailVerificationOtpTtlMinutes * 60 * 1000)
    : null;

  await db.$transaction(async (tx) => {
    if (options.issueToken && tokenSecret && tokenExpiresAt) {
      await tx.emailVerificationToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: now },
      });
      await tx.emailVerificationToken.create({
        data: {
          userId,
          tokenHash: hashSecret(tokenSecret),
          expiresAt: tokenExpiresAt,
        },
      });
    }

    if (options.issueOtp && otpCode && otpExpiresAt) {
      await tx.otpCode.updateMany({
        where: {
          userId,
          purpose: emailVerificationPurpose,
          consumedAt: null,
        },
        data: { consumedAt: now },
      });
      await tx.otpCode.create({
        data: {
          userId,
          email,
          purpose: emailVerificationPurpose,
          codeHash: hashOtpCode(email, otpCode),
          expiresAt: otpExpiresAt,
        },
      });
    }
  });

  return {
    tokenSecret,
    tokenExpiresAt,
    otpCode,
    otpExpiresAt,
  };
}

async function markUserEmailVerifiedAndCreateSession(userId: string) {
  const now = new Date();

  const user = await db.$transaction(async (tx) => {
    await tx.emailVerificationToken.updateMany({
      where: {
        userId,
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    });

    await tx.otpCode.updateMany({
      where: {
        userId,
        purpose: emailVerificationPurpose,
        consumedAt: null,
      },
      data: {
        consumedAt: now,
      },
    });

    return tx.user.update({
      where: { id: userId },
      data: {
        emailVerifiedAt: now,
        lastLoginAt: now,
      },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerifiedAt: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  });

  const sessionToken = await createSessionToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    token: sessionToken,
    user: toPublicAuthUser(user),
  };
}

type RegisterUserOptions = {
  appUrl?: string;
  includeDebugArtifacts?: boolean;
};

type RegisterUserResult = {
  user: PublicAuthUser;
  requiresEmailVerification: boolean;
  message: string;
  debugVerificationUrl?: string;
  debugOtpCode?: string;
};

export async function registerUser(
  input: RegisterInput,
  options?: RegisterUserOptions,
): Promise<RegisterUserResult> {
  const existingUser = await db.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existingUser) {
    throw new AppError("An account with this email already exists", 409, "EMAIL_EXISTS");
  }

  const hashedPassword = await hashPassword(input.password);

  const user = await db.user.create({
    data: {
      email: input.email,
      passwordHash: hashedPassword,
      role: UserRole.CUSTOMER,
      status: AccountStatus.ACTIVE,
      profile: {
        create: {
          firstName: input.firstName,
          lastName: input.lastName,
        },
      },
    },
    select: {
      id: true,
      email: true,
      role: true,
      emailVerifiedAt: true,
      profile: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  const artifacts = await issueEmailVerificationArtifacts(user.id, user.email, {
    issueToken: true,
    issueOtp: true,
  });

  const appUrl = normalizeAppUrl(options?.appUrl);
  const verificationUrl =
    appUrl && artifacts.tokenSecret
      ? buildEmailVerificationUrl(appUrl, artifacts.tokenSecret)
      : "";

  await deliverVerificationEmail({
    email: user.email,
    firstName: user.profile?.firstName,
    verificationUrl,
    otpCode: artifacts.otpCode,
    otpExpiresAt: artifacts.otpExpiresAt,
  });

  return {
    user: toPublicAuthUser(user),
    requiresEmailVerification: true,
    message: "Account created. Please verify your email to continue.",
    debugVerificationUrl:
      options?.includeDebugArtifacts && verificationUrl ? verificationUrl : undefined,
    debugOtpCode: options?.includeDebugArtifacts ? artifacts.otpCode ?? undefined : undefined,
  };
}

export async function loginUser(input: LoginInput) {
  const user = await db.user.findUnique({
    where: { email: input.email },
    include: {
      profile: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }

  if (user.status !== AccountStatus.ACTIVE) {
    throw new UnauthorizedError("This account is not active");
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw new UnauthorizedError("Invalid email or password");
  }

  if (shouldRequireEmailVerification(user.role) && !user.emailVerifiedAt) {
    throw new AppError(
      "Please verify your email before signing in.",
      403,
      "EMAIL_NOT_VERIFIED",
    );
  }

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const token = await createSessionToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    token,
    user: toPublicAuthUser(user),
  };
}

type EmailVerificationRequestOptions = {
  appUrl?: string;
  includeDebugArtifacts?: boolean;
};

type EmailVerificationRequestResult = {
  message: string;
  debugVerificationUrl?: string;
  debugOtpCode?: string;
  tokenExpiresAt?: string;
  otpExpiresAt?: string;
};

export async function requestEmailVerification(
  input: EmailVerificationRequestInput,
  options?: EmailVerificationRequestOptions,
): Promise<EmailVerificationRequestResult> {
  const user = await db.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      email: true,
      status: true,
      role: true,
      emailVerifiedAt: true,
      profile: {
        select: {
          firstName: true,
        },
      },
    },
  });

  if (!user || user.status !== AccountStatus.ACTIVE || !shouldRequireEmailVerification(user.role)) {
    return { message: genericEmailVerificationMessage };
  }

  if (user.emailVerifiedAt) {
    return { message: "Email is already verified. You can sign in now." };
  }

  const artifacts = await issueEmailVerificationArtifacts(user.id, user.email, {
    issueToken: true,
    issueOtp: true,
  });

  const appUrl = normalizeAppUrl(options?.appUrl);
  const verificationUrl =
    appUrl && artifacts.tokenSecret
      ? buildEmailVerificationUrl(appUrl, artifacts.tokenSecret)
      : "";

  await deliverVerificationEmail({
    email: user.email,
    firstName: user.profile?.firstName,
    verificationUrl,
    otpCode: artifacts.otpCode,
    otpExpiresAt: artifacts.otpExpiresAt,
  });

  return {
    message: genericEmailVerificationMessage,
    debugVerificationUrl:
      options?.includeDebugArtifacts && verificationUrl ? verificationUrl : undefined,
    debugOtpCode: options?.includeDebugArtifacts ? artifacts.otpCode ?? undefined : undefined,
    tokenExpiresAt:
      options?.includeDebugArtifacts && artifacts.tokenExpiresAt
        ? artifacts.tokenExpiresAt.toISOString()
        : undefined,
    otpExpiresAt:
      options?.includeDebugArtifacts && artifacts.otpExpiresAt
        ? artifacts.otpExpiresAt.toISOString()
        : undefined,
  };
}

export async function verifyEmailWithToken(input: EmailVerificationTokenInput) {
  const tokenHash = hashSecret(input.token);
  const now = new Date();

  const verificationToken = await db.emailVerificationToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      usedAt: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          status: true,
          role: true,
        },
      },
    },
  });

  if (!verificationToken || verificationToken.usedAt || verificationToken.expiresAt <= now) {
    throw new AppError(
      "This verification link is invalid or expired. Please request a new one.",
      400,
      "EMAIL_VERIFICATION_TOKEN_INVALID",
    );
  }

  if (verificationToken.user.status !== AccountStatus.ACTIVE) {
    throw new AppError("This account is not active.", 403, "ACCOUNT_NOT_ACTIVE");
  }

  if (!shouldRequireEmailVerification(verificationToken.user.role)) {
    throw new AppError("Email verification is not required for this account.", 400, "EMAIL_VERIFICATION_NOT_REQUIRED");
  }

  const result = await markUserEmailVerifiedAndCreateSession(verificationToken.userId);
  return {
    ...result,
    message: "Email verified successfully. You are now signed in.",
  };
}

type OtpVerificationRequestOptions = {
  includeDebugArtifacts?: boolean;
};

type OtpVerificationRequestResult = {
  message: string;
  debugOtpCode?: string;
  otpExpiresAt?: string;
};

export async function requestEmailVerificationOtp(
  input: OtpVerificationRequestInput,
  options?: OtpVerificationRequestOptions,
): Promise<OtpVerificationRequestResult> {
  const user = await db.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      email: true,
      status: true,
      role: true,
      emailVerifiedAt: true,
      profile: {
        select: {
          firstName: true,
        },
      },
    },
  });

  if (!user || user.status !== AccountStatus.ACTIVE || !shouldRequireEmailVerification(user.role)) {
    return { message: genericEmailVerificationMessage };
  }

  if (user.emailVerifiedAt) {
    return { message: "Email is already verified. You can sign in now." };
  }

  const artifacts = await issueEmailVerificationArtifacts(user.id, user.email, {
    issueToken: false,
    issueOtp: true,
  });

  await deliverVerificationEmail({
    email: user.email,
    firstName: user.profile?.firstName,
    verificationUrl: "",
    otpCode: artifacts.otpCode,
    otpExpiresAt: artifacts.otpExpiresAt,
  });

  return {
    message: "A verification code has been sent. Enter it to verify your email.",
    debugOtpCode: options?.includeDebugArtifacts ? artifacts.otpCode ?? undefined : undefined,
    otpExpiresAt:
      options?.includeDebugArtifacts && artifacts.otpExpiresAt
        ? artifacts.otpExpiresAt.toISOString()
        : undefined,
  };
}

export async function verifyEmailWithOtp(input: OtpVerificationInput) {
  const user = await db.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      email: true,
      status: true,
      role: true,
      emailVerifiedAt: true,
    },
  });

  if (!user || user.status !== AccountStatus.ACTIVE || !shouldRequireEmailVerification(user.role)) {
    throw new AppError("Invalid verification request.", 400, "OTP_VERIFICATION_INVALID");
  }

  if (user.emailVerifiedAt) {
    const token = await createSessionToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: null,
        lastName: null,
        emailVerifiedAt: user.emailVerifiedAt.toISOString(),
      } satisfies PublicAuthUser,
      message: "Email already verified. You are now signed in.",
    };
  }

  const now = new Date();
  const codeHash = hashOtpCode(user.email, input.code);

  const otpRecord = await db.otpCode.findFirst({
    where: {
      userId: user.id,
      purpose: emailVerificationPurpose,
      codeHash,
      consumedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
    },
  });

  if (!otpRecord) {
    throw new AppError("Invalid or expired OTP code.", 400, "OTP_INVALID");
  }

  await db.otpCode.update({
    where: { id: otpRecord.id },
    data: {
      consumedAt: now,
    },
  });

  const result = await markUserEmailVerifiedAndCreateSession(user.id);
  return {
    ...result,
    message: "OTP verified successfully. You are now signed in.",
  };
}

type PasswordResetRequestOptions = {
  appUrl?: string;
  includeDebugToken?: boolean;
};

type PasswordResetRequestResult = {
  message: string;
  debugResetUrl?: string;
  expiresAt?: string;
};

export async function requestPasswordReset(
  input: ForgotPasswordInput,
  options?: PasswordResetRequestOptions,
): Promise<PasswordResetRequestResult> {
  const user = await db.user.findUnique({
    where: { email: input.email },
    select: { id: true, email: true, status: true },
  });

  if (!user || user.status !== AccountStatus.ACTIVE) {
    return { message: genericPasswordResetMessage };
  }

  const tokenSecret = generateOpaqueTokenSecret();
  const tokenHash = hashSecret(tokenSecret);
  const expiresAt = new Date(Date.now() + passwordResetTokenTtlMinutes * 60 * 1000);
  const now = new Date();

  await db.$transaction([
    db.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    }),
    db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    }),
  ]);

  const appUrl = normalizeAppUrl(options?.appUrl);
  const resetUrl = appUrl ? buildResetUrl(appUrl, tokenSecret) : "";

  if (resetUrl) {
    console.info(`[auth] Password reset link for ${user.email}: ${resetUrl}`);
  } else {
    console.info(`[auth] Password reset token for ${user.email}: ${tokenSecret}`);
  }

  if (!options?.includeDebugToken) {
    return { message: genericPasswordResetMessage };
  }

  return {
    message: genericPasswordResetMessage,
    debugResetUrl: resetUrl || undefined,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function resetPasswordWithToken(input: ResetPasswordInput) {
  const tokenHash = hashSecret(input.token);
  const now = new Date();

  const resetRecord = await db.passwordResetToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      usedAt: true,
      expiresAt: true,
      user: {
        select: {
          status: true,
        },
      },
    },
  });

  if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt <= now) {
    throw new AppError(
      "This password reset link is invalid or expired. Please request a new link.",
      400,
      "RESET_TOKEN_INVALID",
    );
  }

  if (resetRecord.user.status !== AccountStatus.ACTIVE) {
    throw new AppError("This account is not active.", 403, "ACCOUNT_NOT_ACTIVE");
  }

  const hashedPassword = await hashPassword(input.password);

  await db.$transaction([
    db.user.update({
      where: { id: resetRecord.userId },
      data: {
        passwordHash: hashedPassword,
        updatedAt: now,
      },
    }),
    db.passwordResetToken.updateMany({
      where: {
        userId: resetRecord.userId,
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    }),
  ]);

  return {
    message: "Password has been reset successfully. You can now sign in.",
  };
}
