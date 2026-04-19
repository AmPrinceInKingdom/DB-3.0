export type AdminDiagnosticsStatus = "ok" | "degraded" | "down";

export type AdminAuthDiagnosticsCheck = {
  status: AdminDiagnosticsStatus;
  detail: string;
  configured?: boolean;
  latencyMs?: number;
  missingKeys?: string[];
  value?: string;
};

export type AdminAuthDiagnosticsReport = {
  success: boolean;
  requestId?: string;
  status: AdminDiagnosticsStatus;
  generatedAt: string;
  environment: string;
  responseTimeMs: number;
  checks: {
    appUrl: AdminAuthDiagnosticsCheck;
    jwt: AdminAuthDiagnosticsCheck;
    database: AdminAuthDiagnosticsCheck;
    schema: AdminAuthDiagnosticsCheck;
    authRead: AdminAuthDiagnosticsCheck;
    supabase: AdminAuthDiagnosticsCheck;
    smtp: AdminAuthDiagnosticsCheck;
  };
  recommendations: string[];
};
