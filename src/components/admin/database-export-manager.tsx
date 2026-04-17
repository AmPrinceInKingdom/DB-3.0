"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, Download, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToastStore } from "@/store/toast-store";
import type {
  AdminDbExportFormat,
  AdminDbExportPanelPayload,
  AdminDbExportScope,
} from "@/types/admin-db-export";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

function extractFilename(contentDisposition: string | null, fallback: string) {
  if (!contentDisposition) return fallback;
  const match = contentDisposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  if (!match?.[1]) return fallback;
  return decodeURIComponent(match[1].replace(/"/g, ""));
}

export function DatabaseExportManager() {
  const pushToast = useToastStore((state) => state.pushToast);
  const [panel, setPanel] = useState<AdminDbExportPanelPayload | null>(null);
  const [scope, setScope] = useState<AdminDbExportScope>("all");
  const [format, setFormat] = useState<AdminDbExportFormat>("json");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPanel = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/db-export", { cache: "no-store" });
      const payload = (await response.json()) as ApiEnvelope<AdminDbExportPanelPayload>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to load export panel");
      }

      setPanel(payload.data);
      setScope(payload.data.defaultScope);
      setFormat(payload.data.defaultFormat);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Unable to load export panel";
      setError(message);
      pushToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadPanel();
  }, [loadPanel]);

  const activeScope = useMemo(
    () => panel?.scopes.find((item) => item.value === scope) ?? null,
    [panel?.scopes, scope],
  );

  const startExport = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      const url = `/api/admin/db-export?download=1&scope=${encodeURIComponent(scope)}&format=${encodeURIComponent(format)}`;
      const response = await fetch(url, { cache: "no-store" });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null;
        throw new Error(payload?.error ?? "Unable to generate database export");
      }

      const blob = await response.blob();
      const fallbackName = `deal-bazaar-db-export-${scope}.${format}`;
      const filename = extractFilename(response.headers.get("content-disposition"), fallbackName);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);

      pushToast("Database export generated", "success");
    } catch (downloadError) {
      const message =
        downloadError instanceof Error
          ? downloadError.message
          : "Unable to generate database export";
      setError(message);
      pushToast(message, "error");
    } finally {
      setExporting(false);
    }
  }, [format, pushToast, scope]);

  if (loading && !panel) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Loading DB export panel...</p>
      </section>
    );
  }

  if (!panel) {
    return (
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-red-600 dark:text-red-300">
          {error ?? "Unable to load DB export panel."}
        </p>
        <Button variant="outline" onClick={() => void loadPanel()}>
          Retry
        </Button>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Database Export Center</p>
          <p className="text-xs text-muted-foreground">
            Generate backup exports for catalog, customers, orders, sellers, logs, or full database.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void loadPanel()} disabled={loading || exporting}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => void startExport()} disabled={loading || exporting}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Exporting..." : "Generate Export"}
          </Button>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <article className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <header>
            <h2 className="text-base font-semibold">Export Selection</h2>
            <p className="text-xs text-muted-foreground">
              Choose which module data you need and the export format.
            </p>
          </header>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Export Scope</label>
              <Select
                value={scope}
                onChange={(event) => setScope(event.target.value as AdminDbExportScope)}
              >
                {panel.scopes.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Export Format</label>
              <Select
                value={format}
                onChange={(event) => setFormat(event.target.value as AdminDbExportFormat)}
              >
                {panel.formats.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {activeScope ? (
            <div className="rounded-xl border border-border bg-background p-3">
              <p className="text-sm font-medium">{activeScope.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{activeScope.description}</p>
            </div>
          ) : null}
        </article>

        <aside className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <header className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <h3 className="text-sm font-semibold">Included Tables</h3>
          </header>

          {activeScope?.tables.length ? (
            <div className="grid max-h-64 gap-1 overflow-y-auto rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground">
              {activeScope.tables.map((tableName) => (
                <p key={tableName} className="font-mono text-foreground">
                  {tableName}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No table mapping available.</p>
          )}

          <p className="text-[11px] text-muted-foreground">
            Last panel refresh: {new Date(panel.generatedAt).toLocaleString()}
          </p>
        </aside>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
        <p>JSON gives a full structured backup for restore workflows.</p>
        <p>CSV gives concise summary rows for spreadsheet auditing.</p>
        <p>Exports are generated live from current database data.</p>
      </section>
    </div>
  );
}

