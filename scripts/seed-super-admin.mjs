import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";

const presetEnvKeys = new Set(Object.keys(process.env));

function parseEnvValue(raw) {
  const value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function loadEnvFile(filePath, { allowOverrideFromFile = false } = {}) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalIndex = trimmed.indexOf("=");
    if (equalIndex <= 0) continue;

    const key = trimmed.slice(0, equalIndex).trim();
    const value = parseEnvValue(trimmed.slice(equalIndex + 1));
    if (!key) continue;

    if (presetEnvKeys.has(key)) continue;
    if (!allowOverrideFromFile && process.env[key] !== undefined) continue;
    process.env[key] = value;
  }
}

function loadLocalEnv() {
  const projectRoot = process.cwd();
  loadEnvFile(path.join(projectRoot, ".env"));
  loadEnvFile(path.join(projectRoot, ".env.local"), {
    allowOverrideFromFile: true,
  });
}

loadLocalEnv();

const { PrismaClient, AccountStatus, UserRole } = await import("@prisma/client");
const prisma = new PrismaClient();

function readArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function normalizeEmail(raw) {
  if (!raw) return "";
  return String(raw).trim().toLowerCase();
}

function resolveConfig() {
  const email =
    normalizeEmail(readArg("--email")) ||
    normalizeEmail(process.env.SUPER_ADMIN_EMAIL);
  const password =
    readArg("--password")?.trim() ||
    process.env.SUPER_ADMIN_PASSWORD?.trim() ||
    "";
  const firstName =
    readArg("--firstName")?.trim() ||
    process.env.SUPER_ADMIN_FIRST_NAME?.trim() ||
    "Deal";
  const lastName =
    readArg("--lastName")?.trim() ||
    process.env.SUPER_ADMIN_LAST_NAME?.trim() ||
    "Bazaar";
  const phone =
    readArg("--phone")?.trim() || process.env.SUPER_ADMIN_PHONE?.trim() || null;

  if (!email) {
    throw new Error(
      "Missing super admin email. Use --email <value> or SUPER_ADMIN_EMAIL env var.",
    );
  }

  if (!password || password.length < 8) {
    throw new Error(
      "Missing/weak password. Use --password <value> or SUPER_ADMIN_PASSWORD env var (min 8 chars).",
    );
  }

  return {
    email,
    password,
    firstName,
    lastName,
    phone,
  };
}

async function main() {
  const config = resolveConfig();
  const passwordHash = await bcrypt.hash(config.password, 12);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { email: config.email },
      select: { id: true },
    });

    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: {
            email: config.email,
            passwordHash,
            role: UserRole.SUPER_ADMIN,
            status: AccountStatus.ACTIVE,
            emailVerifiedAt: new Date(),
            phone: config.phone,
          },
          select: { id: true, email: true, role: true, status: true },
        })
      : await tx.user.create({
          data: {
            email: config.email,
            passwordHash,
            role: UserRole.SUPER_ADMIN,
            status: AccountStatus.ACTIVE,
            emailVerifiedAt: new Date(),
            phone: config.phone,
          },
          select: { id: true, email: true, role: true, status: true },
        });

    await tx.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        firstName: config.firstName,
        lastName: config.lastName,
      },
      update: {
        firstName: config.firstName,
        lastName: config.lastName,
      },
    });

    await tx.admin.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        canManageAdmins: true,
        notes: "Seeded super admin account",
      },
      update: {
        canManageAdmins: true,
        notes: "Seeded super admin account",
      },
    });

    return user;
  });

  console.log("Super admin ready:");
  console.log(`- ID: ${result.id}`);
  console.log(`- Email: ${result.email}`);
  console.log(`- Role: ${result.role}`);
  console.log(`- Status: ${result.status}`);
  console.log("");
  console.log("Login test (PowerShell):");
  console.log(
    `Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/auth/login" -ContentType "application/json" -Body '{"email":"${result.email}","password":"<your-password>"}'`,
  );
}

main()
  .catch((error) => {
    console.error("Failed to seed super admin:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
