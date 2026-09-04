import { Target } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  goalCompletionPercent,
  goalProgressPercent,
} from "@/lib/calculations/study";
import { formatDuration } from "@/lib/date";
import { cn } from "@/lib/utils";

/**
 * The weekly goal meter.
 *
 * The bar is capped at 100% so it never overflows, but the copy underneath uses
 * the true completion — a student who has done 133% of their goal should be told
 * so, not shown a full bar and left guessing.
 */
export function StudyGoalMeter({
  minutes,
  goalMinutes,
  showLink = true,
  className,
}: {
  minutes: number;
  goalMinutes: number;
  showLink?: boolean;
  className?: string;
}) {
  const progress = goalProgressPercent(minutes, goalMinutes);
  const completion = goalCompletionPercent(minutes, goalMinutes);
  const met = goalMinutes > 0 && minutes >= goalMinutes;
  const remaining = Math.max(0, goalMinutes - minutes);

  return (
    <Card className={cn("gap-0 p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="stat-label">Study progress</p>
          <p className="tabular mt-1.5 text-2xl font-semibold">
            {formatDuration(minutes)}
            {goalMinutes > 0 ? (
              <span className="text-muted-foreground text-base font-normal">
                {" / "}
                {formatDuration(goalMinutes)}
              </span>
            ) : null}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">This week</p>
        </div>

        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg",
            met ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
          )}
        >
          <Target className="size-4" aria-hidden />
        </span>
      </div>

      {goalMinutes > 0 ? (
        <>
          <div
            className="bg-muted mt-4 h-2.5 overflow-hidden rounded-full"
            role="img"
            aria-label={`${Math.round(completion)} percent of the weekly study goal`}
          >
            <div
              className={cn(
                "h-full rounded-full",
                met ? "bg-success" : "bg-primary",
              )}
              style={{ width: `${progress}%` }}
            />
          </div>

          <p
            className={cn(
              "mt-2 text-xs",
              met ? "text-success" : "text-muted-foreground",
            )}
          >
            {met
              ? `Goal met — ${Math.round(completion)}% of your target.`
              : `${Math.round(completion)}% complete · ${formatDuration(remaining)} to go.`}
          </p>
        </>
      ) : (
        <p className="text-muted-foreground mt-4 text-xs">
          No weekly goal set.
        </p>
      )}

      {showLink ? (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-muted-foreground mt-3 -ml-2 self-start"
        >
          <Link href="/settings#academic">
            {goalMinutes > 0 ? "Change goal" : "Set a goal"}
          </Link>
        </Button>
      ) : null}
    </Card>
  );
}
