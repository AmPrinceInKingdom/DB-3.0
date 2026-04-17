import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { deleteAdminBrand, updateAdminBrand } from "@/lib/services/admin-catalog-service";
import {
  normalizeAdminBrandUpdate,
  updateAdminBrandSchema,
} from "@/lib/validators/admin-catalog";

type RouteContext = {
  params: Promise<{ brandId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const { brandId } = await context.params;
    const parsed = updateAdminBrandSchema.parse(await request.json());
    const payload = normalizeAdminBrandUpdate(parsed);
    const updated = await updateAdminBrand(brandId, payload);
    return ok(updated);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to update brand", 400, "ADMIN_BRAND_UPDATE_FAILED");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const { brandId } = await context.params;
    const result = await deleteAdminBrand(brandId);
    return ok(result);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to delete brand", 400, "ADMIN_BRAND_DELETE_FAILED");
  }
}
