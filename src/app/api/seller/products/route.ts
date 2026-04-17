import { ProductStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireSellerSession } from "@/lib/auth/seller-guard";
import {
  createSellerProduct,
  getSellerProductsWorkspace,
} from "@/lib/services/seller-product-service";
import { createSellerProductSchema } from "@/lib/validators/seller-product";

const allowedStatuses = new Set<ProductStatus>([
  ProductStatus.DRAFT,
  ProductStatus.ACTIVE,
  ProductStatus.INACTIVE,
  ProductStatus.ARCHIVED,
]);

export async function GET(request: Request) {
  const auth = await requireSellerSession({ requireActiveSellerProfile: true });
  if (!auth.allowed) return auth.response;

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q");
    const statusQuery = url.searchParams.get("status");

    const status =
      statusQuery && allowedStatuses.has(statusQuery as ProductStatus)
        ? (statusQuery as ProductStatus)
        : undefined;

    const data = await getSellerProductsWorkspace(auth.session.sub, {
      query: query ?? undefined,
      status,
    });

    return ok(data);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to fetch seller products", 500, "SELLER_PRODUCTS_FETCH_FAILED");
  }
}

export async function POST(request: Request) {
  const auth = await requireSellerSession({ requireActiveSellerProfile: true });
  if (!auth.allowed) return auth.response;

  try {
    const payload = createSellerProductSchema.parse(await request.json());
    const product = await createSellerProduct(auth.session.sub, payload);
    return ok(product, 201);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to create product", 400, "SELLER_PRODUCT_CREATE_FAILED");
  }
}
