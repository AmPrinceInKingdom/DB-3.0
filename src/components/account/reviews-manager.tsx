"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Pencil, RefreshCcw, Save, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { useToastStore } from "@/store/toast-store";
import type { AccountReviewItem, AccountReviewsPayload, ReviewableOrderItem } from "@/types/account-review";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type DraftState = {
  rating: number;
  title: string;
  comment: string;
};

const initialDraft: DraftState = {
  rating: 5,
  title: "",
  comment: "",
};

function buildDraftFromReview(review: AccountReviewItem): DraftState {
  return {
    rating: review.rating,
    title: review.title ?? "",
    comment: review.comment ?? "",
  };
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={`star-${rating}-${index + 1}`}
          className={`h-4 w-4 ${index < rating ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`}
        />
      ))}
    </span>
  );
}

export function ReviewsManager() {
  const pushToast = useToastStore((state) => state.pushToast);
  const [payload, setPayload] = useState<AccountReviewsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftsByOrderItem, setDraftsByOrderItem] = useState<Record<string, DraftState>>({});
  const [submittingOrderItemId, setSubmittingOrderItemId] = useState<string | null>(null);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftState>(initialDraft);
  const [savingReviewId, setSavingReviewId] = useState<string | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);

  const reviewableItems = payload?.reviewableItems ?? [];
  const reviews = payload?.reviews ?? [];

  const editingReview = reviews.find((review) => review.id === editingReviewId) ?? null;

  const loadPayload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/account/reviews", { cache: "no-store" });
      const result = (await response.json()) as ApiEnvelope<AccountReviewsPayload>;

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error ?? "Unable to fetch reviews");
      }

      setPayload(result.data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to fetch reviews";
      setError(message);
      pushToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadPayload();
  }, [loadPayload]);

  function getDraftForItem(item: ReviewableOrderItem): DraftState {
    return draftsByOrderItem[item.orderItemId] ?? initialDraft;
  }

  function setDraftField(orderItemId: string, key: keyof DraftState, value: string | number) {
    setDraftsByOrderItem((current) => ({
      ...current,
      [orderItemId]: {
        ...(current[orderItemId] ?? initialDraft),
        [key]: value,
      } as DraftState,
    }));
  }

  async function submitReview(orderItemId: string) {
    const draft = draftsByOrderItem[orderItemId] ?? initialDraft;
    setSubmittingOrderItemId(orderItemId);
    setError(null);

    try {
      const response = await fetch("/api/account/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderItemId,
          rating: draft.rating,
          title: draft.title,
          comment: draft.comment,
        }),
      });
      const result = (await response.json()) as ApiEnvelope<AccountReviewItem>;

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Unable to submit review");
      }

      setDraftsByOrderItem((current) => {
        const next = { ...current };
        delete next[orderItemId];
        return next;
      });
      await loadPayload();
      pushToast("Review submitted for moderation", "success");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to submit review";
      setError(message);
      pushToast(message, "error");
    } finally {
      setSubmittingOrderItemId(null);
    }
  }

  function startEdit(review: AccountReviewItem) {
    setEditingReviewId(review.id);
    setEditDraft(buildDraftFromReview(review));
  }

  function cancelEdit() {
    setEditingReviewId(null);
    setEditDraft(initialDraft);
  }

  async function saveEdit(reviewId: string) {
    setSavingReviewId(reviewId);
    setError(null);

    try {
      const response = await fetch(`/api/account/reviews/${encodeURIComponent(reviewId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: editDraft.rating,
          title: editDraft.title,
          comment: editDraft.comment,
        }),
      });
      const result = (await response.json()) as ApiEnvelope<AccountReviewItem>;

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Unable to update review");
      }

      await loadPayload();
      cancelEdit();
      pushToast("Review updated and resubmitted", "success");
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Unable to update review";
      setError(message);
      pushToast(message, "error");
    } finally {
      setSavingReviewId(null);
    }
  }

  async function deleteReview(reviewId: string) {
    const confirmed = window.confirm("Delete this review?");
    if (!confirmed) return;

    setDeletingReviewId(reviewId);
    setError(null);
    try {
      const response = await fetch(`/api/account/reviews/${encodeURIComponent(reviewId)}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as ApiEnvelope<{ id: string }>;

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Unable to delete review");
      }

      await loadPayload();
      if (editingReviewId === reviewId) {
        cancelEdit();
      }
      pushToast("Review deleted", "info");
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Unable to delete review";
      setError(message);
      pushToast(message, "error");
    } finally {
      setDeletingReviewId(null);
    }
  }

  if (loading && !payload) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Loading reviews...</p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div>
          <h1 className="text-2xl font-bold">My Reviews</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Write reviews for delivered items and manage your existing feedback.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadPayload()} disabled={loading}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">Write New Review</h2>
        {reviewableItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No delivered items pending review right now.
          </p>
        ) : (
          <div className="space-y-3">
            {reviewableItems.map((item) => {
              const draft = getDraftForItem(item);
              const isSubmitting = submittingOrderItemId === item.orderItemId;
              return (
                <article
                  key={item.orderItemId}
                  className="space-y-3 rounded-xl border border-border bg-background p-3"
                >
                  <div className="flex items-start gap-3">
                    <Link
                      href={`/product/${item.product.slug}`}
                      className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted"
                    >
                      {item.product.imageUrl ? (
                        <Image
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      ) : null}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={`/product/${item.product.slug}`} className="line-clamp-2 text-sm font-semibold">
                        {item.product.name}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Order: {item.orderNumber} · Qty: {item.quantity}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">Rating</span>
                      <Select
                        value={String(draft.rating)}
                        onChange={(event) =>
                          setDraftField(item.orderItemId, "rating", Number(event.target.value))
                        }
                      >
                        {[5, 4, 3, 2, 1].map((rating) => (
                          <option key={`${item.orderItemId}-${rating}`} value={rating}>
                            {rating} star{rating > 1 ? "s" : ""}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <label className="space-y-1 sm:col-span-2">
                      <span className="text-xs font-medium text-muted-foreground">Title</span>
                      <Input
                        value={draft.title}
                        onChange={(event) =>
                          setDraftField(item.orderItemId, "title", event.target.value)
                        }
                        placeholder="Short headline"
                      />
                    </label>
                    <label className="space-y-1 sm:col-span-3">
                      <span className="text-xs font-medium text-muted-foreground">Comment</span>
                      <textarea
                        rows={3}
                        value={draft.comment}
                        onChange={(event) =>
                          setDraftField(item.orderItemId, "comment", event.target.value)
                        }
                        className="focus-ring w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-card-foreground"
                        placeholder="Share your experience"
                      />
                    </label>
                  </div>

                  <Button type="button" onClick={() => void submitReview(item.orderItemId)} disabled={isSubmitting}>
                    {isSubmitting ? "Submitting..." : "Submit Review"}
                  </Button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">My Submitted Reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">You have not submitted any reviews yet.</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => {
              const isEditing = editingReview?.id === review.id;
              const isSaving = savingReviewId === review.id;
              const isDeleting = deletingReviewId === review.id;

              return (
                <article key={review.id} className="space-y-3 rounded-xl border border-border bg-background p-3">
                  <div className="flex items-start gap-3">
                    <Link
                      href={`/product/${review.product.slug}`}
                      className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted"
                    >
                      {review.product.imageUrl ? (
                        <Image
                          src={review.product.imageUrl}
                          alt={review.product.name}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      ) : null}
                    </Link>
                    <div className="min-w-0 flex-1 space-y-1">
                      <Link href={`/product/${review.product.slug}`} className="line-clamp-2 text-sm font-semibold">
                        {review.product.name}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2">
                        <Stars rating={review.rating} />
                        <StatusPill value={review.status} />
                        {review.isVerifiedPurchase ? (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                            Verified purchase
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Submitted: {new Date(review.createdAt).toLocaleDateString()}
                        {review.orderItem ? ` · Order: ${review.orderItem.orderNumber}` : ""}
                      </p>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">Rating</span>
                        <Select
                          value={String(editDraft.rating)}
                          onChange={(event) =>
                            setEditDraft((current) => ({
                              ...current,
                              rating: Number(event.target.value),
                            }))
                          }
                        >
                          {[5, 4, 3, 2, 1].map((rating) => (
                            <option key={`${review.id}-edit-${rating}`} value={rating}>
                              {rating} star{rating > 1 ? "s" : ""}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <label className="space-y-1 sm:col-span-2">
                        <span className="text-xs font-medium text-muted-foreground">Title</span>
                        <Input
                          value={editDraft.title}
                          onChange={(event) =>
                            setEditDraft((current) => ({ ...current, title: event.target.value }))
                          }
                        />
                      </label>
                      <label className="space-y-1 sm:col-span-3">
                        <span className="text-xs font-medium text-muted-foreground">Comment</span>
                        <textarea
                          rows={3}
                          value={editDraft.comment}
                          onChange={(event) =>
                            setEditDraft((current) => ({ ...current, comment: event.target.value }))
                          }
                          className="focus-ring w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-card-foreground"
                        />
                      </label>
                      <div className="flex items-center gap-2 sm:col-span-3">
                        <Button
                          type="button"
                          onClick={() => void saveEdit(review.id)}
                          disabled={isSaving}
                        >
                          <Save className="mr-2 h-4 w-4" />
                          {isSaving ? "Saving..." : "Save Review"}
                        </Button>
                        <Button type="button" variant="outline" onClick={cancelEdit} disabled={isSaving}>
                          <X className="mr-2 h-4 w-4" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {review.title ? <p className="text-sm font-semibold">{review.title}</p> : null}
                      <p className="text-sm text-muted-foreground">
                        {review.comment || "No comment added."}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => startEdit(review)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void deleteReview(review.id)}
                          disabled={isDeleting}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {isDeleting ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
