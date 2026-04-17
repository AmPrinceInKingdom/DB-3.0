import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import {
  createAdminBrand,
  getAdminBrandsWorkspace,
} from "@/lib/services/admin-catalog-service";
import { createAdminBrandSchema } from "@/lib/validators/admin-catalog";

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q");
    const activeQuery = url.searchParams.get("active");

    const isActive =
      activeQuery === "true" ? true : activeQuery === "false" ? false : undefined;

    const data = await getAdminBrandsWorkspace({
      query: query ?? undefined,
      isActive,
    });
    return ok(data);
  } catch {
    return fail("Unable to fetch brands", 500, "ADMIN_BRANDS_FETCH_FAILED");
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const payload = createAdminBrandSchema.parse(await request.json());
    const created = await createAdminBrand(payload);
    return ok(created, 201);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to create brand", 400, "ADMIN_BRAND_CREATE_FAILED");
  }
}
