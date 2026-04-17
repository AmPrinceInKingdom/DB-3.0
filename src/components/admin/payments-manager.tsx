"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PaymentStatus } from "@prisma/client";
import { AlertTriangle, Download, RefreshCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCurrency } from "@/lib/utils";
import type {
  AdminPaymentAuditLogPage,
  AdminPaymentAuditLogItem,
  AdminPaymentProofItem,
  AdminPaymentWebhookEventItem,
} from "@/types/order";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

const verificationStatusOptions: PaymentStatus[] = [
  "AWAITING_VERIFICATION",
  "PAID",
  "FAILED",
  "PENDING",
  "REFUNDED",
];

const webhookResultOptions = [
  "ALL",
  "ACTION_REQUIRED",
  "SUCCESS",
  "FAILED",
  "HANDLED",
  "UNHANDLED",
] as const;
type WebhookResultFilter = (typeof webhookResultOptions)[number];
const auditActionFilterOptions = [
  "ALL",
  "PAYMENT_PROOF_APPROVED",
  "PAYMENT_PROOF_REJECTED",
  "PAYMENT_WEBHOOK_REPROCESSED",
  "PAYMENT_WEBHOOK_REPROCESS_FAILED",
] as const;
type AuditActionFilter = (typeof auditActionFilterOptions)[number];
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stringifyPayload(payload: unknown) {
  try {
    return JSON.stringify(payload ?? {}, null, 2);
  } catch {
    return "{\n  \"error\": \"Unable to render payload\"\n}";
  }
}

function isSameLocalDate(date: Date, otherDate: Date) {
  return (
    date.getFullYear() === otherDate.getFullYear() &&
    date.getMonth() === otherDate.getMonth() &&
    date.getDate() === otherDate.getDate()
  );
}

function formatAuditAction(action: string) {
  return action
    .toLowerCase()
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function formatRelativeTime(input: string | Date) {
  const date = typeof input === "string" ? new Date(input) : input;
  const ts = date.getTime();
  if (!Number.isFinite(ts)) return "Unknown";

  const diffMs = Date.now() - ts;
  const absMs = Math.abs(diffMs);

  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (absMs < minute) return "Just now";
  if (absMs < hour) {
    const minutes = Math.floor(absMs / minute);
    return `${minutes}m ago`;
  }
  if (absMs < day) {
    const hours = Math.floor(absMs / hour);
    return `${hours}h ago`;
  }
  const days = Math.floor(absMs / day);
  return `${days}d ago`;
}

function getAuditSeverity(action: string) {
  if (action.endsWith("APPROVED") || action.endsWith("REPROCESSED")) {
    return "SUCCESS";
  }
  if (action.endsWith("REJECTED") || action.endsWith("FAILED")) {
    return "FAILURE";
  }
  return "INFO";
}

function getAuditSeverityClass(severity: string) {
  if (severity === "SUCCESS") {
    return "border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (severity === "FAILURE") {
    return "border-red-400/40 bg-red-500/10 text-red-700 dark:text-red-300";
  }
  return "border-blue-400/40 bg-blue-500/10 text-blue-700 dark:text-blue-300";
}

function compactAuditJson(value: unknown, maxLength = 220) {
  if (!value || typeof value !== "object") return null;

  try {
    const text = JSON.stringify(value);
    if (!text) return null;
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return uuidPattern.test(value) ? value : null;
}

function extractOrderIdFromAuditLog(log: AdminPaymentAuditLogItem): string | null {
  const newValues = asRecord(log.newValues);
  const oldValues = asRecord(log.oldValues);

  return asUuid(newValues?.orderId) ?? asUuid(oldValues?.orderId) ?? null;
}

function extractWebhookIdFromAuditLog(log: AdminPaymentAuditLogItem): string | null {
  if (log.targetTable === "payment_webhook_events") {
    return asUuid(log.targetId);
  }

  const newValues = asRecord(log.newValues);
  return asUuid(newValues?.webhookEventId) ?? null;
}

export function PaymentsManager() {
  const [proofs, setProofs] = useState<AdminPaymentProofItem[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<AdminPaymentWebhookEventItem[]>([]);
  const [paymentAuditLogs, setPaymentAuditLogs] = useState<AdminPaymentAuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [webhookLoading, setWebhookLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditNotice, setAuditNotice] = useState<string | null>(null);
  const [webhookNotice, setWebhookNotice] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "">("AWAITING_VERIFICATION");
  const [webhookResultFilter, setWebhookResultFilter] = useState<WebhookResultFilter>("ALL");
  const [webhookSearchDraft, setWebhookSearchDraft] = useState("");
  const [webhookReferenceDraft, setWebhookReferenceDraft] = useState("");
  const [webhookEventTypeDraft, setWebhookEventTypeDraft] = useState("");
  const [webhookDateFromDraft, setWebhookDateFromDraft] = useState("");
  const [webhookDateToDraft, setWebhookDateToDraft] = useState("");
  const [webhookSearch, setWebhookSearch] = useState("");
  const [webhookReference, setWebhookReference] = useState("");
  const [webhookEventType, setWebhookEventType] = useState("");
  const [webhookDateFrom, setWebhookDateFrom] = useState("");
  const [webhookDateTo, setWebhookDateTo] = useState("");
  const [webhookLimit, setWebhookLimit] = useState(80);
  const [auditSearchDraft, setAuditSearchDraft] = useState("");
  const [auditDateFromDraft, setAuditDateFromDraft] = useState("");
  const [auditDateToDraft, setAuditDateToDraft] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditDateFrom, setAuditDateFrom] = useState("");
  const [auditDateTo, setAuditDateTo] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState<AuditActionFilter>("ALL");
  const [auditPage, setAuditPage] = useState(1);
  const [auditHasMore, setAuditHasMore] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<AdminPaymentWebhookEventItem | null>(null);
  const [selectedAuditLog, setSelectedAuditLog] = useState<AdminPaymentAuditLogItem | null>(null);
  const [confirmWebhookEvent, setConfirmWebhookEvent] = useState<AdminPaymentWebhookEventItem | null>(null);
  const [busyProofId, setBusyProofId] = useState<string | null>(null);
  const [busyWebhookEventId, setBusyWebhookEventId] = useState<string | null>(null);
  const [batchReprocessing, setBatchReprocessing] = useState(false);
  const [lastReprocessedWebhookId, setLastReprocessedWebhookId] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("verificationStatus", statusFilter);
    return params.toString();
  }, [statusFilter]);

  const buildWebhookSearchParams = useCallback(
    (limit: number) => {
      const params = new URLSearchParams();
      if (webhookSearch) params.set("search", webhookSearch);
      if (webhookReference) params.set("reference", webhookReference);
      if (webhookEventType) params.set("eventType", webhookEventType);
      if (webhookDateFrom) params.set("dateFrom", webhookDateFrom);
      if (webhookDateTo) params.set("dateTo", webhookDateTo);
      if (webhookResultFilter === "SUCCESS") params.set("success", "true");
      if (webhookResultFilter === "FAILED") params.set("success", "false");
      if (webhookResultFilter === "HANDLED") params.set("handled", "true");
      if (webhookResultFilter === "UNHANDLED") params.set("handled", "false");
      params.set("limit", String(limit));
      return params;
    },
    [
      webhookDateFrom,
      webhookDateTo,
      webhookEventType,
      webhookReference,
      webhookResultFilter,
      webhookSearch,
    ],
  );

  const webhookQuery = useMemo(() => {
    const params = buildWebhookSearchParams(webhookLimit);
    return params.toString();
  }, [buildWebhookSearchParams, webhookLimit]);

  const webhookExportUrl = useMemo(() => {
    const params = buildWebhookSearchParams(2000);
    return `/api/admin/payments/webhooks/export?${params.toString()}`;
  }, [buildWebhookSearchParams]);

  const buildAuditSearchParams = useCallback(
    (limit: number, page: number) => {
      const params = new URLSearchParams();
      if (auditSearch) params.set("search", auditSearch);
      if (auditDateFrom) params.set("dateFrom", auditDateFrom);
      if (auditDateTo) params.set("dateTo", auditDateTo);
      if (auditActionFilter !== "ALL") params.set("actionType", auditActionFilter);
      params.set("page", String(page));
      params.set("limit", String(limit));
      return params;
    },
    [auditActionFilter, auditDateFrom, auditDateTo, auditSearch],
  );

  const auditQuery = useMemo(() => {
    const params = buildAuditSearchParams(12, auditPage);
    return params.toString();
  }, [auditPage, buildAuditSearchParams]);

  const auditExportUrl = useMemo(() => {
    const params = buildAuditSearchParams(2000, 1);
    return `/api/admin/payments/audit/export?${params.toString()}`;
  }, [buildAuditSearchParams]);

  const exportWebhookCsv = useCallback(() => {
    window.location.assign(webhookExportUrl);
  }, [webhookExportUrl]);

  const exportAuditCsv = useCallback(() => {
    window.location.assign(auditExportUrl);
  }, [auditExportUrl]);

  const selectedWebhookPayloadText = useMemo(
    () => stringifyPayload(selectedWebhook?.payload),
    [selectedWebhook?.payload],
  );
  const selectedAuditOldValuesText = useMemo(
    () => stringifyPayload(selectedAuditLog?.oldValues),
    [selectedAuditLog?.oldValues],
  );
  const selectedAuditNewValuesText = useMemo(
    () => stringifyPayload(selectedAuditLog?.newValues),
    [selectedAuditLog?.newValues],
  );
  const selectedAuditOrderId = useMemo(
    () => (selectedAuditLog ? extractOrderIdFromAuditLog(selectedAuditLog) : null),
    [selectedAuditLog],
  );
  const selectedAuditWebhookId = useMemo(
    () => (selectedAuditLog ? extractWebhookIdFromAuditLog(selectedAuditLog) : null),
    [selectedAuditLog],
  );
  const visibleWebhookEvents = useMemo(() => {
    if (webhookResultFilter !== "ACTION_REQUIRED") return webhookEvents;
    return webhookEvents.filter((event) => !event.success || !event.handled);
  }, [webhookEvents, webhookResultFilter]);
  const webhookStats = useMemo(() => {
    const today = new Date();
    const total = visibleWebhookEvents.length;
    const success = visibleWebhookEvents.filter((event) => event.success).length;
    const failed = total - success;
    const handled = visibleWebhookEvents.filter((event) => event.handled).length;
    const unhandled = total - handled;
    const actionRequired = visibleWebhookEvents.filter((event) => !event.success || !event.handled).length;
    const todayCount = visibleWebhookEvents.filter((event) =>
      isSameLocalDate(new Date(event.createdAt), today),
    ).length;

    return {
      total,
      success,
      failed,
      handled,
      unhandled,
      actionRequired,
      todayCount,
    };
  }, [visibleWebhookEvents]);
  const listedActionRequiredWebhookIds = useMemo(
    () =>
      visibleWebhookEvents
        .filter((event) => !event.success || !event.handled)
        .map((event) => event.id),
    [visibleWebhookEvents],
  );

  const loadProofs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/payments${query ? `?${query}` : ""}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiEnvelope<AdminPaymentProofItem[]>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to load payment proofs");
      }
      setProofs(payload.data ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load payment proofs");
    } finally {
      setLoading(false);
    }
  }, [query]);

  const loadWebhookEvents = useCallback(async () => {
    setWebhookLoading(true);
    setWebhookError(null);
    try {
      const response = await fetch(`/api/admin/payments/webhooks${webhookQuery ? `?${webhookQuery}` : ""}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiEnvelope<AdminPaymentWebhookEventItem[]>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to load payment webhook events");
      }
      const nextEvents = payload.data ?? [];
      setWebhookEvents(nextEvents);
      return nextEvents;
    } catch (loadError) {
      setWebhookError(
        loadError instanceof Error ? loadError.message : "Unable to load payment webhook events",
      );
      return [] as AdminPaymentWebhookEventItem[];
    } finally {
      setWebhookLoading(false);
    }
  }, [webhookQuery]);

  const loadPaymentAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const response = await fetch(`/api/admin/payments/audit${auditQuery ? `?${auditQuery}` : ""}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiEnvelope<AdminPaymentAuditLogPage>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to load payment activity logs");
      }
      setPaymentAuditLogs(payload.data?.items ?? []);
      setAuditHasMore(Boolean(payload.data?.hasMore));
    } catch (loadError) {
      setAuditError(loadError instanceof Error ? loadError.message : "Unable to load payment activity logs");
      setPaymentAuditLogs([]);
      setAuditHasMore(false);
    } finally {
      setAuditLoading(false);
    }
  }, [auditQuery]);

  useEffect(() => {
    void loadProofs();
  }, [loadProofs]);

  useEffect(() => {
    void loadWebhookEvents();
  }, [loadWebhookEvents]);

  useEffect(() => {
    void loadPaymentAuditLogs();
  }, [loadPaymentAuditLogs]);

  const applyWebhookFilters = useCallback(() => {
    setWebhookSearch(webhookSearchDraft.trim());
    setWebhookReference(webhookReferenceDraft.trim());
    setWebhookEventType(webhookEventTypeDraft.trim());
    setWebhookDateFrom(webhookDateFromDraft);
    setWebhookDateTo(webhookDateToDraft);
  }, [
    webhookDateFromDraft,
    webhookDateToDraft,
    webhookEventTypeDraft,
    webhookReferenceDraft,
    webhookSearchDraft,
  ]);

  const clearWebhookFilters = useCallback(() => {
    setWebhookSearchDraft("");
    setWebhookReferenceDraft("");
    setWebhookEventTypeDraft("");
    setWebhookDateFromDraft("");
    setWebhookDateToDraft("");
    setWebhookSearch("");
    setWebhookReference("");
    setWebhookEventType("");
    setWebhookDateFrom("");
    setWebhookDateTo("");
    setWebhookResultFilter("ALL");
    setWebhookLimit(80);
  }, []);

  const applyAuditFilters = useCallback(() => {
    setAuditSearch(auditSearchDraft.trim());
    setAuditDateFrom(auditDateFromDraft);
    setAuditDateTo(auditDateToDraft);
    setAuditPage(1);
  }, [auditDateFromDraft, auditDateToDraft, auditSearchDraft]);

  const clearAuditFilters = useCallback(() => {
    setAuditSearchDraft("");
    setAuditDateFromDraft("");
    setAuditDateToDraft("");
    setAuditSearch("");
    setAuditDateFrom("");
    setAuditDateTo("");
    setAuditActionFilter("ALL");
    setAuditPage(1);
  }, []);

  const focusWebhookFromAudit = useCallback((webhookEventId: string) => {
    setWebhookReferenceDraft("");
    setWebhookEventTypeDraft("");
    setWebhookReference("");
    setWebhookEventType("");
    setWebhookSearchDraft(webhookEventId);
    setWebhookSearch(webhookEventId);
    setWebhookResultFilter("ALL");
    setAuditNotice("Moved to webhook section with selected event filter.");
    setAuditError(null);
    setTimeout(() => {
      document.getElementById("webhook-events-section")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 20);
  }, []);

  const copyAuditPayload = useCallback(
    async (kind: "old" | "new") => {
      const text = kind === "old" ? selectedAuditOldValuesText : selectedAuditNewValuesText;
      const label = kind === "old" ? "old values" : "new values";

      setAuditError(null);
      setAuditNotice(null);
      try {
        if (!navigator?.clipboard?.writeText) {
          throw new Error("Clipboard API not supported in this browser");
        }
        await navigator.clipboard.writeText(text);
        setAuditNotice(`Copied ${label} JSON.`);
      } catch {
        setAuditError(`Unable to copy ${label} JSON.`);
      }
    },
    [selectedAuditNewValuesText, selectedAuditOldValuesText],
  );

  const reprocessWebhookEvent = useCallback(
    async (webhookEventId: string) => {
      setWebhookError(null);
      setWebhookNotice(null);
      setBusyWebhookEventId(webhookEventId);

      try {
        const response = await fetch(`/api/admin/payments/webhooks/${webhookEventId}/reprocess`, {
          method: "POST",
        });
        const payload = (await response.json()) as ApiEnvelope<{
          webhookEventId: string;
          success: boolean;
          handled: boolean;
          reference: string | null;
          paymentStatus?: string;
          orderStatus?: string;
        }>;
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error ?? "Unable to reprocess webhook event");
        }

        const [refreshedEvents] = await Promise.all([
          loadWebhookEvents(),
          loadProofs(),
          loadPaymentAuditLogs(),
        ]);
        const refreshedEvent = refreshedEvents.find((event) => event.id === webhookEventId);
        if (refreshedEvent) {
          setSelectedWebhook((current) => (current?.id === webhookEventId ? refreshedEvent : current));
        }
        setLastReprocessedWebhookId(webhookEventId);
        const statusDetails = [
          payload.data.paymentStatus ? `payment=${payload.data.paymentStatus}` : null,
          payload.data.orderStatus ? `order=${payload.data.orderStatus}` : null,
        ]
          .filter(Boolean)
          .join(", ");
        setWebhookNotice(
          statusDetails.length
            ? `Webhook reprocessed successfully (${statusDetails}).`
            : "Webhook reprocessed successfully.",
        );
        return true;
      } catch (reprocessError) {
        setWebhookError(
          reprocessError instanceof Error
            ? reprocessError.message
            : "Unable to reprocess webhook event",
        );
        return false;
      } finally {
        setBusyWebhookEventId(null);
      }
    },
    [loadPaymentAuditLogs, loadProofs, loadWebhookEvents],
  );

  const openWebhookReprocessConfirm = useCallback((event: AdminPaymentWebhookEventItem) => {
    setWebhookError(null);
    setWebhookNotice(null);
    setConfirmWebhookEvent(event);
  }, []);

  const confirmWebhookReprocess = useCallback(async () => {
    if (!confirmWebhookEvent) return;
    const success = await reprocessWebhookEvent(confirmWebhookEvent.id);
    if (success) {
      setConfirmWebhookEvent(null);
    }
  }, [confirmWebhookEvent, reprocessWebhookEvent]);

  const reprocessWebhookBatch = useCallback(async () => {
    const targetIds = listedActionRequiredWebhookIds.slice(0, 10);
    if (targetIds.length === 0) {
      setWebhookNotice("No action-required webhook events in the current list.");
      setWebhookError(null);
      return;
    }

    const accepted = window.confirm(
      `Reprocess ${targetIds.length} action-required webhook event(s)? This is limited to the first 10 for safety.`,
    );
    if (!accepted) return;

    setBatchReprocessing(true);
    setWebhookError(null);
    setWebhookNotice(null);

    try {
      const response = await fetch("/api/admin/payments/webhooks/reprocess-failed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventIds: targetIds,
          limit: targetIds.length,
        }),
      });

      const payload = (await response.json()) as ApiEnvelope<{
        selectedCount: number;
        succeeded: number;
        failed: number;
      }>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to reprocess webhook batch");
      }

      await Promise.all([loadWebhookEvents(), loadProofs(), loadPaymentAuditLogs()]);
      setWebhookNotice(
        `Batch reprocess completed: ${payload.data.succeeded} succeeded, ${payload.data.failed} failed (selected ${payload.data.selectedCount}).`,
      );
    } catch (batchError) {
      setWebhookError(
        batchError instanceof Error ? batchError.message : "Unable to reprocess webhook batch",
      );
    } finally {
      setBatchReprocessing(false);
    }
  }, [listedActionRequiredWebhookIds, loadPaymentAuditLogs, loadProofs, loadWebhookEvents]);

  const reviewProof = async (proofId: string, action: "APPROVE" | "REJECT") => {
    setError(null);
    setBusyProofId(proofId);

    try {
      const reason =
        action === "REJECT"
          ? window.prompt("Reason for rejection (required):", "Invalid or unclear transfer proof") ?? ""
          : "";

      const response = await fetch(`/api/admin/payments/proofs/${proofId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const payload = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to review payment proof");
      }

      await Promise.all([loadProofs(), loadPaymentAuditLogs()]);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Unable to review payment proof");
    } finally {
      setBusyProofId(null);
    }
  };

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <Select
          className="min-w-[220px]"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as PaymentStatus | "")}
        >
          <option value="">All Verification Statuses</option>
          {verificationStatusOptions.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
        <Input
          className="min-w-[220px]"
          placeholder="Search order/ref/event ID"
          value={webhookSearchDraft}
          onChange={(event) => setWebhookSearchDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              applyWebhookFilters();
            }
          }}
        />
        <Input
          className="min-w-[200px]"
          placeholder="Reference only (optional)"
          value={webhookReferenceDraft}
          onChange={(event) => setWebhookReferenceDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              applyWebhookFilters();
            }
          }}
        />
        <Input
          className="min-w-[220px]"
          placeholder="Event type (e.g. checkout.session.completed)"
          value={webhookEventTypeDraft}
          onChange={(event) => setWebhookEventTypeDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              applyWebhookFilters();
            }
          }}
        />
        <Input
          className="min-w-[170px]"
          type="date"
          value={webhookDateFromDraft}
          onChange={(event) => setWebhookDateFromDraft(event.target.value)}
        />
        <Input
          className="min-w-[170px]"
          type="date"
          value={webhookDateToDraft}
          onChange={(event) => setWebhookDateToDraft(event.target.value)}
        />
        <Select
          className="min-w-[220px]"
          value={webhookResultFilter}
          onChange={(event) => setWebhookResultFilter(event.target.value as WebhookResultFilter)}
        >
          {webhookResultOptions.map((option) => (
            <option key={option} value={option}>
              Webhooks:{" "}
              {option === "ACTION_REQUIRED" ? "ACTION REQUIRED" : option}
            </option>
          ))}
        </Select>
        <Select
          className="min-w-[160px]"
          value={String(webhookLimit)}
          onChange={(event) => setWebhookLimit(Number(event.target.value))}
        >
          <option value="40">Show 40 rows</option>
          <option value="80">Show 80 rows</option>
          <option value="200">Show 200 rows</option>
        </Select>
        <Button variant="secondary" onClick={applyWebhookFilters}>
          Apply Webhook Filters
        </Button>
        <Button variant="outline" onClick={clearWebhookFilters}>
          Clear Webhook Filters
        </Button>
        <Button variant="outline" onClick={exportWebhookCsv}>
          <Download className="mr-2 h-4 w-4" />
          Export Webhooks CSV
        </Button>
        <Button
          variant="secondary"
          disabled={batchReprocessing || listedActionRequiredWebhookIds.length === 0}
          onClick={() => void reprocessWebhookBatch()}
        >
          {batchReprocessing
            ? "Batch Reprocessing..."
            : `Reprocess Action Required (${Math.min(listedActionRequiredWebhookIds.length, 10)})`}
        </Button>
        <Button
          variant="outline"
          onClick={() => void Promise.all([loadProofs(), loadWebhookEvents(), loadPaymentAuditLogs()])}
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {webhookError ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
          {webhookError}
        </p>
      ) : null}
      {auditError ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
          {auditError}
        </p>
      ) : null}
      {auditNotice ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
          {auditNotice}
        </p>
      ) : null}
      {webhookNotice ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
          {webhookNotice}
        </p>
      ) : null}

      {loading ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Loading payment proofs...</p>
        </section>
      ) : proofs.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">No payment proofs found.</p>
        </section>
      ) : (
        <section className="space-y-3">
          {proofs.map((proof) => (
            <article key={proof.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Order #{proof.order.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    Uploaded: {new Date(proof.createdAt).toLocaleString()}
                  </p>
                </div>
                <StatusPill value={proof.verificationStatus} />
              </div>

              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p className="text-muted-foreground">
                  Customer: <span className="font-semibold text-foreground">{proof.order.customerEmail}</span>
                </p>
                <p className="text-muted-foreground">
                  Total:{" "}
                  <span className="font-semibold text-foreground">
                    {formatCurrency(proof.order.grandTotal, proof.order.currencyCode)}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  File: <span className="font-semibold text-foreground">{proof.fileName ?? "-"}</span>
                </p>
                <p className="text-muted-foreground">
                  Size: <span className="font-semibold text-foreground">{proof.sizeBytes ?? "-"}</span>
                </p>
              </div>

              {proof.rejectionReason ? (
                <p className="text-xs text-red-600 dark:text-red-300">
                  Rejection reason: {proof.rejectionReason}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" type="button" asChild>
                  <a href={proof.fileUrl} target="_blank" rel="noreferrer">
                    View Proof
                  </a>
                </Button>
                <Button
                  size="sm"
                  type="button"
                  disabled={busyProofId === proof.id}
                  onClick={() => void reviewProof(proof.id, "APPROVE")}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  type="button"
                  disabled={busyProofId === proof.id}
                  onClick={() => void reviewProof(proof.id, "REJECT")}
                >
                  Reject
                </Button>
              </div>
            </article>
          ))}
        </section>
      )}

      <section id="webhook-events-section" className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <header className="space-y-1">
          <h3 className="text-sm font-semibold">Card Gateway Webhook Events</h3>
          <p className="text-xs text-muted-foreground">
            Stripe callback history for troubleshooting payment confirmation issues.
          </p>
          {(webhookSearch ||
            webhookReference ||
            webhookEventType ||
            webhookDateFrom ||
            webhookDateTo ||
            webhookResultFilter !== "ALL" ||
            webhookLimit !== 80) ? (
            <p className="text-xs text-muted-foreground">
              Active filters:
              {webhookSearch ? ` search="${webhookSearch}"` : ""}
              {webhookReference ? ` reference="${webhookReference}"` : ""}
              {webhookEventType ? ` eventType="${webhookEventType}"` : ""}
              {webhookDateFrom ? ` from=${webhookDateFrom}` : ""}
              {webhookDateTo ? ` to=${webhookDateTo}` : ""}
              {webhookResultFilter !== "ALL"
                ? ` result=${webhookResultFilter === "ACTION_REQUIRED" ? "ACTION_REQUIRED" : webhookResultFilter}`
                : ""}
              {webhookLimit !== 80 ? ` limit=${webhookLimit}` : ""}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Showing {visibleWebhookEvents.length} event(s)
            {webhookResultFilter === "ACTION_REQUIRED" ? ` from ${webhookEvents.length} loaded` : ""}.
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <article className="rounded-xl border border-border bg-background p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Filtered Total
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">{webhookStats.total}</p>
          </article>
          <article className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Success
            </p>
            <p className="mt-1 text-xl font-semibold text-emerald-700 dark:text-emerald-300">
              {webhookStats.success}
            </p>
          </article>
          <article className="rounded-xl border border-red-400/30 bg-red-500/10 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-red-700 dark:text-red-300">
              Failed
            </p>
            <p className="mt-1 text-xl font-semibold text-red-700 dark:text-red-300">
              {webhookStats.failed}
            </p>
          </article>
          <article className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Action Required
            </p>
            <p className="mt-1 text-xl font-semibold text-amber-700 dark:text-amber-300">
              {webhookStats.actionRequired}
            </p>
          </article>
          <article className="rounded-xl border border-blue-400/30 bg-blue-500/10 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300">
              Handled
            </p>
            <p className="mt-1 text-xl font-semibold text-blue-700 dark:text-blue-300">
              {webhookStats.handled}
            </p>
            <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80">
              Unhandled: {webhookStats.unhandled}
            </p>
          </article>
          <article className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Today
            </p>
            <p className="mt-1 text-xl font-semibold text-amber-700 dark:text-amber-300">
              {webhookStats.todayCount}
            </p>
          </article>
        </div>

        {webhookLoading ? (
          <p className="text-sm text-muted-foreground">Loading webhook events...</p>
        ) : visibleWebhookEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No webhook events found.</p>
        ) : (
          <div className="space-y-2">
            {visibleWebhookEvents.map((event) => (
              <article
                key={event.id}
                className={
                  lastReprocessedWebhookId === event.id
                    ? "space-y-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3"
                    : "space-y-2 rounded-xl border border-border bg-background p-3"
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{event.eventType}</p>
                    <p className="text-xs text-muted-foreground">
                      Event ID: {event.eventId ?? "-"} | {new Date(event.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span
                      className={
                        event.success
                          ? "rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-300"
                          : "rounded-full border border-red-400/40 bg-red-500/10 px-2 py-0.5 text-red-700 dark:text-red-300"
                      }
                    >
                      {event.success ? "Success" : "Failed"}
                    </span>
                    <span
                      className={
                        event.handled
                          ? "rounded-full border border-blue-400/40 bg-blue-500/10 px-2 py-0.5 text-blue-700 dark:text-blue-300"
                          : "rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-300"
                      }
                    >
                      {event.handled ? "Handled" : "Unhandled"}
                    </span>
                  </div>
                </div>

                <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <p>
                    Reference: <span className="font-medium text-foreground">{event.reference ?? "-"}</span>
                  </p>
                  <p>
                    Order: <span className="font-medium text-foreground">{event.order?.orderNumber ?? "-"}</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {event.paymentStatus ? <StatusPill value={event.paymentStatus} /> : null}
                  {event.orderStatus ? <StatusPill value={event.orderStatus} /> : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSelectedWebhook(event)}>
                    View Details
                  </Button>
                  {!event.success || !event.handled ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busyWebhookEventId === event.id}
                      onClick={() => openWebhookReprocessConfirm(event)}
                    >
                      {busyWebhookEventId === event.id ? "Reprocessing..." : "Reprocess"}
                    </Button>
                  ) : null}
                  {event.order ? (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/admin/orders/${event.order.id}`}>Open Order</Link>
                    </Button>
                  ) : null}
                </div>

                {event.errorCode || event.errorMessage ? (
                  <p className="text-xs text-red-600 dark:text-red-300">
                    Error: {event.errorCode ?? "UNKNOWN"} {event.errorMessage ? `- ${event.errorMessage}` : ""}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <header className="space-y-1">
          <h3 className="text-sm font-semibold">Recent Payment Activity</h3>
          <p className="text-xs text-muted-foreground">
            Admin action history for payment proof reviews and webhook reprocessing.
          </p>
          {auditSearch || auditDateFrom || auditDateTo || auditActionFilter !== "ALL" ? (
            <p className="text-xs text-muted-foreground">
              Active filters:
              {auditSearch ? ` search="${auditSearch}"` : ""}
              {auditDateFrom ? ` from=${auditDateFrom}` : ""}
              {auditDateTo ? ` to=${auditDateTo}` : ""}
              {auditActionFilter !== "ALL" ? ` action=${auditActionFilter}` : ""}
            </p>
          ) : null}
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="min-w-[220px]"
            placeholder="Search action, admin email, target ID"
            value={auditSearchDraft}
            onChange={(event) => setAuditSearchDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyAuditFilters();
              }
            }}
          />
          <Input
            className="min-w-[170px]"
            type="date"
            value={auditDateFromDraft}
            onChange={(event) => setAuditDateFromDraft(event.target.value)}
          />
          <Input
            className="min-w-[170px]"
            type="date"
            value={auditDateToDraft}
            onChange={(event) => setAuditDateToDraft(event.target.value)}
          />
          <Button variant="secondary" size="sm" onClick={applyAuditFilters}>
            Apply Activity Filters
          </Button>
          <Button variant="outline" size="sm" onClick={clearAuditFilters}>
            Clear Activity Filters
          </Button>
          <Button variant="outline" size="sm" onClick={exportAuditCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export Activity CSV
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {auditActionFilterOptions.map((option) => {
            const active = auditActionFilter === option;
            return (
              <Button
                key={option}
                size="sm"
                variant={active ? "secondary" : "outline"}
                className="h-8"
                onClick={() => {
                  setAuditActionFilter(option);
                  setAuditPage(1);
                }}
              >
                {option === "ALL" ? "All Actions" : formatAuditAction(option)}
              </Button>
            );
          })}
        </div>

        {auditLoading ? (
          <p className="text-sm text-muted-foreground">Loading payment activity logs...</p>
        ) : paymentAuditLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payment activity logs found.</p>
        ) : (
          <div className="space-y-2">
            {paymentAuditLogs.map((log) => {
              const payloadPreview = compactAuditJson(log.newValues);
              const orderId = extractOrderIdFromAuditLog(log);
              const webhookEventId = extractWebhookIdFromAuditLog(log);
              const severity = getAuditSeverity(log.action);
              const severityClass = getAuditSeverityClass(severity);
              const relativeTime = formatRelativeTime(log.createdAt);
              return (
                <article key={log.id} className="space-y-1 rounded-xl border border-border bg-background p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{formatAuditAction(log.action)}</p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityClass}`}
                      >
                        {severity}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-foreground">{relativeTime}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <p>
                      Admin: <span className="font-medium text-foreground">{log.actor?.email ?? "Unknown"}</span>
                    </p>
                    <p>
                      Target:{" "}
                      <span className="font-medium text-foreground">
                        {log.targetTable ?? "-"} {log.targetId ? `(${log.targetId.slice(0, 8)}...)` : ""}
                      </span>
                    </p>
                    {log.ipAddress ? (
                      <p>
                        IP: <span className="font-medium text-foreground">{log.ipAddress}</span>
                      </p>
                    ) : null}
                  </div>

                  {payloadPreview ? (
                    <p className="text-xs text-muted-foreground">
                      Data: <span className="font-mono text-foreground">{payloadPreview}</span>
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setSelectedAuditLog(log)}>
                      View Change
                    </Button>
                    {orderId ? (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/admin/orders/${orderId}`}>Open Order</Link>
                      </Button>
                    ) : null}
                    {webhookEventId ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => focusWebhookFromAudit(webhookEventId)}
                      >
                        Find Webhook
                      </Button>
                    ) : null}
                  </div>
                </article>
              );
            })}

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">
                Page {auditPage} {auditHasMore ? "(more available)" : "(end reached)"}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={auditPage <= 1 || auditLoading}
                  onClick={() => setAuditPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!auditHasMore || auditLoading}
                  onClick={() => setAuditPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>

      {selectedWebhook ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close webhook details"
            className="flex-1 bg-black/45"
            onClick={() => setSelectedWebhook(null)}
          />
          <aside className="flex h-full w-full max-w-2xl flex-col border-l border-border bg-card shadow-2xl">
            <header className="flex items-start justify-between gap-3 border-b border-border p-4">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">Webhook Event Details</h4>
                <p className="text-xs text-muted-foreground">
                  {selectedWebhook.eventType} | {new Date(selectedWebhook.createdAt).toLocaleString()}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedWebhook(null)}>
                <X className="h-4 w-4" />
              </Button>
            </header>

            <div className="space-y-4 overflow-y-auto p-4">
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <p>
                  Event ID: <span className="font-medium text-foreground">{selectedWebhook.eventId ?? "-"}</span>
                </p>
                <p>
                  Provider: <span className="font-medium text-foreground">{selectedWebhook.provider}</span>
                </p>
                <p>
                  Reference:{" "}
                  <span className="font-medium text-foreground">{selectedWebhook.reference ?? "-"}</span>
                </p>
                <p>
                  Order:{" "}
                  <span className="font-medium text-foreground">
                    {selectedWebhook.order?.orderNumber ?? "-"}
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  className={
                    selectedWebhook.success
                      ? "rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300"
                      : "rounded-full border border-red-400/40 bg-red-500/10 px-2 py-0.5 text-xs text-red-700 dark:text-red-300"
                  }
                >
                  {selectedWebhook.success ? "Success" : "Failed"}
                </span>
                <span
                  className={
                    selectedWebhook.handled
                      ? "rounded-full border border-blue-400/40 bg-blue-500/10 px-2 py-0.5 text-xs text-blue-700 dark:text-blue-300"
                      : "rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300"
                  }
                >
                  {selectedWebhook.handled ? "Handled" : "Unhandled"}
                </span>
                {selectedWebhook.paymentStatus ? <StatusPill value={selectedWebhook.paymentStatus} /> : null}
                {selectedWebhook.orderStatus ? <StatusPill value={selectedWebhook.orderStatus} /> : null}
              </div>

              {selectedWebhook.errorCode || selectedWebhook.errorMessage ? (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-300">
                  Error: {selectedWebhook.errorCode ?? "UNKNOWN"}{" "}
                  {selectedWebhook.errorMessage ? `- ${selectedWebhook.errorMessage}` : ""}
                </p>
              ) : null}

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payload</p>
                <pre className="max-h-[55vh] overflow-auto rounded-xl border border-border bg-background p-3 text-xs text-foreground">
                  {selectedWebhookPayloadText}
                </pre>
              </div>
            </div>

            <footer className="flex flex-wrap justify-end gap-2 border-t border-border p-4">
              {!selectedWebhook.success || !selectedWebhook.handled ? (
                <Button
                  variant="secondary"
                  disabled={busyWebhookEventId === selectedWebhook.id}
                  onClick={() => openWebhookReprocessConfirm(selectedWebhook)}
                >
                  {busyWebhookEventId === selectedWebhook.id ? "Reprocessing..." : "Reprocess"}
                </Button>
              ) : null}
              {selectedWebhook.order ? (
                <Button variant="secondary" asChild>
                  <Link href={`/admin/orders/${selectedWebhook.order.id}`}>Open Order</Link>
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => setSelectedWebhook(null)}>
                Close
              </Button>
            </footer>
          </aside>
        </div>
      ) : null}
      {selectedAuditLog ? (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <button
            type="button"
            aria-label="Close activity details"
            className="flex-1 bg-black/45"
            onClick={() => setSelectedAuditLog(null)}
          />
          <aside className="flex h-full w-full max-w-2xl flex-col border-l border-border bg-card shadow-2xl">
            <header className="flex items-start justify-between gap-3 border-b border-border p-4">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">Payment Activity Details</h4>
                <p className="text-xs text-muted-foreground">
                  {formatAuditAction(selectedAuditLog.action)} |{" "}
                  {new Date(selectedAuditLog.createdAt).toLocaleString()}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getAuditSeverityClass(
                      getAuditSeverity(selectedAuditLog.action),
                    )}`}
                  >
                    {getAuditSeverity(selectedAuditLog.action)}
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    {formatRelativeTime(selectedAuditLog.createdAt)}
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedAuditLog(null)}>
                <X className="h-4 w-4" />
              </Button>
            </header>

            <div className="space-y-4 overflow-y-auto p-4">
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <p>
                  Admin:{" "}
                  <span className="font-medium text-foreground">
                    {selectedAuditLog.actor?.email ?? "Unknown"}
                  </span>
                </p>
                <p>
                  Action:{" "}
                  <span className="font-medium text-foreground">
                    {formatAuditAction(selectedAuditLog.action)}
                  </span>
                </p>
                <p>
                  Target Table:{" "}
                  <span className="font-medium text-foreground">{selectedAuditLog.targetTable ?? "-"}</span>
                </p>
                <p>
                  Target ID:{" "}
                  <span className="font-medium text-foreground break-all">
                    {selectedAuditLog.targetId ?? "-"}
                  </span>
                </p>
                <p>
                  IP Address:{" "}
                  <span className="font-medium text-foreground">{selectedAuditLog.ipAddress ?? "-"}</span>
                </p>
                <p>
                  User Agent:{" "}
                  <span className="font-medium text-foreground break-all">
                    {selectedAuditLog.userAgent ?? "-"}
                  </span>
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Old Values</p>
                <pre className="max-h-[30vh] overflow-auto rounded-xl border border-border bg-background p-3 text-xs text-foreground">
                  {selectedAuditOldValuesText}
                </pre>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">New Values</p>
                <pre className="max-h-[30vh] overflow-auto rounded-xl border border-border bg-background p-3 text-xs text-foreground">
                  {selectedAuditNewValuesText}
                </pre>
              </div>
            </div>

            <footer className="flex flex-wrap justify-end gap-2 border-t border-border p-4">
              {selectedAuditOrderId ? (
                <Button variant="secondary" asChild>
                  <Link href={`/admin/orders/${selectedAuditOrderId}`}>Open Order</Link>
                </Button>
              ) : null}
              {selectedAuditWebhookId ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    focusWebhookFromAudit(selectedAuditWebhookId);
                    setSelectedAuditLog(null);
                  }}
                >
                  Find Webhook
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => void copyAuditPayload("old")}>
                Copy Old JSON
              </Button>
              <Button variant="outline" onClick={() => void copyAuditPayload("new")}>
                Copy New JSON
              </Button>
              <Button variant="outline" onClick={() => setSelectedAuditLog(null)}>
                Close
              </Button>
            </footer>
          </aside>
        </div>
      ) : null}
      {confirmWebhookEvent ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close reprocess confirmation"
            className="absolute inset-0 bg-black/55"
            disabled={busyWebhookEventId === confirmWebhookEvent.id}
            onClick={() => setConfirmWebhookEvent(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="rounded-full border border-amber-400/40 bg-amber-500/10 p-2">
                <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-300" />
              </div>
              <div className="space-y-1">
                <h5 className="text-sm font-semibold">Reprocess Webhook Event?</h5>
                <p className="text-xs text-muted-foreground">
                  This will retry payment reconciliation for event{" "}
                  <span className="font-medium text-foreground">{confirmWebhookEvent.eventType}</span>.
                </p>
                <p className="text-xs text-muted-foreground">
                  Event ID:{" "}
                  <span className="font-medium text-foreground">
                    {confirmWebhookEvent.eventId ?? confirmWebhookEvent.id}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Order:{" "}
                  <span className="font-medium text-foreground">
                    {confirmWebhookEvent.order?.orderNumber ?? "Not linked"}
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                disabled={busyWebhookEventId === confirmWebhookEvent.id}
                onClick={() => setConfirmWebhookEvent(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={busyWebhookEventId === confirmWebhookEvent.id}
                onClick={() => void confirmWebhookReprocess()}
              >
                {busyWebhookEventId === confirmWebhookEvent.id ? "Reprocessing..." : "Yes, Reprocess"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
