import { MapPin, Trash2, User } from "lucide-react";

import { deleteTimetableEntry } from "@/actions/timetable";
import { TIMETABLE_TYPE_LABELS } from "@/components/shared/badges";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { TimetableFormDialog } from "@/components/timetable/timetable-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Weekday } from "@/generated/prisma/enums";
import { formatClockTime } from "@/lib/date";
import {
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  type SubjectRef,
  type TimetableRow,
} from "@/lib/db/queries";
import { subjectColor } from "@/lib/subject-colors";
import { cn } from "@/lib/utils";

/**
 * The weekly timetable.
 *
 * Seven columns from `lg` up; below that the same data stacks into a day-per-
 * card list. A real time-proportional grid was tempting, but a student's week
 * has gaps and overlaps that make fixed rows misleading — a chronological list
 * per day is honest and readable at every width.
 */
export function TimetableGrid({
  grouped,
  subjects,
  todayWeekday,
}: {
  grouped: Record<Weekday, TimetableRow[]>;
  subjects: readonly SubjectRef[];
  todayWeekday: Weekday;
}) {
  return (
    <>
      {/* Desktop: seven columns */}
      <div className="scroll-x hidden lg:block">
        <div className="grid min-w-[56rem] grid-cols-7 gap-3">
          {WEEKDAY_ORDER.map((day) => (
            <DayColumn
              key={day}
              day={day}
              entries={grouped[day]}
              subjects={subjects}
              isToday={day === todayWeekday}
            />
          ))}
        </div>
      </div>

      {/* Mobile and tablet: a card per day */}
      <div className="space-y-4 lg:hidden">
        {WEEKDAY_ORDER.map((day) => (
          <DayCard
            key={day}
            day={day}
            entries={grouped[day]}
            subjects={subjects}
            isToday={day === todayWeekday}
          />
        ))}
      </div>
    </>
  );
}

function DayColumn({
  day,
  entries,
  subjects,
  isToday,
}: {
  day: Weekday;
  entries: TimetableRow[];
  subjects: readonly SubjectRef[];
  isToday: boolean;
}) {
  return (
    <section
      aria-label={WEEKDAY_LABELS[day]}
      className={cn(
        "flex flex-col rounded-xl border",
        isToday ? "border-primary/40 bg-primary/[0.04]" : "bg-card",
      )}
    >
      <header
        className={cn(
          "flex items-center justify-between gap-1 rounded-t-xl border-b px-3 py-2.5",
          isToday && "border-primary/25",
        )}
      >
        <h3 className="text-sm font-semibold">{WEEKDAY_LABELS[day].slice(0, 3)}</h3>
        {isToday ? (
          <Badge className="bg-primary text-primary-foreground text-[0.625rem]">
            Today
          </Badge>
        ) : null}
      </header>

      <div className="flex flex-1 flex-col gap-2 p-2">
        {entries.length === 0 ? (
          <p className="text-muted-foreground px-1 py-6 text-center text-xs">
            No classes
          </p>
        ) : (
          entries.map((entry) => (
            <EntryBlock key={entry.id} entry={entry} subjects={subjects} />
          ))
        )}
        <TimetableFormDialog
          subjects={subjects}
          defaultWeekday={day}
          trigger={
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground mt-auto h-7 w-full text-xs"
            >
              + Add
            </Button>
          }
        />
      </div>
    </section>
  );
}

function DayCard({
  day,
  entries,
  subjects,
  isToday,
}: {
  day: Weekday;
  entries: TimetableRow[];
  subjects: readonly SubjectRef[];
  isToday: boolean;
}) {
  return (
    <Card
      className={cn(
        "gap-0 p-0",
        isToday && "border-primary/40 bg-primary/[0.03]",
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          {WEEKDAY_LABELS[day]}
          {isToday ? (
            <Badge className="bg-primary text-primary-foreground text-[0.625rem]">
              Today
            </Badge>
          ) : null}
        </h3>
        <TimetableFormDialog
          subjects={subjects}
          defaultWeekday={day}
          trigger={
            <Button variant="ghost" size="sm" className="text-muted-foreground h-7 text-xs">
              + Add
            </Button>
          }
        />
      </header>

      {entries.length === 0 ? (
        <p className="text-muted-foreground px-4 py-5 text-sm">
          Nothing scheduled.
        </p>
      ) : (
        <div className="space-y-2 p-3">
          {entries.map((entry) => (
            <EntryBlock key={entry.id} entry={entry} subjects={subjects} wide />
          ))}
        </div>
      )}
    </Card>
  );
}

function EntryBlock({
  entry,
  subjects,
  wide = false,
}: {
  entry: TimetableRow;
  subjects: readonly SubjectRef[];
  wide?: boolean;
}) {
  const color = subjectColor(entry.subject?.color);
  const label = entry.subject?.name ?? entry.title ?? "Untitled";

  return (
    <div
      className={cn(
        "group rounded-lg border border-l-3 px-2.5 py-2",
        entry.subject ? color.border : "border-l-muted-foreground/40",
        wide && "px-3 py-2.5",
      )}
    >
      <p className="tabular text-muted-foreground text-xs font-medium">
        {formatClockTime(entry.startTime)} – {formatClockTime(entry.endTime)}
      </p>
      <p className="mt-0.5 text-sm leading-tight font-medium">{label}</p>

      <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs">
        {entry.subject ? <span>{entry.subject.code}</span> : null}
        {entry.type !== "CLASS" ? (
          <span>{TIMETABLE_TYPE_LABELS[entry.type]}</span>
        ) : null}
        {entry.room ? (
          <span className="flex items-center gap-1">
            <MapPin className="size-3" aria-hidden />
            {entry.room}
          </span>
        ) : null}
        {entry.instructor && wide ? (
          <span className="flex items-center gap-1">
            <User className="size-3" aria-hidden />
            {entry.instructor}
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex items-center gap-1">
        <TimetableFormDialog
          subjects={subjects}
          entry={{
            id: entry.id,
            subjectId: entry.subject?.id ?? null,
            title: entry.title,
            weekday: entry.weekday,
            startTime: entry.startTime,
            endTime: entry.endTime,
            room: entry.room,
            instructor: entry.instructor,
            type: entry.type,
          }}
          trigger={
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-6 px-2 text-xs"
            >
              Edit
            </Button>
          }
        />
        <ConfirmAction
          trigger={
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive h-6 px-2"
              aria-label={`Delete ${label} on ${WEEKDAY_LABELS[entry.weekday]}`}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          }
          title="Delete this timetable entry?"
          description={`${label} on ${WEEKDAY_LABELS[entry.weekday]} at ${formatClockTime(entry.startTime)} will be removed from your weekly schedule.`}
          action={deleteTimetableEntry.bind(null, entry.id)}
        />
      </div>
    </div>
  );
}
