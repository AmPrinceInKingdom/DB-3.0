import { ReviewStatus } from "@prisma/client";
import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { listAdminReviews } from "@/lib/services/admin-commerce-service";

const allowedStatuses = new Set(Object.values(ReviewStatus));

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const url = new URL(request.url);
    const statusQuery = url.searchParams.get("status");
    const searchQuery = url.searchParams.get("q");
    const status =
      statusQuery && allowedStatuses.has(statusQuery as ReviewStatus)
        ? (statusQuery as ReviewStatus)
        : undefined;

    const reviews = await listAdminReviews({
      status,
      query: searchQuery ?? undefined,
    });

    return ok(reviews);
  } catch {
    return fail("Unable to fetch reviews", 500, "ADMIN_REVIEW_FETCH_FAILED");
  }
}
