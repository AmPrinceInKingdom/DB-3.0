"use client";

import { useEffect } from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToastStore, type ToastItem } from "@/store/toast-store";

type ToastCardProps = {
  toast: ToastItem;
};

function ToastCard({ toast }: ToastCardProps) {
  const removeToast = useToastStore((state) => state.removeToast);

  useEffect(() => {
    const timer = window.setTimeout(() => removeToast(toast.id), 2600);
    return () => window.clearTimeout(timer);
  }, [removeToast, toast.id]);

  const icon =
    toast.tone === "success" ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
    ) : toast.tone === "error" ? (
      <TriangleAlert className="h-4 w-4 text-red-600" />
    ) : (
      <Info className="h-4 w-4 text-blue-600" />
    );

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-xl border bg-card px-3 py-2 shadow-sm",
        toast.tone === "success" && "border-emerald-200 dark:border-emerald-900/40",
        toast.tone === "error" && "border-red-200 dark:border-red-900/40",
        toast.tone === "info" && "border-blue-200 dark:border-blue-900/40",
      )}
    >
      <span className="mt-0.5">{icon}</span>
      <p className="text-sm font-medium text-card-foreground">{toast.message}</p>
      <button
        type="button"
        className="ml-2 rounded p-0.5 text-muted-foreground transition hover:text-foreground"
        onClick={() => removeToast(toast.id)}
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
