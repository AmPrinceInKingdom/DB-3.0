import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";

export default async function Page() {
  const session = await getCurrentSession();
  const canOpenDashboard =
    session?.role === "SELLER" || session?.role === "ADMIN" || session?.role === "SUPER_ADMIN";

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6">
        <h1 className="text-2xl font-bold">Seller Center</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Grow your business with Deal Bazaar seller tools, analytics, and secure payout architecture.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">New Seller</h2>
          <p className="text-sm text-muted-foreground">
            Apply for a seller account, submit store details, and wait for admin approval.
          </p>
          <Button asChild>
            <Link href="/seller/apply">Apply As Seller</Link>
          </Button>
        </article>

        <article className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Existing Seller</h2>
          <p className="text-sm text-muted-foreground">
            Access dashboard, product tools, and order workflow after approval.
          </p>
          <Button variant="outline" asChild>
            <Link href={canOpenDashboard ? "/seller/dashboard" : "/login?next=/seller/dashboard"}>
              Open Seller Workspace
            </Link>
          </Button>
        </article>
      </section>
    </div>
  );
}

