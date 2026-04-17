import { SettingsManager } from "@/components/admin/settings-manager";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Admin Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Control site-wide configuration for branding, checkout, payments, localization, and homepage
          sections.
        </p>
      </header>
      <SettingsManager />
    </div>
  );
}
