import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { getAdminInventoryDashboard } from "@/lib/services/admin-inventory-service";

const allowedStockFilters = new Set(["all", "in_stock", "low_stock", "out_of_stock"]);

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const url = new URL(request.url);
    const searchQuery = url.searchParams.get("q");
    const stockQuery = url.searchParams.get("stock");
    const stockFilter =
      stockQuery && allowedStockFilters.has(stockQuery)
        ? (stockQuery as "all" | "in_stock" | "low_stock" | "out_of_stock")
        : "all";

    const payload = await getAdminInventoryDashboard({
      query: searchQuery ?? undefined,
      stockFilter,
    });

    return ok(payload);
  } catch {
    return fail("Unable to fetch inventory dashboard", 500, "ADMIN_INVENTORY_FETCH_FAILED");
  }
}
