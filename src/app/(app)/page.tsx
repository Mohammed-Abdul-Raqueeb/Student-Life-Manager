import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  UserCheck,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { AssignmentFormDialog } from "@/components/assignments/assignment-form";
import { TaskFormDialog } from "@/components/assignments/task-form";
import { StudyByDayChart } from "@/components/charts/study-charts";
import { DeadlineList } from "@/components/dashboard/deadline-list";
import { InsightList } from "@/components/dashboard/insight-list";
import { ExamFormDialog } from "@/components/exams/exam-form";
import {
  AttendanceAdvice,
  AttendanceBar,
  AttendancePercent,
} from "@/components/shared/attendance-meter";
import {
  CountdownBadge,
  EXAM_TYPE_LABELS,
  SubjectChip,
} from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StudyGoalMeter } from "@/components/study/study-goal";
import { SubjectFormDialog } from "@/components/subjects/subject-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  isDueWithinDays,
  isOverdue,
  sortForAttention,
} from "@/lib/calculations/deadlines";
import { buildInsights } from "@/lib/calculations/insights";
import { countdownLabel, formatDate, formatDateTime } from "@/lib/date";
import { getDashboardData, getSubjectRefs } from "@/lib/db/queries";

export default async function OverviewPage() {
  const now = new Date();
  const [data, subjectRefs] = await Promise.all([
    getDashboardData(now),
    getSubjectRefs(),
  ]);

  if (!data.hasAnyData) {
    return <FirstRun name={data.user.name} />;
  }

  const open = data.deadlines.filter((item) => !item.isDone);
  const attention = sortForAttention(data.deadlines, now);
  const dueSoon = open.filter((item) => isDueWithinDays(item, now, 3));
  const overdue = open.filter((item) => isOverdue(item, now));
  const upcomingExams = data.exams
    .filter((exam) => exam.examDate.getTime() >= now.getTime())
    .slice(0, 4);

  const insights = buildInsights({
    now,
    deadlines: data.deadlines,
    attendance: data.attendance.subjects.map((entry) => ({
      subject: entry.subject,
      stats: entry.stats,
    })),
    attendanceTargetPercent: data.attendance.targetPercent,
    studyMinutesThisWeek: data.study.minutesThisWeek,
    weeklyStudyGoalMinutes: data.study.weeklyGoalMinutes,
  });

  return (
    <>
      <PageHeader
        title={
          <>
            {greeting(now)} <span aria-hidden>👋</span>
          </>
        }
        description={`${formatDate(now, "EEEE, d MMMM")} · Here is what needs your attention today.`}
        actions={
          <>
            <AssignmentFormDialog subjects={subjectRefs} />
            <TaskFormDialog />
          </>
        }
      />

      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            label="Completed today"
            value={data.completedToday}
            icon={CheckCircle2}
            tone={data.completedToday > 0 ? "success" : "neutral"}
            hint="Assignments and tasks"
            href="/today"
          />
          <StatCard
            label="Due soon"
            value={dueSoon.length}
            icon={ClipboardList}
            tone={dueSoon.length > 0 ? "warning" : "neutral"}
            hint="Within 3 days"
            href="/assignments"
          />
          <StatCard
            label="Upcoming exams"
            value={upcomingExams.length}
            icon={CalendarClock}
            hint={
              upcomingExams[0]
                ? countdownLabel(upcomingExams[0].examDate, now)
                : "None scheduled"
            }
            href="/exams"
          />
          <StatCard
            label="Overall attendance"
            value={
              data.attendance.overall.hasRecords
                ? `${Math.round(data.attendance.overall.percent)}%`
                : "—"
            }
            icon={UserCheck}
            tone={
              !data.attendance.overall.hasRecords
                ? "neutral"
                : data.attendance.overall.meetsTarget
                  ? "success"
                  : "critical"
            }
            hint={`Target ${data.attendance.targetPercent}%`}
            href="/attendance"
          />
        </div>

        {insights.length > 0 ? (
          <section aria-labelledby="focus-heading">
            <SectionHeader
              id="focus-heading"
              title="Today's focus"
              description="Calculated from your records — every line links to the detail behind it."
            />
            <InsightList insights={insights} />
          </section>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-5">
          <section aria-labelledby="deadlines-heading" className="lg:col-span-3">
            <SectionHeader
              id="deadlines-heading"
              title="Upcoming deadlines"
              description="Assignments, exams and dated tasks in one queue."
              action={
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                >
                  <Link href="/assignments">
                    View all
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </Button>
              }
            />
            {attention.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Nothing due"
                description="No open assignments, exams or dated tasks. Add something when it comes up."
                action={<AssignmentFormDialog subjects={subjectRefs} />}
                compact
              />
            ) : (
              <DeadlineList items={attention.slice(0, 8)} now={now} />
            )}
          </section>

          <section aria-labelledby="exams-heading" className="lg:col-span-2">
            <SectionHeader
              id="exams-heading"
              title="Upcoming exams"
              action={
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                >
                  <Link href="/exams">
                    View all
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </Button>
              }
            />
            {upcomingExams.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="No exams scheduled"
                description="Add your quizzes, midterms and finals to see countdowns here."
                action={<ExamFormDialog subjects={subjectRefs} />}
                compact
              />
            ) : (
              <Card className="gap-0 p-0">
                <ul className="divide-y">
                  {upcomingExams.map((exam) => (
                    <li key={exam.id}>
                      <Link
                        href="/exams"
                        className="hover:bg-muted/40 block px-4 py-3.5 transition-colors sm:px-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              {exam.subject.name}
                            </p>
                            <p className="text-muted-foreground mt-0.5 text-xs">
                              {exam.name} · {EXAM_TYPE_LABELS[exam.type]}
                            </p>
                          </div>
                          <CountdownBadge
                            label={countdownLabel(exam.examDate, now)}
                            urgent={
                              exam.examDate.getTime() - now.getTime() <=
                              3 * 86_400_000
                            }
                          />
                        </div>
                        <p className="text-muted-foreground tabular mt-1.5 text-xs">
                          {formatDateTime(exam.examDate)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <section aria-labelledby="attendance-heading" className="lg:col-span-2">
            <SectionHeader
              id="attendance-heading"
              title="Attendance"
              action={
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                >
                  <Link href="/attendance">
                    Record
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </Button>
              }
            />
            <Card className="gap-0 p-5">
              <div className="flex items-baseline justify-between">
                <p className="stat-label">Overall</p>
                <p className="text-2xl font-semibold">
                  <AttendancePercent stats={data.attendance.overall} />
                </p>
              </div>
              <AttendanceBar stats={data.attendance.overall} className="mt-2" />
              <AttendanceAdvice
                stats={data.attendance.overall}
                className="mt-2"
              />

              {data.attendance.subjects.length > 0 ? (
                <ul className="mt-4 space-y-2.5 border-t pt-4">
                  {data.attendance.subjects.map(({ subject, stats }) => (
                    <li key={subject.id} className="flex items-center gap-2.5">
                      <SubjectChip subject={subject} />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {subject.name}
                      </span>
                      <span className="shrink-0 text-sm font-medium">
                        <AttendancePercent stats={stats} />
                      </span>
                      {stats.hasRecords && !stats.meetsTarget ? (
                        <span className="text-destructive shrink-0 text-xs">
                          <span aria-hidden>⚠</span>
                          <span className="sr-only">
                            Below the {data.attendance.targetPercent}% target
                          </span>
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          </section>

          <section aria-labelledby="study-heading" className="lg:col-span-3">
            <SectionHeader
              id="study-heading"
              title="Study progress"
              action={
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                >
                  <Link href="/study">
                    View all
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </Button>
              }
            />
            <div className="space-y-4">
              <StudyGoalMeter
                minutes={data.study.minutesThisWeek}
                goalMinutes={data.study.weeklyGoalMinutes}
                showLink={false}
              />
              <Card className="p-5">
                <StudyByDayChart
                  data={data.study.byDay.map((day) => ({
                    label: day.label,
                    minutes: day.minutes,
                  }))}
                  goalMinutesPerDay={
                    data.study.weeklyGoalMinutes > 0
                      ? Math.round(data.study.weeklyGoalMinutes / 7)
                      : undefined
                  }
                />
              </Card>
            </div>
          </section>
        </div>

        {overdue.length > 0 ? (
          <p className="text-muted-foreground text-center text-xs">
            {overdue.length} overdue {overdue.length === 1 ? "item" : "items"}{" "}
            shown at the top of the deadline queue.
          </p>
        ) : null}
      </div>
    </>
  );
}

/** The empty database. One clear next step, not a wall of disabled widgets. */
function FirstRun({ name }: { name: string }) {
  return (
    <>
      <PageHeader
        title={`Welcome, ${name}`}
        description="Set up your term in a couple of minutes. Start with your subjects — everything else hangs off them."
      />
      <EmptyState
        icon={BookOpen}
        title="Add your first subject"
        description="Once your courses are in you can track assignments, exams, attendance, marks and study time, and this dashboard fills in automatically."
        action={<SubjectFormDialog usedColors={[]} />}
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <NextStep
          href="/timetable"
          title="Build your timetable"
          body="Add your weekly classes so the Today page can lay out your day."
        />
        <NextStep
          href="/attendance"
          title="Record attendance"
          body="Two taps per class, and the app tells you exactly where you stand."
        />
        <NextStep
          href="/settings"
          title="Set your targets"
          body="Attendance target, weekly study goal and grading scale."
        />
      </div>
    </>
  );
}

function NextStep({
  href,
  title,
  body,
}: {
  href: Route;
  title: string;
  body: string;
}) {
  return (
    <Link href={href} className="block">
      <Card className="hover:border-primary/40 h-full gap-1 p-5 transition-colors">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          {title}
          <ArrowRight className="size-3.5" aria-hidden />
        </p>
        <p className="text-muted-foreground text-sm">{body}</p>
      </Card>
    </Link>
  );
}

function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
