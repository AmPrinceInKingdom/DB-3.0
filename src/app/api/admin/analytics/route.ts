import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { getAdminAnalyticsDashboard } from "@/lib/services/admin-analytics-service";

function parseRangeDays(value: string | null) {
  if (!value) return 30;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 30;
}

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const url = new URL(request.url);
    const days = parseRangeDays(url.searchParams.get("days"));
    const analytics = await getAdminAnalyticsDashboard(days);
    return ok(analytics);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[admin.analytics] fetch failed", error);
    }
    return fail("Unable to fetch analytics", 500, "ADMIN_ANALYTICS_FETCH_FAILED");
  }
}
