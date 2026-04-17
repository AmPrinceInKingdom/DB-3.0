import { fail, ok } from "@/lib/api-response";
import { getCurrentSession } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import {
  deleteAccountReview,
  updateAccountReview,
} from "@/lib/services/account-review-service";
import { updateAccountReviewSchema } from "@/lib/validators/account-review";

type RouteContext = {
  params: Promise<{
    reviewId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getCurrentSession();
  if (!session) {
    return fail("Authentication required", 401, "UNAUTHENTICATED");
  }

  try {
    const { reviewId } = await context.params;
    const payload = updateAccountReviewSchema.parse(await request.json());
    const updated = await updateAccountReview(session.sub, reviewId, payload);
    return ok(updated);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to update review", 400, "ACCOUNT_REVIEW_UPDATE_FAILED");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getCurrentSession();
  if (!session) {
    return fail("Authentication required", 401, "UNAUTHENTICATED");
  }

  try {
    const { reviewId } = await context.params;
    const deleted = await deleteAccountReview(session.sub, reviewId);
    return ok(deleted);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to delete review", 400, "ACCOUNT_REVIEW_DELETE_FAILED");
  }
}
