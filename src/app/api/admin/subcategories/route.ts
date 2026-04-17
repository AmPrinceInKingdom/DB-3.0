import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { createAdminSubcategory } from "@/lib/services/admin-catalog-service";
import { createAdminSubcategorySchema } from "@/lib/validators/admin-catalog";

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const payload = createAdminSubcategorySchema.parse(await request.json());
    const created = await createAdminSubcategory(payload);
    return ok(created, 201);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to create subcategory", 400, "ADMIN_SUBCATEGORY_CREATE_FAILED");
  }
}
