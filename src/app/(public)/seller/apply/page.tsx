import { SellerApplicationForm } from "@/components/seller/seller-application-form";

export default function Page() {
  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-border bg-card p-6">
        <h1 className="text-2xl font-bold">Become a Seller</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Launch your store on Deal Bazaar and reach local plus international customers with trusted
          checkout and global currency support.
        </p>
      </header>

      <SellerApplicationForm />
    </div>
  );
}

