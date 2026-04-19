import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { resolveRequestId } from "@/lib/observability/request-context";
import { getRuntimeHealthReport, toHealthStatusCode } from "@/lib/services/runtime-health-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  const requestId = resolveRequestId(request);
  const report = await getRuntimeHealthReport({ requestId });

  return NextResponse.json(report, {
    status: toHealthStatusCode(report.status),
    headers: {
      "x-request-id": requestId,
    },
  });
}

