import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import {
  archiveAdminProduct,
  updateAdminProduct,
} from "@/lib/services/admin-catalog-service";
import {
  normalizeAdminProductUpdate,
  updateAdminProductSchema,
} from "@/lib/validators/admin-catalog";

type RouteContext = {
  params: Promise<{ productId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const { productId } = await context.params;
    const parsed = updateAdminProductSchema.parse(await request.json());
    const payload = normalizeAdminProductUpdate(parsed);
    const product = await updateAdminProduct(productId, payload);
    return ok(product);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to update product", 400, "ADMIN_PRODUCT_UPDATE_FAILED");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const { productId } = await context.params;
    const result = await archiveAdminProduct(productId);
    return ok(result);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to archive product", 400, "ADMIN_PRODUCT_ARCHIVE_FAILED");
  }
}
