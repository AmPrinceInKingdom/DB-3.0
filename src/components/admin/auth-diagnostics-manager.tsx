"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import {
  AlertTriangle,
  Copy,
  Database,
  Globe,
  KeyRound,
  Link as LinkIcon,
  Mail,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToastStore } from "@/store/toast-store";
import type {
  AdminAuthDiagnosticsCheck,
  AdminAuthDiagnosticsReport,
  AdminDiagnosticsStatus,
} from "@/types/admin-auth-diagnostics";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

function getStatusLabel(status: AdminDiagnosticsStatus) {
  if (status === "ok") return "Healthy";
  if (status === "degraded") return "Needs Attention";
  return "Critical";
}

function getStatusClassName(status: AdminDiagnosticsStatus) {
  if (status === "ok") {
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "degraded") {
    return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  }
  return "bg-red-500/15 text-red-700 dark:text-red-300";
}

type CheckCardConfig = {
  key: keyof AdminAuthDiagnosticsReport["checks"];
  title: string;
  icon: ComponentType<{ className?: string }>;
};

const checkCards: CheckCardConfig[] = [
  { key: "appUrl", title: "App URL", icon: LinkIcon },
  { key: "jwt", title: "JWT Secret", icon: KeyRound },
  { key: "database", title: "Database", icon: Database },
  { key: "schema", title: "Auth Schema", icon: ShieldCheck },
  { key: "authRead", title: "Auth Read Query", icon: ShieldCheck },
  { key: "supabase", title: "Supabase", icon: Globe },
  { key: "smtp", title: "Email / SMTP", icon: Mail },
];

export function AuthDiagnosticsManager() {
  const pushToast = useToastStore((state) => state.pushToast);
  const [data, setData] = useState<AdminAuthDiagnosticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDiagnostics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/auth-diagnostics", {
        cache: "no-store",
      });
      const payload = (await response.json()) as AdminAuthDiagnosticsReport | ApiEnvelope<never>;

      if ("checks" in payload && payload.checks && "status" in payload) {
        setData(payload as AdminAuthDiagnosticsReport);
        return;
      }

      const fallbackMessage = "error" in payload ? payload.error : "Unable to load diagnostics";
      throw new Error(fallbackMessage ?? "Unable to load diagnostics");
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load diagnostics";
      setError(message);
      pushToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadDiagnostics();
  }, [loadDiagnostics]);

  const checks = useMemo(() => data?.checks ?? null, [data?.checks]);
  const missingEnvKeys = useMemo(() => {
    if (!checks) return [];
    const allKeys = Object.values(checks).flatMap((check) => check.missingKeys ?? []);
    return Array.from(new Set(allKeys));
  }, [checks]);

  const missingEnvSnippet = useMemo(() => {
    if (missingEnvKeys.length === 0) return "";

    const lines: string[] = [];
    for (const key of missingEnvKeys) {
      if (key.includes(" or ")) {
        const parts = key.split(" or ").map((part) => part.trim());
        for (const part of parts) {
          lines.push(`${part}=`);
        }
      } else {
        lines.push(`${key}=`);
      }
    }

    return Array.from(new Set(lines)).join("\n");
  }, [missingEnvKeys]);

  const copyToClipboard = useCallback(
    async (value: string, successMessage: string) => {
      if (!value.trim()) {
        pushToast("Nothing to copy.", "error");
        return;
      }

      if (!navigator.clipboard) {
        pushToast("Clipboard is not available in this browser.", "error");
        return;
      }

      try {
        await navigator.clipboard.writeText(value);
        pushToast(successMessage, "success");
      } catch {
        pushToast("Unable to copy to clipboard.", "error");
      }
    },
    [pushToast],
  );

  if (loading && !data) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Loading auth diagnostics...</p>
      </section>
    );
  }

  if (!data || !checks) {
    return (
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-red-600 dark:text-red-300">
          {error ?? "Unable to load auth diagnostics."}
        </p>
        <Button variant="outline" onClick={() => void loadDiagnostics()}>
          Retry
        </Button>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Production Auth Readiness</p>
          <p className="text-xs text-muted-foreground">
            Diagnose why login/register/verification fail on deployment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClassName(
              data.status,
            )}`}
          >
            {getStatusLabel(data.status)}
          </span>
          <Button variant="outline" onClick={() => void loadDiagnostics()} disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <section className="grid gap-2 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground sm:grid-cols-3">
        <p>
          Environment: <span className="font-semibold text-foreground">{data.environment}</span>
        </p>
        <p>
          Checked at:{" "}
          <span className="font-semibold text-foreground">
            {new Date(data.generatedAt).toLocaleString()}
          </span>
        </p>
        <p>
          Response time:{" "}
          <span className="font-semibold text-foreground">{data.responseTimeMs} ms</span>
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {checkCards.map((entry) => {
          const check = checks[entry.key] as AdminAuthDiagnosticsCheck;
          const Icon = entry.icon;
          return (
            <article key={entry.key} className="space-y-2 rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{entry.title}</p>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${getStatusClassName(
                  check.status,
                )}`}
              >
                {getStatusLabel(check.status)}
              </span>
              <p className="text-xs text-muted-foreground">{check.detail}</p>
              {check.value ? (
                <p className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground">
                  {check.value}
                </p>
              ) : null}
              {typeof check.latencyMs === "number" ? (
                <p className="text-[11px] text-muted-foreground">Latency: {check.latencyMs} ms</p>
              ) : null}
              {check.missingKeys && check.missingKeys.length > 0 ? (
                <p className="text-xs text-red-600 dark:text-red-300">
                  Missing: {check.missingKeys.join(", ")}
                </p>
              ) : null}
            </article>
          );
        })}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold">Vercel Env Quick Fix</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={missingEnvKeys.length === 0}
              onClick={() =>
                void copyToClipboard(missingEnvKeys.join("\n"), "Missing env key names copied")
              }
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy Key Names
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={missingEnvKeys.length === 0}
              onClick={() =>
                void copyToClipboard(missingEnvSnippet, ".env template copied")
              }
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy .env Template
            </Button>
          </div>
        </div>
        {missingEnvKeys.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No missing environment keys detected.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              Paste these keys into Vercel Project Settings {'->'} Environment Variables.
            </p>
            <pre className="overflow-x-auto rounded-xl border border-border bg-background p-3 text-[11px] text-foreground">
              {missingEnvSnippet}
            </pre>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h2 className="text-sm font-semibold">Recommended Fixes</h2>
        </div>
        {data.recommendations.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No action required. Auth deployment checks are all healthy.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {data.recommendations.map((item) => (
              <p
                key={item}
                className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300"
              >
                {item}
              </p>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
