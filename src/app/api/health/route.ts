import { NextResponse } from "next/server";
import { resolveRequestId } from "@/lib/observability/request-context";
import { getRuntimeHealthReport, toHealthStatusCode } from "@/lib/services/runtime-health-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = resolveRequestId(request);
  const report = await getRuntimeHealthReport({ requestId });

  return NextResponse.json(
    {
      success: report.success,
      requestId: report.requestId,
      status: report.status,
      timestamp: report.timestamp,
      environment: report.environment,
      responseTimeMs: report.responseTimeMs,
      dashboardUrl: "/health",
    },
    {
      status: toHealthStatusCode(report.status),
      headers: {
        "x-request-id": requestId,
      },
    },
  );
}
