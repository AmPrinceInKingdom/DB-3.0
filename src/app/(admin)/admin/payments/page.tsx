import { PaymentsManager } from "@/components/admin/payments-manager";

export default function AdminPaymentsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Payments Verification</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review bank transfer proofs and monitor card gateway webhook activity.
        </p>
      </header>
      <PaymentsManager />
    </div>
  );
}
