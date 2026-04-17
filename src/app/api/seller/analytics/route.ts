import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireSellerSession } from "@/lib/auth/seller-guard";
import { getSellerAnalyticsDashboard } from "@/lib/services/seller-analytics-service";

function parseRangeDays(value: string | null) {
  if (!value) return 30;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 30;
}

export async function GET(request: Request) {
  const auth = await requireSellerSession({ requireActiveSellerProfile: true });
  if (!auth.allowed) return auth.response;

  try {
    const url = new URL(request.url);
    const days = parseRangeDays(url.searchParams.get("days"));
    const data = await getSellerAnalyticsDashboard(auth.session.sub, days);
    return ok(data);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to fetch seller analytics", 500, "SELLER_ANALYTICS_FETCH_FAILED");
  }
}
