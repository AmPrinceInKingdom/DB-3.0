"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { ReviewStatus } from "@prisma/client";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import type { AdminReviewItem } from "@/types/review";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

const reviewStatuses: ReviewStatus[] = ["PENDING", "APPROVED", "REJECTED"];

function renderRatingStars(rating: number) {
  return "★".repeat(rating).padEnd(5, "☆");
}

export function ReviewsManager() {
  const [reviews, setReviews] = useState<AdminReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "">("");
  const [busyReviewId, setBusyReviewId] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (statusFilter) params.set("status", statusFilter);
    return params.toString();
  }, [query, statusFilter]);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/reviews${queryParams ? `?${queryParams}` : ""}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiEnvelope<AdminReviewItem[]>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to load reviews");
      }
      setReviews(payload.data ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load reviews");
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const updateStatus = async (reviewId: string, status: ReviewStatus) => {
    setBusyReviewId(reviewId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to update review status");
      }
      await loadReviews();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update review");
    } finally {
      setBusyReviewId(null);
    }
  };

  const deleteReview = async (review: AdminReviewItem) => {
    const confirmed = window.confirm(
      `Delete this review for ${review.product.name}? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setBusyReviewId(review.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/reviews/${review.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to delete review");
      }
      await loadReviews();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete review");
    } finally {
      setBusyReviewId(null);
    }
  };

  return (
    <div className="space-y-4">
      <section className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Search product, email, or comment"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as ReviewStatus | "")}
        >
          <option value="">All Review Statuses</option>
          {reviewStatuses.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
        <Button variant="outline" onClick={() => void loadReviews()}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Loading reviews...</p>
        </section>
      ) : reviews.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">No reviews found.</p>
        </section>
      ) : (
        <section className="space-y-3">
          {reviews.map((review) => (
            <article key={review.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{review.product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    By {review.user?.email ?? "Guest"} - {new Date(review.createdAt).toLocaleString()}
                  </p>
                </div>
                <StatusPill value={review.status} />
              </div>

              <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <p className="text-muted-foreground">
                  Rating:{" "}
                  <span className="font-semibold text-foreground">{renderRatingStars(review.rating)}</span>
                </p>
                <p className="text-muted-foreground">
                  Verified Purchase:{" "}
                  <span className="font-semibold text-foreground">
                    {review.isVerifiedPurchase ? "Yes" : "No"}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Helpful Votes:{" "}
                  <span className="font-semibold text-foreground">{review.helpfulCount}</span>
                </p>
                <p className="text-muted-foreground">
                  Order Ref:{" "}
                  <span className="font-semibold text-foreground">
                    {review.orderItem?.order.orderNumber ?? "-"}
                  </span>
                </p>
              </div>

              {review.title ? <p className="text-sm font-semibold">{review.title}</p> : null}
              {review.comment ? <p className="text-sm text-muted-foreground">{review.comment}</p> : null}

              {review.images.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {review.images.slice(0, 5).map((image) => (
                    <div key={image.id} className="overflow-hidden rounded-lg border border-border bg-background">
                      <Image
                        src={image.imageUrl}
                        alt="Review attachment"
                        width={160}
                        height={80}
                        unoptimized
                        className="h-20 w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  type="button"
                  disabled={busyReviewId === review.id}
                  onClick={() => void updateStatus(review.id, "APPROVED")}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  disabled={busyReviewId === review.id}
                  onClick={() => void updateStatus(review.id, "PENDING")}
                >
                  Mark Pending
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant="danger"
                  disabled={busyReviewId === review.id}
                  onClick={() => void updateStatus(review.id, "REJECTED")}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  disabled={busyReviewId === review.id}
                  onClick={() => void deleteReview(review)}
                >
                  Delete
                </Button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
