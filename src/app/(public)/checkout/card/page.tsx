"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CreditCard, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type CardPaymentSessionResponse = {
  reference: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  currencyCode: string;
  paymentStatus: string;
  orderStatus: string;
  customerEmail: string;
  expiresAt: string;
  checkoutUrl: string;
};

type CardPaymentCompleteResponse = {
  orderId: string;
  orderNumber: string;
  paymentStatus: string;
  orderStatus: string;
  redirectUrl: string;
};

function normalizeCardDigits(value: string) {
  return value.replace(/\D+/g, "");
}

function detectCardBrand(cardDigits: string) {
  if (/^4\d+/.test(cardDigits)) return "VISA";
  if (/^5[1-5]\d+/.test(cardDigits) || /^2(2[2-9]|[3-6]|7[01]|720)\d+/.test(cardDigits)) return "MASTERCARD";
  if (/^3[47]\d+/.test(cardDigits)) return "AMEX";
  if (/^6(?:011|5)\d+/.test(cardDigits)) return "DISCOVER";
  return "CARD";
}

function isValidLuhn(cardDigits: string) {
  let sum = 0;
  let doubleNext = false;
  for (let i = cardDigits.length - 1; i >= 0; i -= 1) {
    let digit = Number(cardDigits[i]);
    if (doubleNext) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleNext = !doubleNext;
  }
  return sum % 10 === 0;
}

function CheckoutCardPaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [session, setSession] = useState<CardPaymentSessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [cvv, setCvv] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      if (!token) {
        setError("Card payment token is missing.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/payments/card/session?token=${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as ApiEnvelope<CardPaymentSessionResponse>;
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error ?? "Unable to load card payment session");
        }
        if (!active) return;
        setSession(payload.data);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load card payment session");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSession();
    return () => {
      active = false;
    };
  }, [token]);

  async function submitPayment() {
    setFormError(null);
    if (!session) return;

    const digits = normalizeCardDigits(cardNumber);
    if (cardholderName.trim().length < 3) {
      setFormError("Cardholder name is required.");
      return;
    }
    if (digits.length < 13 || digits.length > 19 || !isValidLuhn(digits)) {
      setFormError("Please enter a valid card number.");
      return;
    }

    const month = Number(expiryMonth);
    const year = Number(expiryYear);
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      setFormError("Expiry month is invalid.");
      return;
    }
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      setFormError("Expiry year is invalid.");
      return;
    }
    const now = new Date();
    const expiry = new Date(year, month, 0, 23, 59, 59, 999);
    if (expiry < now) {
      setFormError("Card is expired.");
      return;
    }

    const normalizedCvv = cvv.trim();
    if (!/^\d{3,4}$/.test(normalizedCvv)) {
      setFormError("CVV must be 3 or 4 digits.");
      return;
    }

    const cardBrand = detectCardBrand(digits);
    const cardLast4 = digits.slice(-4);

    setSubmitting(true);
    try {
      const response = await fetch("/api/payments/card/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          approved: true,
          cardBrand,
          cardLast4,
        }),
      });

      const payload = (await response.json()) as ApiEnvelope<CardPaymentCompleteResponse>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to process card payment");
      }

      router.push(payload.data.redirectUrl);
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : "Card payment failed");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">Loading secure card payment...</p>
      </section>
    );
  }

  if (error || !session) {
    return (
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <h1 className="text-2xl font-bold">Card Payment Unavailable</h1>
        <p className="text-sm text-red-600">{error ?? "Unable to continue card payment."}</p>
        <Button asChild>
          <Link href="/checkout">Back to Checkout</Link>
        </Button>
      </section>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
        <header>
          <p className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <LockKeyhole className="h-3.5 w-3.5" />
            Secure Card Checkout
          </p>
          <h1 className="mt-3 text-2xl font-bold">Complete your card payment</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Order #{session.orderNumber} is reserved. Payment session expires at{" "}
            {new Date(session.expiresAt).toLocaleString()}.
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-semibold">Cardholder Name</label>
            <Input
              value={cardholderName}
              onChange={(event) => setCardholderName(event.target.value)}
              placeholder="Name on card"
              autoComplete="cc-name"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold">Card Number</label>
            <Input
              value={cardNumber}
              onChange={(event) => setCardNumber(event.target.value)}
              placeholder="1234 5678 9012 3456"
              autoComplete="cc-number"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold">Expiry Month</label>
            <Input
              value={expiryMonth}
              onChange={(event) => setExpiryMonth(event.target.value)}
              placeholder="MM"
              maxLength={2}
              autoComplete="cc-exp-month"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold">Expiry Year</label>
            <Input
              value={expiryYear}
              onChange={(event) => setExpiryYear(event.target.value)}
              placeholder="YYYY"
              maxLength={4}
              autoComplete="cc-exp-year"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-sm font-semibold">CVV</label>
            <Input
              value={cvv}
              onChange={(event) => setCvv(event.target.value)}
              placeholder="123"
              maxLength={4}
              autoComplete="cc-csc"
              inputMode="numeric"
              type="password"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground">
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Security Notice
          </p>
          <p className="mt-1">
            Deal Bazaar does not store full card number or CVV. Only tokenized metadata is saved for order verification.
          </p>
        </div>

        {formError ? (
          <p className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
            <AlertCircle className="h-4 w-4" />
            {formError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void submitPayment()} disabled={submitting}>
            <CreditCard className="mr-2 h-4 w-4" />
            {submitting ? "Processing..." : "Pay Now"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={`/checkout/success?orderId=${encodeURIComponent(session.orderId)}`}>
              Back to Order
            </Link>
          </Button>
        </div>
      </section>

      <aside className="h-fit space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5 lg:sticky lg:top-24">
        <h2 className="text-lg font-bold">Payment Summary</h2>
        <div className="space-y-2 rounded-xl border border-border bg-background p-3 text-sm">
          <p className="text-muted-foreground">
            Order: <span className="font-semibold text-foreground">#{session.orderNumber}</span>
          </p>
          <p className="text-muted-foreground">
            Email: <span className="font-semibold text-foreground">{session.customerEmail}</span>
          </p>
          <p className="text-muted-foreground">
            Status:{" "}
            <span className="font-semibold text-foreground">
              {session.paymentStatus.replaceAll("_", " ")}
            </span>
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Amount</p>
          <p className="mt-1 text-xl font-bold">
            {formatCurrency(session.amount, session.currencyCode)}
          </p>
        </div>
      </aside>
    </div>
  );
}

export default function CheckoutCardPaymentPage() {
  return (
    <Suspense
      fallback={
        <section className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Loading secure card payment...</p>
        </section>
      }
    >
      <CheckoutCardPaymentContent />
    </Suspense>
  );
}
