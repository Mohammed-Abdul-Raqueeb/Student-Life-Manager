import { CalendarClock, ClipboardList, ListTodo } from "lucide-react";
import Link from "next/link";

import {
  CountdownBadge,
  PriorityBadge,
  SubjectChip,
} from "@/components/shared/badges";
import { Card } from "@/components/ui/card";
import type { DeadlineItem } from "@/lib/calculations/deadlines";
import { isOverdue } from "@/lib/calculations/deadlines";
import { countdownLabel, formatDateTime, relativeDayLabel } from "@/lib/date";
import { cn } from "@/lib/utils";

const KIND_ICON = {
  assignment: ClipboardList,
  exam: CalendarClock,
  task: ListTodo,
} as const;

const KIND_LABEL = {
  assignment: "Assignment",
  exam: "Exam",
  task: "Task",
} as const;

/**
 * The unified upcoming stream.
 *
 * Assignments, exams and tasks are three tables but one queue, so they are
 * merged rather than duplicated into a separate "deadlines" table. Overdue rows
 * sort to the top and are marked in words as well as colour.
 */
export function DeadlineList({
  items,
  now,
  showPriority = true,
}: {
  items: readonly DeadlineItem[];
  now: Date;
  showPriority?: boolean;
}) {
  return (
    <Card className="gap-0 p-0">
      <ul className="divide-y">
        {items.map((item) => {
          const Icon = KIND_ICON[item.kind];
          const overdue = isOverdue(item, now);
          const days = Math.ceil(
            (item.at.getTime() - now.getTime()) / 86_400_000,
          );

          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className={cn(
                  "hover:bg-muted/40 flex items-start gap-3 border-l-2 px-4 py-3.5 transition-colors sm:px-5",
                  overdue ? "border-l-destructive" : "border-l-transparent",
                )}
              >
                <Icon
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    overdue ? "text-destructive" : "text-muted-foreground",
                  )}
                  aria-hidden
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    <span className="text-muted-foreground text-xs">
                      {KIND_LABEL[item.kind]}
                    </span>
                  </div>

                  <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {item.subject ? (
                      <SubjectChip subject={item.subject} showName />
                    ) : null}
                    <span
                      className={cn(
                        "tabular",
                        overdue && "text-destructive font-medium",
                      )}
                    >
                      {overdue
                        ? `Overdue · ${relativeDayLabel(item.at, now)}`
                        : formatDateTime(item.at)}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {overdue ? (
                    <span className="bg-destructive text-destructive-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                      Overdue
                    </span>
                  ) : (
                    <CountdownBadge
                      label={countdownLabel(item.at, now)}
                      urgent={days <= 2}
                    />
                  )}
                  {showPriority && item.priority ? (
                    <PriorityBadge priority={item.priority} />
                  ) : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
