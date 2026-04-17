import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import {
  createAdminCategory,
  getAdminCategoriesWorkspace,
} from "@/lib/services/admin-catalog-service";
import { createAdminCategorySchema } from "@/lib/validators/admin-catalog";

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q");
    const activeQuery = url.searchParams.get("active");

    const isActive =
      activeQuery === "true" ? true : activeQuery === "false" ? false : undefined;

    const data = await getAdminCategoriesWorkspace({
      query: query ?? undefined,
      isActive,
    });

    return ok(data);
  } catch {
    return fail("Unable to fetch categories", 500, "ADMIN_CATEGORIES_FETCH_FAILED");
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const payload = createAdminCategorySchema.parse(await request.json());
    const created = await createAdminCategory(payload);
    return ok(created, 201);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to create category", 400, "ADMIN_CATEGORY_CREATE_FAILED");
  }
}
