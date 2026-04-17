import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth/session";
import { getAccountDashboardStats } from "@/lib/services/account-dashboard-service";

export default async function AccountDashboardPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?next=/account");
  }

  const stats = await getAccountDashboardStats(session.sub);
  const cards: Array<[string, string, string]> = [
    ["Active Orders", String(stats.activeOrders), "Orders currently in progress"],
    ["Wishlist Items", String(stats.wishlistItems), "Saved products for later"],
    ["Saved for Later", String(stats.savedForLaterItems), "Cart items parked for later checkout"],
    ["Saved Addresses", String(stats.savedAddresses), "Checkout-ready addresses"],
    ["Unread Notifications", String(stats.unreadNotifications), "New updates to review"],
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Account Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track live account activity, manage profile settings, and review saved products.
        </p>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label, value, hint]) => (
          <Card key={label}>
            <CardHeader className="pb-2 text-sm text-muted-foreground">{label}</CardHeader>
            <CardContent className="space-y-1">
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
