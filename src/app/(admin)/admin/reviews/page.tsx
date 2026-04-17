import { ReviewsManager } from "@/components/admin/reviews-manager";

export default function AdminReviewsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Reviews Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Moderate product reviews and keep marketplace feedback trustworthy.
        </p>
      </header>
      <ReviewsManager />
    </div>
  );
}
