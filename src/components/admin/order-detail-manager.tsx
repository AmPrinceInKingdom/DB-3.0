"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ShipmentStatus } from "@prisma/client";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCurrency } from "@/lib/utils";
import type { AdminOrderDetail } from "@/types/order";

type Props = {
  orderId: string;
};

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

const shipmentStatuses: ShipmentStatus[] = [
  "PENDING",
  "PACKED",
  "IN_TRANSIT",
  "DELIVERED",
  "FAILED",
  "RETURNED",
];

function toLabel(value: string) {
  return value.replaceAll("_", " ");
}

function renderAddressBlock(
  label: string,
  address: AdminOrderDetail["billingAddress"] | AdminOrderDetail["shippingAddress"],
) {
  if (!address) {
    return (
      <article className="rounded-xl border border-border bg-background p-3 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">{label}</p>
        <p className="mt-2">No address saved</p>
      </article>
    );
  }

  return (
    <article className="rounded-xl border border-border bg-background p-3 text-sm">
      <p className="font-semibold">{label}</p>
      <p className="mt-2">
        {address.firstName} {address.lastName}
      </p>
      {address.company ? <p className="text-muted-foreground">{address.company}</p> : null}
      {address.phone ? <p className="text-muted-foreground">{address.phone}</p> : null}
      <p className="mt-1 text-muted-foreground">
        {address.line1}
        {address.line2 ? `, ${address.line2}` : ""}
      </p>
      <p className="text-muted-foreground">
        {address.city}
        {address.state ? `, ${address.state}` : ""}
        {address.postalCode ? ` ${address.postalCode}` : ""}
      </p>
      <p className="text-muted-foreground">{address.countryCode}</p>
    </article>
  );
}

export function AdminOrderDetailManager({ orderId }: Props) {
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [trackingNumber, setTrackingNumber] = useState("");
  const [courierName, setCourierName] = useState("");
  const [shipmentStatus, setShipmentStatus] = useState<ShipmentStatus>("PENDING");
  const [note, setNote] = useState("");

  const loadOrder = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiEnvelope<AdminOrderDetail>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to fetch order details");
      }
      setOrder(payload.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to fetch order details");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (!order) return;
    setTrackingNumber(order.trackingNumber ?? order.shipment?.trackingNumber ?? "");
    setCourierName(order.shipment?.courierName ?? "");
    setShipmentStatus(order.shipment?.status ?? "PENDING");
    setNote("");
  }, [order]);

  const canSubmit = useMemo(() => {
    if (!order) return false;

    const currentTracking = order.trackingNumber ?? order.shipment?.trackingNumber ?? "";
    const currentCourier = order.shipment?.courierName ?? "";
    const currentShipmentStatus = order.shipment?.status ?? "PENDING";

    return (
      trackingNumber.trim() !== currentTracking ||
      courierName.trim() !== currentCourier ||
      shipmentStatus !== currentShipmentStatus ||
      note.trim().length > 0
    );
  }, [courierName, note, order, shipmentStatus, trackingNumber]);

  const submitTrackingUpdate = async () => {
    if (!order || !canSubmit) {
      setError("No tracking changes to save.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const currentTracking = order.trackingNumber ?? order.shipment?.trackingNumber ?? "";
      const currentCourier = order.shipment?.courierName ?? "";
      const currentShipmentStatus = order.shipment?.status ?? "PENDING";

      const payload: Record<string, string> = {};
      if (trackingNumber.trim() !== currentTracking) payload.trackingNumber = trackingNumber.trim();
      if (courierName.trim() !== currentCourier) payload.courierName = courierName.trim();
      if (shipmentStatus !== currentShipmentStatus) payload.shipmentStatus = shipmentStatus;
      if (note.trim().length > 0) payload.note = note.trim();

      if (shipmentStatus === "IN_TRANSIT" || shipmentStatus === "DELIVERED") {
        const effectiveTracking = trackingNumber.trim() || currentTracking;
        if (!effectiveTracking) {
          throw new Error("Tracking number is required for in-transit or delivered updates.");
        }
        if (!payload.trackingNumber) payload.trackingNumber = effectiveTracking;
      }

      const response = await fetch(`/api/admin/orders/${order.id}/tracking`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Unable to update tracking details");
      }

      await loadOrder();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to update tracking");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Loading admin order detail...</p>
      </section>
    );
  }

  if (!order || error) {
    return (
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h1 className="text-2xl font-bold">Order not available</h1>
        <p className="text-sm text-red-600">{error ?? "Unable to load this order."}</p>
        <Button variant="outline" asChild>
          <Link href="/admin/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Link>
        </Button>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Admin Order Detail</p>
          <h1 className="text-2xl font-bold">#{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Placed on {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadOrder()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Orders
            </Link>
          </Button>
        </div>
      </header>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap gap-2">
          <StatusPill value={order.status} />
          <StatusPill value={order.paymentStatus} />
          {order.shipment ? <StatusPill value={order.shipment.status} /> : null}
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <p className="text-muted-foreground">
            Payment Method:{" "}
            <span className="font-semibold text-foreground">
              {toLabel(order.paymentMethod)}
            </span>
          </p>
          <p className="text-muted-foreground">
            Tracking: <span className="font-semibold text-foreground">{order.trackingNumber ?? "-"}</span>
          </p>
          <p className="text-muted-foreground">
            Customer: <span className="font-semibold text-foreground">{order.customerEmail}</span>
          </p>
          <p className="text-muted-foreground">
            Total:{" "}
            <span className="font-semibold text-foreground">
              {formatCurrency(order.grandTotal, order.currencyCode)}
            </span>
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-lg font-bold">Items</h2>
        <div className="mt-3 space-y-2">
          {order.items.map((item) => (
            <div key={item.id} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    Qty: {item.quantity}
                    {item.variantName ? ` - ${item.variantName}` : ""}
                    {item.sku ? ` - SKU: ${item.sku}` : ""}
                  </p>
                </div>
                <span className="font-semibold">{formatCurrency(item.lineTotal, order.currencyCode)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-lg font-bold">Customer & Address</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {renderAddressBlock("Billing Address", order.billingAddress)}
          {renderAddressBlock("Shipping Address", order.shippingAddress)}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-lg font-bold">Payment & Proofs</h2>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <p className="text-muted-foreground">
            Payment Status: <span className="font-semibold text-foreground">{toLabel(order.paymentStatus)}</span>
          </p>
          <p className="text-muted-foreground">
            Transaction Ref:{" "}
            <span className="font-semibold text-foreground">{order.payment?.transactionReference ?? "-"}</span>
          </p>
          <p className="text-muted-foreground">
            Gateway: <span className="font-semibold text-foreground">{order.payment?.gateway ?? "-"}</span>
          </p>
          <p className="text-muted-foreground">
            Paid At:{" "}
            <span className="font-semibold text-foreground">
              {order.payment?.paidAt ? new Date(order.payment.paidAt).toLocaleString() : "-"}
            </span>
          </p>
        </div>

        <div className="mt-4 space-y-2">
          {order.paymentProofs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payment proofs uploaded.</p>
          ) : (
            order.paymentProofs.map((proof) => (
              <article key={proof.id} className="rounded-lg border border-border bg-background p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{proof.fileName ?? "Proof file"}</p>
                  <StatusPill value={proof.verificationStatus} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Uploaded: {new Date(proof.createdAt).toLocaleString()}
                </p>
                <a
                  href={proof.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex text-xs font-semibold text-primary hover:underline"
                >
                  View Proof File
                </a>
                {proof.rejectionReason ? (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-300">
                    Rejection reason: {proof.rejectionReason}
                  </p>
                ) : null}
              </article>
            ))
          )}
        </div>

        <Button className="mt-3" variant="outline" size="sm" asChild>
          <Link href="/admin/payments">Open Payments Verification</Link>
        </Button>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-lg font-bold">Tracking & Shipment Update</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Tracking number"
            value={trackingNumber}
            onChange={(event) => setTrackingNumber(event.target.value)}
          />
          <Input
            placeholder="Courier name"
            value={courierName}
            onChange={(event) => setCourierName(event.target.value)}
          />
          <Select
            value={shipmentStatus}
            onChange={(event) => setShipmentStatus(event.target.value as ShipmentStatus)}
          >
            {shipmentStatuses.map((status) => (
              <option key={status} value={status}>
                {toLabel(status)}
              </option>
            ))}
          </Select>
          <div className="sm:col-span-2">
            <textarea
              className="focus-ring min-h-[88px] w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground"
              placeholder="Internal note (optional)"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void submitTrackingUpdate()} disabled={!canSubmit || submitting}>
            {submitting ? "Saving..." : "Save Tracking Update"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setTrackingNumber(order.trackingNumber ?? order.shipment?.trackingNumber ?? "");
              setCourierName(order.shipment?.courierName ?? "");
              setShipmentStatus(order.shipment?.status ?? "PENDING");
              setNote("");
            }}
          >
            Reset
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-lg font-bold">Order Timeline</h2>
        <div className="mt-3 space-y-2">
          {order.statusHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No status updates yet.</p>
          ) : (
            order.statusHistory.map((entry) => (
              <article key={entry.id} className="rounded-lg border border-border bg-background px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{toLabel(entry.newStatus)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {entry.changer?.email ? `Updated by ${entry.changer.email}` : "System update"}
                </p>
                {entry.note ? <p className="mt-1 text-xs text-muted-foreground">{entry.note}</p> : null}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
