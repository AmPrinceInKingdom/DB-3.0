"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PayoutStatus } from "@prisma/client";
import { Pencil, Plus, RefreshCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCurrency } from "@/lib/utils";
import { useToastStore } from "@/store/toast-store";
import type {
  SellerPayoutAccountItem,
  SellerPayoutWorkspace,
} from "@/types/seller-payout";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type AccountFormState = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branchName: string;
  swiftCode: string;
  isDefault: boolean;
};

const defaultAccountForm: AccountFormState = {
  bankName: "",
  accountName: "",
  accountNumber: "",
  branchName: "",
  swiftCode: "",
  isDefault: false,
};

function payoutStatusLabel(status: PayoutStatus) {
  return status.replaceAll("_", " ");
}

export function SellerPayoutsManager() {
  const pushToast = useToastStore((state) => state.pushToast);
  const [workspace, setWorkspace] = useState<SellerPayoutWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<PayoutStatus | "">("");
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountFormState>(defaultAccountForm);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/seller/payouts", {
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiEnvelope<SellerPayoutWorkspace>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to load payouts");
      }
      setWorkspace(payload.data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load payouts";
      setError(message);
      pushToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const filteredPayouts = useMemo(() => {
    if (!workspace) return [];
    if (!statusFilter) return workspace.payouts;
    return workspace.payouts.filter((item) => item.status === statusFilter);
  }, [statusFilter, workspace]);

  const resetForm = () => {
    setEditingAccountId(null);
    setForm(defaultAccountForm);
  };

  const startEdit = (account: SellerPayoutAccountItem) => {
    setEditingAccountId(account.id);
    setForm({
      bankName: account.bankName,
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      branchName: account.branchName ?? "",
      swiftCode: account.swiftCode ?? "",
      isDefault: account.isDefault,
    });
  };

  const submitAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        bankName: form.bankName,
        accountName: form.accountName,
        accountNumber: form.accountNumber,
        branchName: form.branchName,
        swiftCode: form.swiftCode,
        isDefault: form.isDefault,
      };

      const response = await fetch(
        editingAccountId
          ? `/api/seller/payout-accounts/${editingAccountId}`
          : "/api/seller/payout-accounts",
        {
          method: editingAccountId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const result = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Unable to save payout account");
      }

      pushToast(editingAccountId ? "Payout account updated" : "Payout account added", "success");
      resetForm();
      await loadWorkspace();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Unable to save payout account";
      setError(message);
      pushToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteAccount = async (accountId: string) => {
    const confirmed = window.confirm("Delete this payout account?");
    if (!confirmed) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/seller/payout-accounts/${accountId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to delete payout account");
      }

      if (editingAccountId === accountId) {
        resetForm();
      }
      pushToast("Payout account deleted", "success");
      await loadWorkspace();
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : "Unable to delete payout account";
      setError(message);
      pushToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Payout Records</p>
          <p className="mt-2 text-2xl font-bold">{workspace?.summary.totalPayouts ?? 0}</p>
        </article>
        <article className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Pending / Processing</p>
          <p className="mt-2 text-2xl font-bold">
            {(workspace?.summary.pendingCount ?? 0) + (workspace?.summary.processingCount ?? 0)}
          </p>
          <p className="text-xs text-muted-foreground">
            {workspace?.summary.pendingCount ?? 0} pending, {workspace?.summary.processingCount ?? 0} processing
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Paid Count</p>
          <p className="mt-2 text-2xl font-bold">{workspace?.summary.paidCount ?? 0}</p>
          <p className="text-xs text-muted-foreground">
            Failed: {workspace?.summary.failedCount ?? 0}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Last Update</p>
          <p className="mt-2 text-sm font-semibold">
            {workspace?.summary.latestPayoutAt
              ? new Date(workspace.summary.latestPayoutAt).toLocaleString()
              : "No payouts yet"}
          </p>
        </article>
      </section>

      {workspace?.summary.totalPaidByCurrency?.length ? (
        <section className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Total Paid By Currency</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {workspace.summary.totalPaidByCurrency.map((item) => (
              <span
                key={item.currencyCode}
                className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold"
              >
                {formatCurrency(item.totalAmount, item.currencyCode)}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">
              {editingAccountId ? "Edit Payout Account" : "Add Payout Account"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Add bank details used by Deal Bazaar to settle your payouts.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void loadWorkspace()}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            {editingAccountId ? (
              <Button type="button" variant="outline" onClick={resetForm} disabled={submitting}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            ) : null}
          </div>
        </div>

        <form onSubmit={submitAccount} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium">Bank Name</label>
            <Input
              required
              value={form.bankName}
              onChange={(event) => setForm((current) => ({ ...current, bankName: event.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Account Name</label>
            <Input
              required
              value={form.accountName}
              onChange={(event) =>
                setForm((current) => ({ ...current, accountName: event.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Account Number</label>
            <Input
              required
              value={form.accountNumber}
              onChange={(event) =>
                setForm((current) => ({ ...current, accountNumber: event.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Branch Name</label>
            <Input
              value={form.branchName}
              onChange={(event) => setForm((current) => ({ ...current, branchName: event.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">SWIFT Code</label>
            <Input
              value={form.swiftCode}
              onChange={(event) => setForm((current) => ({ ...current, swiftCode: event.target.value }))}
            />
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={form.isDefault}
                onChange={(event) =>
                  setForm((current) => ({ ...current, isDefault: event.target.checked }))
                }
              />
              Set as default payout account
            </label>
          </div>

          <Button type="submit" className="sm:col-span-2" disabled={submitting}>
            {editingAccountId ? (
              <>
                <Pencil className="mr-2 h-4 w-4" />
                Update Account
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add Account
              </>
            )}
          </Button>
        </form>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold">Saved Payout Accounts</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading accounts...</p>
        ) : !workspace || workspace.accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payout accounts added yet.</p>
        ) : (
          workspace.accounts.map((account) => (
            <article key={account.id} className="rounded-xl border border-border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{account.bankName}</p>
                {account.isDefault ? (
                  <span className="rounded-full bg-primary/15 px-2 py-1 text-xs font-semibold text-primary">
                    Default
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {account.accountName} | {account.accountNumberMasked}
              </p>
              <p className="text-xs text-muted-foreground">
                Branch: {account.branchName ?? "-"} | SWIFT: {account.swiftCode ?? "-"}
              </p>

              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => startEdit(account)} disabled={submitting}>
                  <Pencil className="mr-1.5 h-4 w-4" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => void deleteAccount(account.id)}
                  disabled={submitting}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Payout History</h2>
          <Select
            className="w-[220px]"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as PayoutStatus | "")}
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PROCESSING">Processing</option>
            <option value="PAID">Paid</option>
            <option value="FAILED">Failed</option>
          </Select>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading payout history...</p>
        ) : !workspace || filteredPayouts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payouts found for selected status.</p>
        ) : (
          filteredPayouts.map((payout) => (
            <article key={payout.id} className="rounded-xl border border-border bg-background p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    {formatCurrency(payout.amount, payout.currencyCode)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created: {new Date(payout.createdAt).toLocaleString()}
                  </p>
                </div>
                <StatusPill value={payout.status} />
              </div>

              <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <p>Reference: {payout.reference ?? "-"}</p>
                <p>Paid At: {payout.paidAt ? new Date(payout.paidAt).toLocaleString() : "-"}</p>
                <p>
                  Period:{" "}
                  {payout.periodStart ? new Date(payout.periodStart).toLocaleDateString() : "-"} -{" "}
                  {payout.periodEnd ? new Date(payout.periodEnd).toLocaleDateString() : "-"}
                </p>
                <p>Status: {payoutStatusLabel(payout.status)}</p>
              </div>
              {payout.notes ? <p className="mt-1 text-xs text-muted-foreground">{payout.notes}</p> : null}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
