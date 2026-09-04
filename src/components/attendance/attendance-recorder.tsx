"use client";

import { Check, Eraser, X } from "lucide-react";
import { useState } from "react";

import {
  clearAttendanceForDay,
  quickRecordAttendance,
} from "@/actions/attendance";
import { ActionButton } from "@/components/shared/action-button";
import {
  AttendanceAdvice,
  AttendanceBar,
  AttendancePercent,
} from "@/components/shared/attendance-meter";
import { AttendanceStatusBadge } from "@/components/shared/badges";
import { FIELD_CLASS } from "@/components/shared/form-controls";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AttendanceStatus } from "@/generated/prisma/enums";
import type { AttendanceStats } from "@/lib/calculations/attendance";
import { subjectColor } from "@/lib/subject-colors";
import { cn } from "@/lib/utils";

export type RecorderSubject = {
  subject: { id: string; name: string; code: string; color: string };
  stats: AttendanceStats;
  todayStatus: AttendanceStatus | null;
};

/**
 * The quick recorder.
 *
 * One row per subject, two taps to log a class. The date picker at the top lets
 * a student catch up on a day they forgot; because attendance is keyed on
 * (subject, date), re-recording a day corrects it rather than double-counting.
 * `todayStatus` only reflects today, so the row shows a hint once the date is
 * changed rather than a stale badge.
 */
export function AttendanceRecorder({
  subjects,
  todayValue,
}: {
  subjects: readonly RecorderSubject[];
  todayValue: string;
}) {
  const [date, setDate] = useState(todayValue);
  const isToday = date === todayValue;

  return (
    <Card className="gap-0 p-0">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b px-4 py-4 sm:px-5">
        <div className="space-y-1.5">
          <Label htmlFor="attendance-date">Recording for</Label>
          <Input
            id="attendance-date"
            type="date"
            value={date}
            max={todayValue}
            onChange={(event) => setDate(event.target.value || todayValue)}
            className={cn(FIELD_CLASS, "w-[11rem]")}
          />
        </div>
        <p className="text-muted-foreground max-w-xs text-xs">
          {isToday
            ? "Marking a subject twice for the same day replaces the entry — it never counts the class twice."
            : "Catching up on an earlier day. The badges below still show today's entry."}
        </p>
      </div>

      <ul className="divide-y">
        {subjects.map(({ subject, stats, todayStatus }) => {
          const color = subjectColor(subject.color);
          return (
            <li key={subject.id} className="px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn("size-2.5 shrink-0 rounded-full", color.dot)}
                      aria-hidden
                    />
                    <p className="truncate font-medium">{subject.name}</p>
                    {isToday && todayStatus ? (
                      <AttendanceStatusBadge status={todayStatus} />
                    ) : null}
                  </div>

                  <div className="mt-2 flex items-center gap-3">
                    <p className="text-lg font-semibold">
                      <AttendancePercent stats={stats} />
                    </p>
                    <p className="text-muted-foreground tabular text-xs">
                      {stats.attended} / {stats.conducted} classes
                    </p>
                  </div>

                  <AttendanceBar stats={stats} className="mt-2 max-w-sm" />
                  <AttendanceAdvice stats={stats} className="mt-2" />
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <ActionButton
                    action={quickRecordAttendance.bind(
                      null,
                      subject.id,
                      "PRESENT",
                      date,
                    )}
                    pendingLabel="Saving…"
                    className="border-success/40 text-success hover:bg-success/10"
                    ariaLabel={`Mark present for ${subject.name}`}
                  >
                    <Check className="size-3.5" aria-hidden />
                    Present
                  </ActionButton>

                  <ActionButton
                    action={quickRecordAttendance.bind(
                      null,
                      subject.id,
                      "ABSENT",
                      date,
                    )}
                    pendingLabel="Saving…"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                    ariaLabel={`Mark absent for ${subject.name}`}
                  >
                    <X className="size-3.5" aria-hidden />
                    Absent
                  </ActionButton>

                  <ActionButton
                    action={clearAttendanceForDay.bind(null, subject.id, date)}
                    pendingLabel="Clearing…"
                    variant="ghost"
                    className="text-muted-foreground"
                    ariaLabel={`Clear the entry for ${subject.name}`}
                    title="Remove this day's entry so the class is not counted as conducted"
                  >
                    <Eraser className="size-3.5" aria-hidden />
                    <span className="sr-only sm:not-sr-only">Clear</span>
                  </ActionButton>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
