import * as React from "react";

import { cn } from "@/lib/utils";

type CountBadgeVariant = "primary" | "destructive";

interface CountBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  count: number;
  variant?: CountBadgeVariant;
}

/**
 * Small counter pill used inside tight UI (e.g. chat filter tabs).
 * Uses ONLY semantic tokens for colors.
 */
export function CountBadge({ count, variant = "primary", className, ...props }: CountBadgeProps) {
  if (!count || count <= 0) return null;

  return (
    <span
      className={cn(
        "ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none",
        variant === "primary" && "bg-primary text-primary-foreground",
        variant === "destructive" && "bg-destructive text-destructive-foreground",
        "shadow-sm",
        className,
      )}
      {...props}
    >
      {count}
    </span>
  );
}
