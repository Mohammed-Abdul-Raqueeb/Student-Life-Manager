import { Timer, Trash2 } from "lucide-react";
import type { Metadata } from "next";

import { deleteStudySession } from "@/actions/study";
import {
  StudyByDayChart,
  StudyBySubjectChart,
  StudyTrendChart,
} from "@/components/charts/study-charts";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { SubjectChip } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StudyGoalMeter } from "@/components/study/study-goal";
import { StudySessionFormDialog } from "@/components/study/study-session-form";
import { SubjectFormDialog } from "@/components/subjects/subject-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate, formatDuration, formatTime } from "@/lib/date";
import { getStudyOverview, getSubjectRefs, weekdayFor } from "@/lib/db/queries";
import { WEEKDAY_LABELS } from "@/lib/db/queries";
import { subjectPath } from "@/lib/routes";

export const metadata: Metadata = { title: "Study Progress" };

export default async function StudyPage() {
  const now = new Date();
  const [overview, subjects] = await Promise.all([
    getStudyOverview(now),
    getSubjectRefs(),
  ]);

  const todayWeekday = weekdayFor(now);
  const byDay = overview.byDay.map((day) => ({
    label: day.label,
    minutes: day.minutes,
    isToday: WEEKDAY_LABELS[todayWeekday].startsWith(day.label),
  }));

  const bySubject = overview.bySubject.map((entry) => ({
    label: entry.subject.name,
    code: entry.subject.code,
    minutes: entry.minutes,
  }));

  const averageSession =
    overview.sessionCount > 0
      ? Math.round(overview.totalMinutesAllTime / overview.sessionCount)
      : 0;

  if (subjects.length === 0) {
    return (
      <>
        <PageHeader
          title="Study progress"
          description="Log study sessions and track your weekly goal."
        />
        <EmptyState
          icon={Timer}
          title="No subjects to study"
          description="Study sessions are recorded against a subject. Add your courses first."
          action={<SubjectFormDialog usedColors={[]} />}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Study progress"
        description="Time actually spent studying, by day, by subject, and week over week."
        actions={<StudySessionFormDialog subjects={subjects} />}
      />

      <div className="space-y-8">
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-4">
          <StudyGoalMeter
            minutes={overview.minutesThisWeek}
            goalMinutes={overview.weeklyGoalMinutes}
            className="lg:col-span-2"
          />
          <StatCard
            label="Today"
            value={formatDuration(overview.minutesToday)}
            icon={Timer}
            hint={overview.minutesToday > 0 ? "Logged so far" : "Nothing logged yet"}
            tone={overview.minutesToday > 0 ? "success" : "neutral"}
          />
          <StatCard
            label="Average session"
            value={averageSession > 0 ? formatDuration(averageSession) : "—"}
            hint={`${overview.sessionCount} ${
              overview.sessionCount === 1 ? "session" : "sessions"
            } all time`}
          />
        </div>

        {overview.sessionCount === 0 ? (
          <EmptyState
            icon={Timer}
            title="No study sessions yet"
            description="Log your first session to start building a picture of where your time goes. Sessions that run past midnight are handled correctly."
            action={<StudySessionFormDialog subjects={subjects} />}
          />
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-5">
                <StudyByDayChart
                  data={byDay}
                  goalMinutesPerDay={
                    overview.weeklyGoalMinutes > 0
                      ? Math.round(overview.weeklyGoalMinutes / 7)
                      : undefined
                  }
                />
              </Card>
              <Card className="p-5">
                <StudyBySubjectChart data={bySubject} />
              </Card>
            </div>

            <Card className="p-5">
              <StudyTrendChart
                data={overview.trend.map((point) => ({
                  label: point.label,
                  minutes: point.minutes,
                }))}
                goalMinutes={overview.weeklyGoalMinutes}
              />
            </Card>

            <section aria-labelledby="sessions">
              <SectionHeader
                id="sessions"
                title="Recent sessions"
                description="The 30 most recent, newest first."
                action={<StudySessionFormDialog subjects={subjects} />}
              />
              <Card className="gap-0 p-0">
                <ul className="divide-y">
                  {overview.sessions.map((session) => (
                    <li
                      key={session.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium">
                            {session.topic ?? session.subject.name}
                          </p>
                          <SubjectChip
                            subject={session.subject}
                            href={subjectPath(session.subject.id)}
                          />
                        </div>
                        <p className="text-muted-foreground tabular mt-0.5 text-xs">
                          {formatDate(session.startedAt)} ·{" "}
                          {formatTime(session.startedAt)} –{" "}
                          {formatTime(session.endedAt)}
                        </p>
                        {session.notes ? (
                          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                            {session.notes}
                          </p>
                        ) : null}
                      </div>

                      <p className="tabular text-sm font-semibold">
                        {formatDuration(session.minutes)}
                      </p>

                      <div className="flex items-center gap-1">
                        <StudySessionFormDialog
                          subjects={subjects}
                          session={{
                            id: session.id,
                            subjectId: session.subject.id,
                            topic: session.topic,
                            startedAt: session.startedAt,
                            endedAt: session.endedAt,
                            notes: session.notes,
                          }}
                          trigger={
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground h-8 px-2 text-xs"
                            >
                              Edit
                            </Button>
                          }
                        />
                        <ConfirmAction
                          trigger={
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground hover:text-destructive h-8 px-2"
                              aria-label={`Delete the session on ${formatDate(session.startedAt)}`}
                            >
                              <Trash2 className="size-3.5" aria-hidden />
                            </Button>
                          }
                          title="Delete this study session?"
                          description={`${formatDuration(session.minutes)} on ${formatDate(session.startedAt)} will be removed from your totals.`}
                          action={deleteStudySession.bind(null, session.id)}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          </>
        )}
      </div>
    </>
  );
}
