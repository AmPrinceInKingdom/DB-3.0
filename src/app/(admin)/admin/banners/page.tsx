import { BannerManager } from "@/components/admin/banner-manager";

export default function AdminBannersPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Banner Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add and control homepage hero sliders and promotional banners.
        </p>
      </header>
      <BannerManager />
    </div>
  );
}

