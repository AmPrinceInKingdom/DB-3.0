import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { db } from "@/lib/db";
import {
  normalizeOptionalBannerUpdate,
  updateBannerSchema,
} from "@/lib/validators/banner";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const { id } = await context.params;
    const payload = updateBannerSchema.parse(await request.json());

    const banner = await db.banner.update({
      where: { id },
      data: normalizeOptionalBannerUpdate(payload),
    });

    return ok(banner);
  } catch {
    return fail("Unable to update banner", 400, "BANNER_UPDATE_FAILED");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const { id } = await context.params;
    await db.banner.delete({ where: { id } });
    return ok({ id });
  } catch {
    return fail("Unable to delete banner", 400, "BANNER_DELETE_FAILED");
  }
}
