import { isIP } from "node:net";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CreateAuditLogInput = {
  actorUserId?: string | null;
  action: string;
  targetTable?: string | null;
  targetId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
};

type ListAdminAuditLogsFilters = {
  actionPrefixes?: string[];
  actionTypes?: string[];
  targetTables?: string[];
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
};

type ListAdminAuditLogsPageFilters = ListAdminAuditLogsFilters & {
  page?: number;
};

type ListAdminAuditLogsPageResult = {
  items: Awaited<ReturnType<typeof listAdminAuditLogs>>;
  page: number;
  limit: number;
  hasMore: boolean;
};

function normalizeOptionalText(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

const auditLogSelect = {
  id: true,
  action: true,
  targetTable: true,
  targetId: true,
  ipAddress: true,
  userAgent: true,
  oldValues: true,
  newValues: true,
  createdAt: true,
  actor: {
    select: {
      id: true,
      email: true,
    },
  },
} satisfies Prisma.AuditLogSelect;

function buildAdminAuditLogsWhere(filters: ListAdminAuditLogsFilters) {
  const actionPrefixes = (filters.actionPrefixes ?? [])
    .map((value) => normalizeOptionalText(value)?.toUpperCase())
    .filter((value): value is string => Boolean(value));
  const actionTypes = (filters.actionTypes ?? [])
    .map((value) => normalizeOptionalText(value)?.toUpperCase())
    .filter((value): value is string => Boolean(value));
  const targetTables = (filters.targetTables ?? [])
    .map((value) => normalizeOptionalText(value))
    .filter((value): value is string => Boolean(value));
  const search = normalizeOptionalText(filters.search);
  const dateFrom = filters.dateFrom;
  const dateTo = filters.dateTo;

  const whereClauses: Prisma.AuditLogWhereInput[] = [];

  if (actionPrefixes.length) {
    whereClauses.push({
      OR: actionPrefixes.map((prefix) => ({
        action: {
          startsWith: prefix,
          mode: "insensitive",
        },
      })),
    });
  }

  if (actionTypes.length) {
    whereClauses.push({
      action: {
        in: actionTypes,
      },
    });
  }

  if (targetTables.length) {
    whereClauses.push({
      targetTable: {
        in: targetTables,
      },
    });
  }

  if (search) {
    const orClauses: Prisma.AuditLogWhereInput[] = [
      {
        action: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        targetTable: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        actor: {
          is: {
            email: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      },
    ];

    if (uuidPattern.test(search)) {
      orClauses.push({
        targetId: search,
      });
    }

    whereClauses.push({
      OR: orClauses,
    });
  }

  if (dateFrom || dateTo) {
    whereClauses.push({
      createdAt: {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      },
    });
  }

  return whereClauses.length ? ({ AND: whereClauses } satisfies Prisma.AuditLogWhereInput) : undefined;
}

function toInputJson(value: unknown) {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return {
      message: "Unable to serialize audit payload",
    } satisfies Prisma.InputJsonValue;
  }
}

function isMissingTableError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021";
}

function sanitizeTargetId(value?: string | null) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) return null;
  return uuidPattern.test(normalized) ? normalized : null;
}

function normalizeIpValue(value?: string | null) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) return null;

  let candidate = normalized;
  if (candidate.includes(",")) {
    candidate = candidate.split(",", 1)[0]?.trim() ?? candidate;
  }

  if (candidate.startsWith("[") && candidate.includes("]")) {
    candidate = candidate.slice(1, candidate.indexOf("]"));
  } else {
    const colonParts = candidate.split(":");
    if (colonParts.length === 2 && candidate.includes(".")) {
      candidate = colonParts[0] ?? candidate;
    }
  }

  return isIP(candidate) > 0 ? candidate : null;
}

export function getAuditMetaFromRequest(request: Request) {
  const ipAddress =
    normalizeIpValue(request.headers.get("cf-connecting-ip")) ??
    normalizeIpValue(request.headers.get("x-real-ip")) ??
    normalizeIpValue(request.headers.get("x-forwarded-for"));
  const userAgent = normalizeOptionalText(request.headers.get("user-agent"));

  return {
    ipAddress,
    userAgent,
  };
}

export async function createAuditLog(input: CreateAuditLogInput) {
  const action = normalizeOptionalText(input.action)?.toUpperCase() ?? "UNKNOWN_ACTION";
  const targetTable = normalizeOptionalText(input.targetTable);
  const targetId = sanitizeTargetId(input.targetId);
  const actorUserId = sanitizeTargetId(input.actorUserId);
  const ipAddress = normalizeIpValue(input.ipAddress);
  const userAgent = normalizeOptionalText(input.userAgent);
  const oldValues = toInputJson(input.oldValues);
  const newValues = toInputJson(input.newValues);

  try {
    await db.auditLog.create({
      data: {
        actorUserId,
        action,
        targetTable,
        targetId,
        ipAddress,
        userAgent,
        oldValues,
        newValues,
      },
    });
  } catch (error) {
    if (isMissingTableError(error)) return;
    throw error;
  }
}

export async function listAdminAuditLogs(filters: ListAdminAuditLogsFilters = {}) {
  const take = Math.min(Math.max(filters.limit ?? 40, 1), 200);
  const where = buildAdminAuditLogsWhere(filters);

  try {
    return await db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      select: auditLogSelect,
    });
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
}

export async function listAdminAuditLogsPage(
  filters: ListAdminAuditLogsPageFilters = {},
): Promise<ListAdminAuditLogsPageResult> {
  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
  const pageRaw = Number(filters.page ?? 1);
  const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1;
  const skip = (page - 1) * limit;
  const where = buildAdminAuditLogsWhere(filters);

  try {
    const rows = await db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit + 1,
      select: auditLogSelect,
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      items,
      page,
      limit,
      hasMore,
    };
  } catch (error) {
    if (isMissingTableError(error)) {
      return {
        items: [],
        page,
        limit,
        hasMore: false,
      };
    }
    throw error;
  }
}
