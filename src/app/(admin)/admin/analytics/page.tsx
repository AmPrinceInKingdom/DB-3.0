import { AnalyticsManager } from "@/components/admin/analytics-manager";

export default function AdminAnalyticsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Analytics & Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track revenue, orders, product performance, and stock risk in one dashboard.
        </p>
      </header>
      <AnalyticsManager />
    </div>
  );
}
