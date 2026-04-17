import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireSellerSession } from "@/lib/auth/seller-guard";
import {
  archiveSellerProduct,
  updateSellerProduct,
} from "@/lib/services/seller-product-service";
import {
  normalizeSellerProductUpdate,
  updateSellerProductSchema,
} from "@/lib/validators/seller-product";

type RouteContext = {
  params: Promise<{ productId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireSellerSession({ requireActiveSellerProfile: true });
  if (!auth.allowed) return auth.response;

  try {
    const { productId } = await context.params;
    const parsed = updateSellerProductSchema.parse(await request.json());
    const payload = normalizeSellerProductUpdate(parsed);
    const product = await updateSellerProduct(auth.session.sub, productId, payload);
    return ok(product);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to update product", 400, "SELLER_PRODUCT_UPDATE_FAILED");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireSellerSession({ requireActiveSellerProfile: true });
  if (!auth.allowed) return auth.response;

  try {
    const { productId } = await context.params;
    const result = await archiveSellerProduct(auth.session.sub, productId);
    return ok(result);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to archive product", 400, "SELLER_PRODUCT_ARCHIVE_FAILED");
  }
}
