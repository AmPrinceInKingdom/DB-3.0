import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { updateAdminUser } from "@/lib/services/admin-user-service";
import { updateAdminUserSchema } from "@/lib/validators/admin-user";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const { id } = await context.params;
    const payload = updateAdminUserSchema.parse(await request.json());

    const updated = await updateAdminUser({
      targetUserId: id,
      actorUserId: auth.session.sub,
      actorRole: auth.session.role,
      role: payload.role,
      status: payload.status,
    });

    return ok(updated);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to update user", 400, "ADMIN_USER_UPDATE_FAILED");
  }
}
