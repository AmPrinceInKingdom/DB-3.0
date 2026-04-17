import { DiscountScope } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import {
  createAdminCoupon,
  getAdminCouponPanelData,
} from "@/lib/services/admin-commerce-service";
import { createCouponSchema } from "@/lib/validators/coupon";

const allowedScopes = new Set(Object.values(DiscountScope));

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const url = new URL(request.url);
    const scopeQuery = url.searchParams.get("scope");
    const activeQuery = url.searchParams.get("active");
    const searchQuery = url.searchParams.get("q");

    const scope =
      scopeQuery && allowedScopes.has(scopeQuery as DiscountScope)
        ? (scopeQuery as DiscountScope)
        : undefined;
    const isActive =
      activeQuery === "true" ? true : activeQuery === "false" ? false : undefined;

    const payload = await getAdminCouponPanelData({
      scope,
      isActive,
      query: searchQuery ?? undefined,
    });

    return ok(payload);
  } catch {
    return fail("Unable to fetch coupons", 500, "ADMIN_COUPON_FETCH_FAILED");
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const payload = createCouponSchema.parse(await request.json());
    const created = await createAdminCoupon(payload, auth.session.sub);
    return ok(created, 201);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to create coupon", 400, "COUPON_CREATE_FAILED");
  }
}
