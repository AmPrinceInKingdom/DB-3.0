import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { siteConfig } from "@/lib/constants/site";
import {
  getRuntimeHealthReport,
  type HealthCheckStatus,
  type RuntimeHealthCheck,
} from "@/lib/services/runtime-health-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "System Health",
  description: "Live runtime status for Deal Bazaar services and integrations.",
  alternates: {
    canonical: "/health",
  },
  openGraph: {
    title: `${siteConfig.name} - System Health`,
    description: "Monitor Deal Bazaar runtime service health in real time.",
    url: "/health",
    siteName: siteConfig.name,
    type: "website",
  },
};

const toneMap: Record<
  HealthCheckStatus,
  {
    badge: string;
    label: string;
    accent: string;
    panel: string;
  }
> = {
  ok: {
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    label: "Operational",
    accent: "bg-emerald-500",
    panel: "border-emerald-500/40",
  },
  degraded: {
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    label: "Degraded",
    accent: "bg-amber-500",
    panel: "border-amber-500/40",
  },
  down: {
    badge: "bg-red-500/15 text-red-700 dark:text-red-300",
    label: "Down",
    accent: "bg-red-500",
    panel: "border-red-500/40",
  },
};

const checkMeta: Array<{
  key: "env" | "database" | "supabase" | "smtp";
  title: string;
  subtitle: string;
}> = [
  {
    key: "env",
    title: "Core Environment",
    subtitle: "Critical runtime variables",
  },
  {
    key: "database",
    title: "Database",
    subtitle: "PostgreSQL / Prisma connectivity",
  },
  {
    key: "supabase",
    title: "Supabase",
    subtitle: "Storage and API credentials",
  },
  {
    key: "smtp",
    title: "Email SMTP",
    subtitle: "OTP and email delivery",
  },
];

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-LK", {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

function renderCheck(check: RuntimeHealthCheck, title: string, subtitle: string) {
  const tone = toneMap[check.status];

  return (
    <Card key={title} className={`border ${tone.panel}`}>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <Badge className={tone.badge}>{tone.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{check.detail}</p>

        <div className="flex flex-wrap gap-2 text-xs">
          {typeof check.configured === "boolean" ? (
            <span className="rounded-full border border-border bg-background px-2.5 py-1">
              Configured: {check.configured ? "Yes" : "No"}
            </span>
          ) : null}
          {typeof check.latencyMs === "number" ? (
            <span className="rounded-full border border-border bg-background px-2.5 py-1">
              Latency: {check.latencyMs} ms
            </span>
          ) : null}
        </div>

        {check.missingKeys && check.missingKeys.length > 0 ? (
          <div className="rounded-xl border border-border bg-background p-3">
            <p className="text-xs font-semibold text-muted-foreground">Missing Keys</p>
            <ul className="mt-2 space-y-1 text-sm">
              {check.missingKeys.map((key) => (
                <li key={key} className="font-mono text-xs">
                  {key}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default async function HealthPage() {
  const report = await getRuntimeHealthReport();
  const overallTone = toneMap[report.status];

  return (
    <section className="space-y-6">
      <Card className={`border ${overallTone.panel}`}>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                System Monitor
              </p>
              <h1 className="text-2xl font-bold">Deal Bazaar Health Dashboard</h1>
            </div>
            <Badge className={overallTone.badge}>{overallTone.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Quick visual status for runtime dependencies. For JSON output use{" "}
            <Link href="/api/health" className="font-semibold text-primary hover:underline">
              /api/health
            </Link>
            .
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Overall Status</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
                <span className={`h-2.5 w-2.5 rounded-full ${overallTone.accent}`} />
                {overallTone.label}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Environment</p>
              <p className="mt-1 text-sm font-semibold">{report.environment}</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Response Time</p>
              <p className="mt-1 text-sm font-semibold">{report.responseTimeMs} ms</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Last Checked</p>
              <p className="mt-1 text-sm font-semibold">{formatTimestamp(report.timestamp)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {checkMeta.map((meta) =>
          renderCheck(report.checks[meta.key], meta.title, meta.subtitle),
        )}
      </div>
    </section>
  );
}
