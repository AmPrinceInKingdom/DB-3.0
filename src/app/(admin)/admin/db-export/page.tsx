import { DatabaseExportManager } from "@/components/admin/database-export-manager";

export default function AdminDbExportPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Database Export Panel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate JSON or CSV exports for backups, audits, and operations reporting.
        </p>
      </header>
      <DatabaseExportManager />
    </div>
  );
}

