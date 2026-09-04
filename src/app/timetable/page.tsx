import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { TimetableFormDialog } from "@/components/timetable/timetable-form";
import { TimetableGrid } from "@/components/timetable/timetable-grid";
import { clockToMinutes, formatDuration } from "@/lib/date";
import {
  getSubjectRefs,
  getTimetable,
  groupTimetableByDay,
  weekdayFor,
  WEEKDAY_LABELS,
} from "@/lib/db/queries";

export const metadata: Metadata = { title: "Timetable" };

export default async function TimetablePage() {
  const now = new Date();
  const [entries, subjects] = await Promise.all([
    getTimetable(),
    getSubjectRefs(),
  ]);

  const grouped = groupTimetableByDay(entries);
  const todayWeekday = weekdayFor(now);
  const todayCount = grouped[todayWeekday].length;

  const weeklyMinutes = entries.reduce(
    (total, entry) =>
      total +
      Math.max(0, clockToMinutes(entry.endTime) - clockToMinutes(entry.startTime)),
    0,
  );

  const busiestDay = [...Object.entries(grouped)].reduce(
    (best, [day, rows]) => (rows.length > best.count ? { day, count: rows.length } : best),
    { day: "", count: 0 },
  );

  return (
    <>
      <PageHeader
        title="Timetable"
        description="Your recurring weekly schedule. Today's column is highlighted."
        actions={<TimetableFormDialog subjects={subjects} defaultWeekday={todayWeekday} />}
      />

      {entries.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Your timetable is empty"
          description="Add your weekly classes and labs. Once they are in, the Today page lays your day out hour by hour."
          action={<TimetableFormDialog subjects={subjects} defaultWeekday={todayWeekday} />}
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Weekly entries" value={entries.length} />
            <StatCard
              label="Today"
              value={todayCount}
              hint={WEEKDAY_LABELS[todayWeekday]}
              icon={CalendarDays}
              tone={todayCount > 0 ? "neutral" : "success"}
            />
            <StatCard
              label="Scheduled time"
              value={formatDuration(weeklyMinutes)}
              hint="Across the week"
            />
            <StatCard
              label="Busiest day"
              value={
                busiestDay.count > 0
                  ? WEEKDAY_LABELS[busiestDay.day as keyof typeof WEEKDAY_LABELS]
                  : "—"
              }
              hint={
                busiestDay.count > 0
                  ? `${busiestDay.count} ${busiestDay.count === 1 ? "entry" : "entries"}`
                  : undefined
              }
            />
          </div>

          <TimetableGrid
            grouped={grouped}
            subjects={subjects}
            todayWeekday={todayWeekday}
          />
        </div>
      )}
    </>
  );
}
