import { fail, ok } from "@/lib/api-response";
import { getCurrentSession } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import {
  createAccountReview,
  getAccountReviewsPayload,
} from "@/lib/services/account-review-service";
import { createAccountReviewSchema } from "@/lib/validators/account-review";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return fail("Authentication required", 401, "UNAUTHENTICATED");
  }

  try {
    const payload = await getAccountReviewsPayload(session.sub);
    return ok(payload);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to fetch reviews", 500, "ACCOUNT_REVIEWS_FETCH_FAILED");
  }
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return fail("Authentication required", 401, "UNAUTHENTICATED");
  }

  try {
    const payload = createAccountReviewSchema.parse(await request.json());
    const created = await createAccountReview(session.sub, payload);
    return ok(created, 201);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to create review", 400, "ACCOUNT_REVIEW_CREATE_FAILED");
  }
}
