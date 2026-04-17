import { PayoutStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import {
  createAdminPayout,
  getAdminPayoutWorkspace,
} from "@/lib/services/seller-payout-service";
import { adminCreatePayoutSchema } from "@/lib/validators/seller-payout";

const allowedStatuses = new Set(Object.values(PayoutStatus));

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q");
    const statusQuery = url.searchParams.get("status");
    const sellerId = url.searchParams.get("sellerId");

    const status =
      statusQuery && allowedStatuses.has(statusQuery as PayoutStatus)
        ? (statusQuery as PayoutStatus)
        : undefined;

    const data = await getAdminPayoutWorkspace({
      query: query ?? undefined,
      status,
      sellerId: sellerId ?? undefined,
    });

    return ok(data);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to fetch payouts", 500, "ADMIN_PAYOUTS_FETCH_FAILED");
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const payload = adminCreatePayoutSchema.parse(await request.json());
    const payout = await createAdminPayout(payload);
    return ok(payout, 201);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to create payout", 400, "ADMIN_PAYOUT_CREATE_FAILED");
  }
}
