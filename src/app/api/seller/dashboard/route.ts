import { fail, ok } from "@/lib/api-response";
import { requireSellerSession } from "@/lib/auth/seller-guard";
import { AppError } from "@/lib/errors";
import { getSellerDashboardData } from "@/lib/services/seller-dashboard-service";

export async function GET() {
  const auth = await requireSellerSession({ requireActiveSellerProfile: true });
  if (!auth.allowed) return auth.response;

  try {
    const data = await getSellerDashboardData(auth.session.sub);
    return ok(data);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to fetch seller dashboard", 500, "SELLER_DASHBOARD_FETCH_FAILED");
  }
}
