import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import {
  deleteAdminCategory,
  updateAdminCategory,
} from "@/lib/services/admin-catalog-service";
import {
  normalizeAdminCategoryUpdate,
  updateAdminCategorySchema,
} from "@/lib/validators/admin-catalog";

type RouteContext = {
  params: Promise<{ categoryId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const { categoryId } = await context.params;
    const parsed = updateAdminCategorySchema.parse(await request.json());
    const payload = normalizeAdminCategoryUpdate(parsed);
    const updated = await updateAdminCategory(categoryId, payload);
    return ok(updated);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to update category", 400, "ADMIN_CATEGORY_UPDATE_FAILED");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const { categoryId } = await context.params;
    const result = await deleteAdminCategory(categoryId);
    return ok(result);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to delete category", 400, "ADMIN_CATEGORY_DELETE_FAILED");
  }
}
