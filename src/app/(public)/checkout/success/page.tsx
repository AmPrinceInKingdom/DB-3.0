"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type OrderSummary = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: "CARD" | "BANK_TRANSFER" | "CASH_ON_DELIVERY";
  currencyCode: string;
  subtotal: number;
  discountTotal: number;
  shippingFee: number;
  taxTotal: number;
  grandTotal: number;
  coupon: {
    code: string;
    title: string;
  } | null;
  customerEmail: string;
  customerPhone: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    productName: string;
    variantName: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  paymentProofs: Array<{
    id: string;
    fileName: string | null;
    verificationStatus: string;
    createdAt: string;
    rejectionReason: string | null;
  }>;
};

type CheckoutOptions = {
  bankTransfer: {
    accountName: string;
    bankName: string;
    accountNumber: string;
    branch: string;
    swiftCode: string;
    note: string;
  };
};

type CardPaymentRetryResponse = {
  reference: string;
  checkoutUrl: string;
  expiresAt: string;
};

const isExternalUrl = (url: string) => /^https?:\/\//i.test(url);

function CheckoutSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const cardFlowState = searchParams.get("card");

  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [bankInfo, setBankInfo] = useState<CheckoutOptions["bankTransfer"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [retryingCardPayment, setRetryingCardPayment] = useState(false);
  const [cardRetryError, setCardRetryError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!orderId) {
        setError("Order reference is missing.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [orderResponse, optionsResponse] = await Promise.all([
          fetch(`/api/orders/${orderId}`, { cache: "no-store" }),
          fetch("/api/checkout/options", { cache: "no-store" }),
        ]);

        const orderPayload = (await orderResponse.json()) as ApiEnvelope<OrderSummary>;
        const optionsPayload = (await optionsResponse.json()) as ApiEnvelope<CheckoutOptions>;

        if (!active) return;

        if (!orderResponse.ok || !orderPayload.success || !orderPayload.data) {
          throw new Error(orderPayload.error ?? "Unable to load order details");
        }

        setOrder(orderPayload.data);
        setBankInfo(optionsPayload.data?.bankTransfer ?? null);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load order");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [orderId]);

  async function handleProofUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);
    setUploadSuccess(null);

    if (!order?.id) return;

    const form = event.currentTarget;
    const input = form.elements.namedItem("proofFile") as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!file) {
      setUploadError("Please choose a file before uploading.");
      return;
    }

    const data = new FormData();
    data.append("proofFile", file);

    setUploading(true);
    try {
      const response = await fetch(`/api/orders/${order.id}/payment-proof`, {
        method: "POST",
        body: data,
      });

      const payload = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to upload proof");
      }

      setUploadSuccess("Payment proof uploaded successfully. Verification is in progress.");
      form.reset();
    } catch (uploadingError) {
      setUploadError(uploadingError instanceof Error ? uploadingError.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function retryCardPayment() {
    if (!order) return;

    setCardRetryError(null);
    setRetryingCardPayment(true);
    try {
      const response = await fetch("/api/payments/card/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          customerEmail: order.customerEmail,
        }),
      });

      const payload = (await response.json()) as ApiEnvelope<CardPaymentRetryResponse>;
      if (!response.ok || !payload.success || !payload.data?.checkoutUrl) {
        throw new Error(payload.error ?? "Unable to restart card payment");
      }

      if (isExternalUrl(payload.data.checkoutUrl)) {
        window.location.assign(payload.data.checkoutUrl);
      } else {
        router.push(payload.data.checkoutUrl);
      }
    } catch (retryError) {
      setCardRetryError(retryError instanceof Error ? retryError.message : "Unable to restart card payment");
    } finally {
      setRetryingCardPayment(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">Loading order details...</p>
      </section>
    );
  }

  if (error || !order) {
    return (
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <h1 className="text-2xl font-bold">Order not available</h1>
        <p className="text-sm text-red-600">{error ?? "Unable to find your order details."}</p>
        <Button asChild>
          <Link href="/shop">Back to Shop</Link>
        </Button>
      </section>
    );
  }

  const isBankTransfer = order.paymentMethod === "BANK_TRANSFER";
  const isCardPayment = order.paymentMethod === "CARD";
  const isCardPaymentPaid = isCardPayment && order.paymentStatus === "PAID";
  const cardNeedsAction = isCardPayment && !isCardPaymentPaid;

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div
          className={`inline-flex h-12 w-12 items-center justify-center rounded-full ${
            cardNeedsAction
              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              : "bg-emerald-500/15 text-emerald-600"
          }`}
        >
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">
            {cardNeedsAction ? "Order placed - complete card payment" : "Order placed successfully"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {cardNeedsAction
              ? "Your order is created, but card payment is still pending. Complete payment to confirm fulfillment."
              : "Thank you for shopping with Deal Bazaar. Your order has been created."}
          </p>
        </div>
        <div className="grid gap-3 rounded-xl border border-border bg-background p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Order Number</p>
            <p className="mt-1 font-semibold">{order.orderNumber}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Payment Status</p>
            <p className="mt-1 font-semibold">{order.paymentStatus}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Payment Method</p>
            <p className="mt-1 font-semibold">{order.paymentMethod}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Grand Total</p>
            <p className="mt-1 font-semibold">
              {formatCurrency(order.grandTotal, order.currencyCode)}
            </p>
          </div>
        </div>
      </section>

      {cardNeedsAction ? (
        <section className="space-y-3 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-5">
          <h2 className="text-xl font-bold text-amber-800 dark:text-amber-200">Card payment required</h2>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Payment status is {order.paymentStatus.replaceAll("_", " ")}. Continue to secure card checkout to complete this order.
          </p>
          {cardFlowState === "cancelled" ? (
            <p className="text-sm text-red-700 dark:text-red-300">
              Card checkout was cancelled. You can restart payment below.
            </p>
          ) : null}
          {cardFlowState === "returned" ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Card gateway returned to Deal Bazaar. If payment is still pending, please retry once.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void retryCardPayment()} disabled={retryingCardPayment}>
              {retryingCardPayment ? "Opening payment..." : "Pay by Card Now"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/shop">Continue Shopping</Link>
            </Button>
          </div>
          {cardRetryError ? <p className="text-sm text-red-600">{cardRetryError}</p> : null}
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-xl font-bold">Order Items</h2>
        <div className="mt-3 space-y-2">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <div>
                <p className="font-semibold">{item.productName}</p>
                <p className="text-xs text-muted-foreground">
                  Qty: {item.quantity}
                  {item.variantName ? ` - ${item.variantName}` : ""}
                </p>
              </div>
              <p className="font-semibold">{formatCurrency(item.lineTotal, order.currencyCode)}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
          {order.coupon ? (
            <p className="text-muted-foreground">
              Coupon: <span className="font-semibold text-foreground">{order.coupon.code}</span> ({order.coupon.title})
            </p>
          ) : null}
          {order.discountTotal > 0 ? (
            <p className="text-emerald-600">
              Discount: -{formatCurrency(order.discountTotal, order.currencyCode)}
            </p>
          ) : null}
        </div>
      </section>

      {isBankTransfer ? (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-xl font-bold">Bank Transfer Payment</h2>
          <p className="text-sm text-muted-foreground">
            Complete your transfer and upload the payment proof for admin verification.
          </p>

          <div className="grid gap-3 rounded-xl border border-border bg-background p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Account Name</p>
              <p className="font-semibold">{bankInfo?.accountName ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bank Name</p>
              <p className="font-semibold">{bankInfo?.bankName ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Account Number</p>
              <p className="font-semibold">{bankInfo?.accountNumber ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Branch</p>
              <p className="font-semibold">{bankInfo?.branch ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">SWIFT</p>
              <p className="font-semibold">{bankInfo?.swiftCode ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reference</p>
              <p className="font-semibold">{order.orderNumber}</p>
            </div>
          </div>

          <form onSubmit={handleProofUpload} className="space-y-3 rounded-xl border border-border bg-background p-4">
            <label className="text-sm font-semibold">Upload Payment Proof (JPG, PNG, WEBP, PDF)</label>
            <input
              type="file"
              name="proofFile"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              className="focus-ring block w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            />
            <Button type="submit" disabled={uploading}>
              <UploadCloud className="mr-2 h-4 w-4" />
              {uploading ? "Uploading..." : "Upload Proof"}
            </Button>
            {uploadError ? <p className="text-sm text-red-600">{uploadError}</p> : null}
            {uploadSuccess ? <p className="text-sm text-emerald-600">{uploadSuccess}</p> : null}
          </form>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/shop">Continue Shopping</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/account">Go to My Account</Link>
        </Button>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <section className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Loading order details...</p>
        </section>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  );
}


