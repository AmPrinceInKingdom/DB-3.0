import { SellerStoreProfileManager } from "@/components/seller/seller-store-profile-manager";

export default function SellerStoreProfilePage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6">
        <h1 className="text-2xl font-bold">Store Profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Update your storefront identity, support contacts, and branding assets.
        </p>
      </section>

      <SellerStoreProfileManager />
    </div>
  );
}
