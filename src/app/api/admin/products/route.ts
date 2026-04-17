import { ProductStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import {
  createAdminProduct,
  getAdminProductsWorkspace,
} from "@/lib/services/admin-catalog-service";
import { createAdminProductSchema } from "@/lib/validators/admin-catalog";

const allowedStatuses = new Set<ProductStatus>(Object.values(ProductStatus));

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q");
    const statusQuery = url.searchParams.get("status");

    const status =
      statusQuery && allowedStatuses.has(statusQuery as ProductStatus)
        ? (statusQuery as ProductStatus)
        : undefined;

    const data = await getAdminProductsWorkspace({
      query: query ?? undefined,
      status,
    });
    return ok(data);
  } catch {
    return fail("Unable to fetch products", 500, "ADMIN_PRODUCTS_FETCH_FAILED");
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const payload = createAdminProductSchema.parse(await request.json());
    const product = await createAdminProduct(payload);
    return ok(product, 201);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to create product", 400, "ADMIN_PRODUCT_CREATE_FAILED");
  }
}
