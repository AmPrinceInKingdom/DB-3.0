"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AccountStatus } from "@prisma/client";
import { RefreshCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/ui/status-pill";
import { useToastStore } from "@/store/toast-store";
import type { SellerApplicationPayload, SellerApplicationRecord } from "@/types/seller";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type ApplicationFormState = {
  storeName: string;
  supportEmail: string;
  supportPhone: string;
  taxId: string;
  description: string;
};

const emptyForm: ApplicationFormState = {
  storeName: "",
  supportEmail: "",
  supportPhone: "",
  taxId: "",
  description: "",
};

function toFormState(application: SellerApplicationRecord | null): ApplicationFormState {
  if (!application) return emptyForm;
  return {
    storeName: application.storeName,
    supportEmail: application.supportEmail ?? "",
    supportPhone: application.supportPhone ?? "",
    taxId: application.taxId ?? "",
    description: application.description ?? "",
  };
}

function getStatusHint(status: AccountStatus) {
  if (status === "PENDING") {
    return "Your application is under review. You can update business details while waiting.";
  }
  if (status === "ACTIVE") {
    return "Your seller account is active. You can now manage products and orders.";
  }
  if (status === "SUSPENDED") {
    return "Your seller profile is suspended. Update details and resubmit for review.";
  }
  return "Review your details before submitting.";
}

export function SellerApplicationForm() {
  const pushToast = useToastStore((state) => state.pushToast);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [application, setApplication] = useState<SellerApplicationRecord | null>(null);
  const [form, setForm] = useState<ApplicationFormState>(emptyForm);

  const isActiveSeller = application?.status === "ACTIVE" && application.userRole === "SELLER";

  const loadApplication = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/seller/application", {
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiEnvelope<SellerApplicationPayload>;

      if (response.status === 401) {
        setRequiresLogin(true);
        setApplication(null);
        setForm(emptyForm);
        return;
      }

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to load seller application");
      }

      setRequiresLogin(false);
      setApplication(payload.data.application);
      setForm(toFormState(payload.data.application));
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Unable to load seller application";
      setError(message);
      pushToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadApplication();
  }, [loadApplication]);

  const submitApplication = async () => {
    if (isActiveSeller) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/seller/application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as ApiEnvelope<SellerApplicationPayload>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to submit seller application");
      }

      setApplication(payload.data.application);
      setForm(toFormState(payload.data.application));
      pushToast("Seller application submitted successfully", "success");
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Unable to submit seller application";
      setError(message);
      pushToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const summaryHint = useMemo(() => {
    if (!application) return "Submit your store details for admin approval.";
    return getStatusHint(application.status);
  }, [application]);

  if (loading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">Loading seller application...</p>
      </section>
    );
  }

  if (requiresLogin) {
    return (
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Login Required</h2>
          <p className="text-sm text-muted-foreground">
            Please login with your customer account before submitting a seller application.
          </p>
        </div>
        <Button asChild>
          <Link href="/login?next=/seller/apply">Login To Continue</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Seller Application Form</h2>
          <p className="text-sm text-muted-foreground">{summaryHint}</p>
        </div>
        <div className="flex items-center gap-2">
          {application ? <StatusPill value={application.status} /> : null}
          <Button variant="outline" onClick={() => void loadApplication()} disabled={submitting}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium">Store Name</label>
          <Input
            value={form.storeName}
            onChange={(event) => setForm((current) => ({ ...current, storeName: event.target.value }))}
            disabled={isActiveSeller || submitting}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Support Email</label>
          <Input
            type="email"
            value={form.supportEmail}
            onChange={(event) => setForm((current) => ({ ...current, supportEmail: event.target.value }))}
            disabled={isActiveSeller || submitting}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Support Phone</label>
          <Input
            value={form.supportPhone}
            onChange={(event) => setForm((current) => ({ ...current, supportPhone: event.target.value }))}
            disabled={isActiveSeller || submitting}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Tax ID (Optional)</label>
          <Input
            value={form.taxId}
            onChange={(event) => setForm((current) => ({ ...current, taxId: event.target.value }))}
            disabled={isActiveSeller || submitting}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">Store Description</label>
        <textarea
          className="focus-ring min-h-24 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground"
          value={form.description}
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          disabled={isActiveSeller || submitting}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={() => void submitApplication()}
          disabled={submitting || isActiveSeller}
        >
          <Send className="mr-2 h-4 w-4" />
          {submitting ? "Submitting..." : application ? "Update Application" : "Submit Application"}
        </Button>
        {isActiveSeller ? (
          <Button variant="outline" asChild>
            <Link href="/seller/dashboard">Open Seller Dashboard</Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
