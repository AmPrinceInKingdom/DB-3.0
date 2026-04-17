import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import {
  deleteAdminSubcategory,
  updateAdminSubcategory,
} from "@/lib/services/admin-catalog-service";
import {
  normalizeAdminSubcategoryUpdate,
  updateAdminSubcategorySchema,
} from "@/lib/validators/admin-catalog";

type RouteContext = {
  params: Promise<{ subcategoryId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const { subcategoryId } = await context.params;
    const parsed = updateAdminSubcategorySchema.parse(await request.json());
    const payload = normalizeAdminSubcategoryUpdate(parsed);
    const updated = await updateAdminSubcategory(subcategoryId, payload);
    return ok(updated);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to update subcategory", 400, "ADMIN_SUBCATEGORY_UPDATE_FAILED");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const { subcategoryId } = await context.params;
    const result = await deleteAdminSubcategory(subcategoryId);
    return ok(result);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to delete subcategory", 400, "ADMIN_SUBCATEGORY_DELETE_FAILED");
  }
}
