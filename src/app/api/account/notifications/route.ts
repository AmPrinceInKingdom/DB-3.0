import { NotificationType } from "@prisma/client";
import { fail, ok } from "@/lib/api-response";
import { getCurrentSession } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { listCustomerNotifications } from "@/lib/services/customer-notification-service";

const allowedReadFilters = new Set(["all", "read", "unread"]);
const notificationTypeSet = new Set(Object.values(NotificationType));

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return fail("Authentication required", 401, "UNAUTHENTICATED");
  }

  try {
    const url = new URL(request.url);
    const queryText = url.searchParams.get("q");
    const typeQuery = url.searchParams.get("type");
    const readQuery = url.searchParams.get("read");
    const page = parsePositiveInt(url.searchParams.get("page"), 1);
    const limit = parsePositiveInt(url.searchParams.get("limit"), 20);

    const type =
      typeQuery && notificationTypeSet.has(typeQuery as NotificationType)
        ? (typeQuery as NotificationType)
        : undefined;

    const readFilter =
      readQuery && allowedReadFilters.has(readQuery)
        ? (readQuery as "all" | "read" | "unread")
        : "all";

    const payload = await listCustomerNotifications(session.sub, {
      query: queryText ?? undefined,
      type,
      readFilter,
      page,
      limit,
    });

    return ok(payload);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to fetch notifications", 500, "ACCOUNT_NOTIFICATIONS_FETCH_FAILED");
  }
}
