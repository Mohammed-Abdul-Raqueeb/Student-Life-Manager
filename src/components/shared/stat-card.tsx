import type { LucideIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatTone = "neutral" | "success" | "warning" | "critical";

const TONE_RING: Record<StatTone, string> = {
  neutral: "text-muted-foreground bg-muted",
  success: "text-success bg-success/10",
  warning: "text-warning-foreground bg-warning/20 dark:text-warning",
  critical: "text-destructive bg-destructive/10",
};

/**
 * A single headline number. Deliberately plain: one label, one value, one
 * optional supporting line. The value uses tabular figures so a row of cards
 * lines up.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: StatTone;
  href?: Route;
}) {
  const body = (
    <Card
      className={cn(
        "h-full gap-0 p-4 sm:p-5",
        href && "hover:border-primary/40 transition-colors",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="stat-label">{label}</p>
        {Icon ? (
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-lg",
              TONE_RING[tone],
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
      </div>
      <p className="tabular mt-2 text-2xl font-semibold sm:text-3xl">{value}</p>
      {hint ? (
        <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
      ) : null}
    </Card>
  );

  if (!href) return body;

  return (
    <Link href={href} className="block rounded-xl focus-visible:outline-none">
      {body}
    </Link>
  );
}
