import type { OrderStatus, PaymentStatus, ShipmentStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

type StatusValue = OrderStatus | PaymentStatus | ShipmentStatus | string;

type Props = {
  value: StatusValue;
  className?: string;
};

function normalize(value: string) {
  return value.toUpperCase();
}

function toLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function StatusPill({ value, className }: Props) {
  const key = normalize(value);

  const toneClass =
    key === "PAID" ||
    key === "DELIVERED" ||
    key === "CONFIRMED" ||
    key === "ACTIVE" ||
    key === "APPROVED" ||
    key === "IN_STOCK"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : key === "PENDING" ||
          key === "AWAITING_VERIFICATION" ||
          key === "PROCESSING" ||
          key === "PACKED" ||
          key === "LOW_STOCK"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
        : key === "FAILED" ||
            key === "CANCELLED" ||
            key === "REFUNDED" ||
            key === "RETURNED" ||
            key === "INACTIVE" ||
            key === "SUSPENDED" ||
            key === "DELETED" ||
            key === "REJECTED" ||
            key === "OUT_OF_STOCK"
          ? "bg-red-500/15 text-red-700 dark:text-red-400"
          : key === "SHIPPED" || key === "IN_TRANSIT" || key === "PREORDER"
            ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
            : "bg-muted text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        toneClass,
        className,
      )}
    >
      {toLabel(key)}
    </span>
  );
}
