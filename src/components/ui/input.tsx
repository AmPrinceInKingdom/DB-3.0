import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "focus-ring h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-card-foreground placeholder:text-muted-foreground",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
