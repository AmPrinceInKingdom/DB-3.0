import { CouponsManager } from "@/components/admin/coupons-manager";

export default function AdminCouponsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Coupons Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create, activate, and control promotional coupon campaigns.
        </p>
      </header>
      <CouponsManager />
    </div>
  );
}
