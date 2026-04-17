import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: Props) {
  return (
    <div
      className={cn("rounded-2xl border border-border bg-card text-card-foreground", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: Props) {
  return <div className={cn("space-y-1.5 p-5", className)} {...props} />;
}

export function CardContent({ className, ...props }: Props) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: Props) {
  return <div className={cn("flex items-center p-5 pt-0", className)} {...props} />;
}
