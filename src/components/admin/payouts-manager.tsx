"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PayoutStatus } from "@prisma/client";
import { Plus, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCurrency } from "@/lib/utils";
import type { AdminPayoutWorkspace } from "@/types/seller-payout";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type CreatePayoutForm = {
  sellerId: string;
  amount: string;
  currencyCode: string;
  periodStart: string;
  periodEnd: string;
  reference: string;
  notes: string;
};

const defaultCreateForm: CreatePayoutForm = {
  sellerId: "",
  amount: "",
  currencyCode: "LKR",
  periodStart: "",
  periodEnd: "",
  reference: "",
  notes: "",
};

export function AdminPayoutsManager() {
  const [workspace, setWorkspace] = useState<AdminPayoutWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PayoutStatus | "">("");
  const [sellerFilter, setSellerFilter] = useState("");
  const [createForm, setCreateForm] = useState<CreatePayoutForm>(defaultCreateForm);
  const [statusDrafts, setStatusDrafts] = useState<Record<string, PayoutStatus>>({});
  const [referenceDrafts, setReferenceDrafts] = useState<Record<string, string>>({});
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({});

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (sellerFilter) params.set("sellerId", sellerFilter);
    return params.toString();
  }, [query, sellerFilter, statusFilter]);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/payouts${queryString ? `?${queryString}` : ""}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiEnvelope<AdminPayoutWorkspace>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to load payouts");
      }
      setWorkspace(payload.data);
      setStatusDrafts((current) => {
        const next = { ...current };
        for (const payout of payload.data!.payouts) {
          next[payout.id] = next[payout.id] ?? payout.status;
        }
        return next;
      });
      setReferenceDrafts((current) => {
        const next = { ...current };
        for (const payout of payload.data!.payouts) {
          next[payout.id] = next[payout.id] ?? (payout.reference ?? "");
        }
        return next;
      });
      setNotesDrafts((current) => {
        const next = { ...current };
        for (const payout of payload.data!.payouts) {
          next[payout.id] = next[payout.id] ?? (payout.notes ?? "");
        }
        return next;
      });
      setCreateForm((current) => ({
        ...current,
        sellerId:
          current.sellerId || payload.data!.sellerOptions[0]?.userId || "",
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load payouts");
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const createPayout = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        sellerId: createForm.sellerId,
        amount: Number(createForm.amount),
        currencyCode: createForm.currencyCode,
        periodStart: createForm.periodStart
          ? new Date(createForm.periodStart).toISOString()
          : "",
        periodEnd: createForm.periodEnd ? new Date(createForm.periodEnd).toISOString() : "",
        reference: createForm.reference,
        notes: createForm.notes,
      };

      const response = await fetch("/api/admin/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Unable to create payout");
      }

      setCreateForm((current) => ({
        ...defaultCreateForm,
        sellerId: current.sellerId,
      }));
      await loadWorkspace();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create payout");
    } finally {
      setSubmitting(false);
    }
  };

  const updatePayout = async (payoutId: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        status: statusDrafts[payoutId],
        reference: referenceDrafts[payoutId] ?? "",
        notes: notesDrafts[payoutId] ?? "",
      };

      const response = await fetch(`/api/admin/payouts/${payoutId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Unable to update payout");
      }

      await loadWorkspace();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update payout");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="grid gap-3 rounded-2xl border border-border bg-card p-4 lg:grid-cols-4">
        <Input
          placeholder="Search seller, reference, notes"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as PayoutStatus | "")}
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PROCESSING">Processing</option>
          <option value="PAID">Paid</option>
          <option value="FAILED">Failed</option>
        </Select>
        <Select value={sellerFilter} onChange={(event) => setSellerFilter(event.target.value)}>
          <option value="">All Sellers</option>
          {(workspace?.sellerOptions ?? []).map((seller) => (
            <option key={seller.userId} value={seller.userId}>
              {seller.storeName}
            </option>
          ))}
        </Select>
        <Button variant="outline" onClick={() => void loadWorkspace()}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold">Create Payout</h2>
        <form onSubmit={createPayout} className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Select
            required
            value={createForm.sellerId}
            onChange={(event) =>
              setCreateForm((current) => ({ ...current, sellerId: event.target.value }))
            }
          >
            <option value="">Select Seller</option>
            {(workspace?.sellerOptions ?? []).map((seller) => (
              <option key={seller.userId} value={seller.userId}>
                {seller.storeName} ({seller.email})
              </option>
            ))}
          </Select>
          <Input
            required
            type="number"
            step="0.01"
            min={0.01}
            placeholder="Amount"
            value={createForm.amount}
            onChange={(event) =>
              setCreateForm((current) => ({ ...current, amount: event.target.value }))
            }
          />
          <Input
            required
            placeholder="Currency (e.g. LKR)"
            value={createForm.currencyCode}
            onChange={(event) =>
              setCreateForm((current) => ({ ...current, currencyCode: event.target.value.toUpperCase() }))
            }
          />
          <Input
            placeholder="Reference"
            value={createForm.reference}
            onChange={(event) =>
              setCreateForm((current) => ({ ...current, reference: event.target.value }))
            }
          />
          <Input
            type="date"
            value={createForm.periodStart}
            onChange={(event) =>
              setCreateForm((current) => ({ ...current, periodStart: event.target.value }))
            }
          />
          <Input
            type="date"
            value={createForm.periodEnd}
            onChange={(event) =>
              setCreateForm((current) => ({ ...current, periodEnd: event.target.value }))
            }
          />
          <Input
            className="lg:col-span-2"
            placeholder="Notes"
            value={createForm.notes}
            onChange={(event) =>
              setCreateForm((current) => ({ ...current, notes: event.target.value }))
            }
          />
          <Button type="submit" className="lg:col-span-4" disabled={submitting}>
            <Plus className="mr-2 h-4 w-4" />
            Create Payout
          </Button>
        </form>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Loading payouts...</p>
        </section>
      ) : !workspace || workspace.payouts.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">No payouts found.</p>
        </section>
      ) : (
        <section className="space-y-3">
          {workspace.payouts.map((payout) => (
            <article key={payout.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{payout.seller.storeName}</p>
                  <p className="text-xs text-muted-foreground">
                    {payout.seller.email} | {new Date(payout.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill value={payout.status} />
                  <span className="text-sm font-semibold">
                    {formatCurrency(payout.amount, payout.currencyCode)}
                  </span>
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <p>Reference: {payout.reference ?? "-"}</p>
                <p>Paid At: {payout.paidAt ? new Date(payout.paidAt).toLocaleString() : "-"}</p>
                <p>
                  Period:{" "}
                  {payout.periodStart ? new Date(payout.periodStart).toLocaleDateString() : "-"} -{" "}
                  {payout.periodEnd ? new Date(payout.periodEnd).toLocaleDateString() : "-"}
                </p>
                <p>
                  Default Account:{" "}
                  {payout.seller.defaultPayoutAccount
                    ? `${payout.seller.defaultPayoutAccount.bankName} (${payout.seller.defaultPayoutAccount.accountNumberMasked})`
                    : "No default payout account"}
                </p>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <Select
                  value={statusDrafts[payout.id] ?? payout.status}
                  onChange={(event) =>
                    setStatusDrafts((current) => ({
                      ...current,
                      [payout.id]: event.target.value as PayoutStatus,
                    }))
                  }
                >
                  <option value="PENDING">Pending</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="PAID">Paid</option>
                  <option value="FAILED">Failed</option>
                </Select>
                <Input
                  placeholder="Reference"
                  value={referenceDrafts[payout.id] ?? payout.reference ?? ""}
                  onChange={(event) =>
                    setReferenceDrafts((current) => ({
                      ...current,
                      [payout.id]: event.target.value,
                    }))
                  }
                />
                <Input
                  placeholder="Notes"
                  value={notesDrafts[payout.id] ?? payout.notes ?? ""}
                  onChange={(event) =>
                    setNotesDrafts((current) => ({
                      ...current,
                      [payout.id]: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="mt-2">
                <Button size="sm" onClick={() => void updatePayout(payout.id)} disabled={submitting}>
                  Save Payout Update
                </Button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
