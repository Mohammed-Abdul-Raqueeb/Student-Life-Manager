import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Info,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";

import type { Insight, InsightTone } from "@/lib/calculations/insights";
import { cn } from "@/lib/utils";

const TONE = {
  critical: {
    icon: AlertTriangle,
    wrap: "border-destructive/30 bg-destructive/[0.06]",
    mark: "text-destructive",
  },
  warning: {
    icon: TriangleAlert,
    wrap: "border-warning/40 bg-warning/[0.09]",
    mark: "text-warning-foreground dark:text-warning",
  },
  success: {
    icon: CheckCircle2,
    wrap: "border-success/30 bg-success/[0.07]",
    mark: "text-success",
  },
  neutral: {
    icon: Info,
    wrap: "bg-muted/50",
    mark: "text-muted-foreground",
  },
} satisfies Record<InsightTone, { icon: typeof Info; wrap: string; mark: string }>;

/**
 * Today's focus.
 *
 * Every line is a deterministic read of the database — an attendance percentage
 * that is genuinely below target, an assignment that is genuinely due tomorrow.
 * Nothing here is generated prose, and each line links to the records behind it
 * so the claim can be checked.
 */
export function InsightList({ insights }: { insights: readonly Insight[] }) {
  return (
    <ul className="space-y-2">
      {insights.map((insight) => {
        const tone = TONE[insight.tone];
        const Icon = tone.icon;

        return (
          <li key={insight.id}>
            <Link
              href={insight.href}
              className={cn(
                "hover:border-primary/40 flex items-start gap-3 rounded-lg border px-3.5 py-3 text-sm transition-colors",
                tone.wrap,
              )}
            >
              <Icon className={cn("mt-0.5 size-4 shrink-0", tone.mark)} aria-hidden />
              <span className="min-w-0 flex-1">{insight.message}</span>
              <ChevronRight
                className="text-muted-foreground mt-0.5 size-4 shrink-0"
                aria-hidden
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
