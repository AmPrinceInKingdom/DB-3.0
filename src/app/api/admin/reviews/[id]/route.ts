import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import {
  deleteAdminReview,
  moderateAdminReview,
} from "@/lib/services/admin-commerce-service";
import { updateReviewStatusSchema } from "@/lib/validators/review";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const { id } = await context.params;
    const payload = updateReviewStatusSchema.parse(await request.json());
    const updated = await moderateAdminReview({
      reviewId: id,
      status: payload.status,
      changedByUserId: auth.session.sub,
    });
    return ok(updated);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to update review status", 400, "REVIEW_STATUS_UPDATE_FAILED");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const { id } = await context.params;
    const deleted = await deleteAdminReview(id);
    return ok(deleted);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to delete review", 400, "REVIEW_DELETE_FAILED");
  }
}
