import { PaymentGatewayManager } from "@/components/admin/payment-gateway-manager";

export default function AdminPaymentGatewayPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Payment Gateway Panel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure card provider mode, bank transfer instructions, and Stripe webhook readiness.
        </p>
      </header>
      <PaymentGatewayManager />
    </div>
  );
}

