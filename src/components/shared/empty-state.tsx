import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The empty state every list falls back to. It always says what the section is
 * for and offers the action that fills it — an empty table with no explanation
 * is a dead end.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed text-center",
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14",
        className,
      )}
    >
      <span
        className={cn(
          "bg-muted text-muted-foreground grid place-items-center rounded-full",
          compact ? "size-9" : "size-12",
        )}
      >
        <Icon className={compact ? "size-4.5" : "size-6"} aria-hidden />
      </span>
      <div className="space-y-1">
        <p className={cn("font-medium", compact ? "text-sm" : "text-base")}>
          {title}
        </p>
        <p className="text-muted-foreground mx-auto max-w-sm text-sm">
          {description}
        </p>
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
