"use client";

import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCcw, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToastStore } from "@/store/toast-store";
import type { AccountAddress } from "@/types/address";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type AddressFormState = {
  label: string;
  firstName: string;
  lastName: string;
  company: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
};

const initialFormState: AddressFormState = {
  label: "",
  firstName: "",
  lastName: "",
  company: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  countryCode: "LK",
  isDefaultShipping: false,
  isDefaultBilling: false,
};

function mapAddressToForm(address: AccountAddress): AddressFormState {
  return {
    label: address.label ?? "",
    firstName: address.firstName,
    lastName: address.lastName,
    company: address.company ?? "",
    phone: address.phone ?? "",
    line1: address.line1,
    line2: address.line2 ?? "",
    city: address.city,
    state: address.state ?? "",
    postalCode: address.postalCode ?? "",
    countryCode: address.countryCode,
    isDefaultShipping: address.isDefaultShipping,
    isDefaultBilling: address.isDefaultBilling,
  };
}

export function AddressesManager() {
  const pushToast = useToastStore((state) => state.pushToast);
  const [addresses, setAddresses] = useState<AccountAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressFormState>(initialFormState);

  const editingAddress = useMemo(
    () => addresses.find((address) => address.id === editingAddressId) ?? null,
    [addresses, editingAddressId],
  );

  const loadAddresses = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/account/addresses", { cache: "no-store" });
      const payload = (await response.json()) as ApiEnvelope<{ addresses: AccountAddress[] }>;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to load addresses");
      }

      setAddresses(payload.data.addresses);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load addresses";
      setError(message);
      pushToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadAddresses();
  }, [loadAddresses]);

  function updateForm<K extends keyof AddressFormState>(key: K, value: AddressFormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function startCreate() {
    setEditingAddressId(null);
    setForm(initialFormState);
    setFormVisible(true);
    setError(null);
  }

  function startEdit(address: AccountAddress) {
    setEditingAddressId(address.id);
    setForm(mapAddressToForm(address));
    setFormVisible(true);
    setError(null);
  }

  function cancelForm() {
    setEditingAddressId(null);
    setForm(initialFormState);
    setFormVisible(false);
    setError(null);
  }

  async function saveAddress() {
    setSaving(true);
    setError(null);

    try {
      const endpoint = editingAddressId
        ? `/api/account/addresses/${encodeURIComponent(editingAddressId)}`
        : "/api/account/addresses";
      const method = editingAddressId ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as ApiEnvelope<AccountAddress>;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to save address");
      }

      await loadAddresses();
      setFormVisible(false);
      setEditingAddressId(null);
      setForm(initialFormState);
      pushToast(editingAddressId ? "Address updated" : "Address added", "success");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unable to save address";
      setError(message);
      pushToast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function removeAddress(addressId: string) {
    const target = addresses.find((address) => address.id === addressId);
    if (!target) return;
    const confirmed = window.confirm(`Delete address "${target.label || target.line1}"?`);
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/account/addresses/${encodeURIComponent(addressId)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as ApiEnvelope<{ id: string }>;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to delete address");
      }

      await loadAddresses();
      if (editingAddressId === addressId) {
        cancelForm();
      }
      pushToast("Address deleted", "info");
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : "Unable to delete address";
      setError(message);
      pushToast(message, "error");
    }
  }

  if (loading && addresses.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Loading address book...</p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div>
          <h1 className="text-2xl font-bold">Address Book</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Save shipping and billing addresses for faster checkout.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void loadAddresses()} disabled={loading || saving}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={startCreate} disabled={saving}>
            <Plus className="mr-2 h-4 w-4" />
            Add Address
          </Button>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {addresses.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            You have no saved addresses yet. Add your first address to speed up checkout.
          </p>
        </section>
      ) : (
        <section className="grid gap-3 xl:grid-cols-2">
          {addresses.map((address) => (
            <article
              key={address.id}
              className="space-y-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{address.label || "Saved Address"}</p>
                <div className="flex items-center gap-2">
                  {address.isDefaultShipping ? (
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
                      Default shipping
                    </span>
                  ) : null}
                  {address.isDefaultBilling ? (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                      Default billing
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground">
                  {address.firstName} {address.lastName}
                </p>
                {address.company ? <p>{address.company}</p> : null}
                <p>{address.line1}</p>
                {address.line2 ? <p>{address.line2}</p> : null}
                <p>
                  {address.city}
                  {address.state ? `, ${address.state}` : ""}
                  {address.postalCode ? ` ${address.postalCode}` : ""}
                </p>
                <p>{address.countryCode}</p>
                {address.phone ? <p>{address.phone}</p> : null}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => startEdit(address)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => void removeAddress(address.id)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </article>
          ))}
        </section>
      )}

      {formVisible ? (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {editingAddress ? "Edit Address" : "Add New Address"}
            </h2>
            <Button variant="ghost" size="sm" onClick={cancelForm}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Label</span>
              <Input
                value={form.label}
                onChange={(event) => updateForm("label", event.target.value)}
                placeholder="Home, Office, Warehouse..."
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Phone</span>
              <Input
                value={form.phone}
                onChange={(event) => updateForm("phone", event.target.value)}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">First Name</span>
              <Input
                value={form.firstName}
                onChange={(event) => updateForm("firstName", event.target.value)}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Last Name</span>
              <Input
                value={form.lastName}
                onChange={(event) => updateForm("lastName", event.target.value)}
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Company (optional)</span>
              <Input
                value={form.company}
                onChange={(event) => updateForm("company", event.target.value)}
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Address Line 1</span>
              <Input
                value={form.line1}
                onChange={(event) => updateForm("line1", event.target.value)}
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Address Line 2</span>
              <Input
                value={form.line2}
                onChange={(event) => updateForm("line2", event.target.value)}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">City</span>
              <Input
                value={form.city}
                onChange={(event) => updateForm("city", event.target.value)}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">State</span>
              <Input
                value={form.state}
                onChange={(event) => updateForm("state", event.target.value)}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Postal Code</span>
              <Input
                value={form.postalCode}
                onChange={(event) => updateForm("postalCode", event.target.value)}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Country Code</span>
              <Input
                value={form.countryCode}
                maxLength={2}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateForm("countryCode", event.target.value.toUpperCase())
                }
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={form.isDefaultShipping}
                onChange={(event) => updateForm("isDefaultShipping", event.target.checked)}
              />
              Set as default shipping
            </label>
            <label className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={form.isDefaultBilling}
                onChange={(event) => updateForm("isDefaultBilling", event.target.checked)}
              />
              Set as default billing
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => void saveAddress()} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : editingAddress ? "Update Address" : "Save Address"}
            </Button>
            <Button variant="outline" onClick={cancelForm} disabled={saving}>
              Cancel
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
