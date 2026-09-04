import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Sun,
  Timer,
  User,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { setAssignmentStatus } from "@/actions/assignments";
import { setTaskStatus } from "@/actions/tasks";
import { AssignmentFormDialog } from "@/components/assignments/assignment-form";
import { TaskFormDialog } from "@/components/assignments/task-form";
import { ToggleCompleteButton } from "@/components/shared/action-button";
import {
  EXAM_TYPE_LABELS,
  PriorityBadge,
  SubjectChip,
  TIMETABLE_TYPE_LABELS,
} from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StudySessionFormDialog } from "@/components/study/study-session-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  countdownLabel,
  formatClockTime,
  formatDate,
  formatDuration,
  formatTime,
  relativeDayLabel,
} from "@/lib/date";
import {
  getSubjectRefs,
  getTodayData,
  type TodayEntry,
} from "@/lib/db/queries";
import { subjectColor } from "@/lib/subject-colors";
import { cn } from "@/lib/utils";
import { subjectPath } from "@/lib/routes";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  const now = new Date();
  const [data, subjects] = await Promise.all([
    getTodayData(now),
    getSubjectRefs(),
  ]);

  const overdueCount = data.overdue.length + data.overdueTasks.length;

  return (
    <>
      <PageHeader
        title="Today"
        description={formatDate(now, "EEEE, d MMMM yyyy")}
        actions={
          <>
            <AssignmentFormDialog subjects={subjects} />
            <StudySessionFormDialog subjects={subjects} />
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="On your schedule"
          value={data.entries.length}
          icon={Sun}
          hint={data.entries.length === 0 ? "Nothing scheduled" : "Classes, exams, deadlines"}
        />
        <StatCard
          label="Completed today"
          value={data.completedToday}
          icon={CheckCircle2}
          tone={data.completedToday > 0 ? "success" : "neutral"}
        />
        <StatCard
          label="Overdue"
          value={overdueCount}
          icon={ClipboardList}
          tone={overdueCount > 0 ? "critical" : "success"}
          href="/assignments"
        />
        <StatCard
          label="Studied today"
          value={formatDuration(data.studyMinutesToday)}
          icon={Timer}
          tone={data.studyMinutesToday > 0 ? "success" : "neutral"}
          href="/study"
        />
      </div>

      <div className="space-y-8">
        {overdueCount > 0 ? (
          <section aria-labelledby="overdue-heading">
            <SectionHeader
              id="overdue-heading"
              title="Overdue"
              description="Past its due date and not yet done."
            />
            <Card className="border-destructive/30 gap-0 p-0">
              <ul className="divide-y">
                {data.overdue.map((assignment) => (
                  <li key={assignment.id} className="flex gap-3 px-4 py-3.5 sm:px-5">
                    <ToggleCompleteButton
                      completed={false}
                      label={`Mark ${assignment.title} complete`}
                      action={setAssignmentStatus.bind(
                        null,
                        assignment.id,
                        "COMPLETED",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{assignment.title}</p>
                      <p className="text-destructive tabular mt-0.5 text-xs font-medium">
                        Due {relativeDayLabel(assignment.dueDate, now).toLowerCase()} ·{" "}
                        {assignment.subject.name}
                      </p>
                    </div>
                    <PriorityBadge priority={assignment.priority} />
                  </li>
                ))}
                {data.overdueTasks.map((task) => (
                  <li key={task.id} className="flex gap-3 px-4 py-3.5 sm:px-5">
                    <ToggleCompleteButton
                      completed={false}
                      label={`Complete ${task.title}`}
                      action={setTaskStatus.bind(null, task.id, "COMPLETED")}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{task.title}</p>
                      <p className="text-destructive tabular mt-0.5 text-xs font-medium">
                        Due{" "}
                        {task.dueDate
                          ? relativeDayLabel(task.dueDate, now).toLowerCase()
                          : "—"}
                      </p>
                    </div>
                    <PriorityBadge priority={task.priority} />
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ) : null}

        <section aria-labelledby="schedule-heading">
          <SectionHeader
            id="schedule-heading"
            title="Your day"
            description="Classes, study sessions, exams and deadlines in the order they happen."
          />

          {data.entries.length === 0 ? (
            <EmptyState
              icon={Sun}
              title="Nothing scheduled today"
              description="No classes on your timetable and nothing due. Add a timetable entry or log a study session to fill the day in."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button asChild variant="outline">
                    <Link href="/timetable">Edit timetable</Link>
                  </Button>
                  <StudySessionFormDialog subjects={subjects} />
                </div>
              }
            />
          ) : (
            <Timeline entries={data.entries} now={now} />
          )}
        </section>

        <section aria-labelledby="tasks-heading">
          <SectionHeader
            id="tasks-heading"
            title="Open tasks"
            description="Tick them off without leaving this page."
            action={<TaskFormDialog />}
          />
          {data.openTasks.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No open tasks"
              description="Everything on your task list is done. Add a new one when something comes up."
              action={<TaskFormDialog />}
              compact
            />
          ) : (
            <Card className="gap-0 p-0">
              <ul className="divide-y">
                {data.openTasks.map((task) => (
                  <li key={task.id} className="flex gap-3 px-4 py-3.5 sm:px-5">
                    <ToggleCompleteButton
                      completed={false}
                      label={`Complete ${task.title}`}
                      action={setTaskStatus.bind(null, task.id, "COMPLETED")}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{task.title}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {task.dueDate
                          ? `Due ${relativeDayLabel(task.dueDate, now).toLowerCase()}`
                          : "No due date"}
                      </p>
                    </div>
                    <PriorityBadge priority={task.priority} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      </div>
    </>
  );
}

/**
 * The day as a single vertical timeline.
 *
 * Classes, exams, study sessions and deadlines are separate tables, but a
 * student's morning is one sequence, so they are merged and sorted by minute of
 * day. The time column is fixed-width and tabular so the rail reads straight.
 */
function Timeline({
  entries,
  now,
}: {
  entries: readonly TodayEntry[];
  now: Date;
}) {
  return (
    <Card className="gap-0 p-0">
      <ol className="divide-y">
        {entries.map((entry) => (
          <li key={timelineKey(entry)} className="flex gap-3 px-4 py-4 sm:gap-4 sm:px-5">
            <p className="tabular text-muted-foreground w-14 shrink-0 pt-0.5 text-sm font-medium">
              {timelineTime(entry)}
            </p>
            <div className="min-w-0 flex-1">{renderEntry(entry, now)}</div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function renderEntry(entry: TodayEntry, now: Date) {
  switch (entry.kind) {
    case "class": {
      const color = subjectColor(entry.entry.subject?.color);
      return (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("size-2 rounded-full", color.dot)} aria-hidden />
            <p className="font-medium">
              {entry.entry.subject?.name ?? entry.entry.title ?? "Untitled"}
            </p>
            <Badge variant="outline" className="text-muted-foreground">
              {TIMETABLE_TYPE_LABELS[entry.entry.type]}
            </Badge>
          </div>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
            <span className="tabular">
              {formatClockTime(entry.entry.startTime)} –{" "}
              {formatClockTime(entry.entry.endTime)}
            </span>
            {entry.entry.room ? (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden />
                Room {entry.entry.room}
              </span>
            ) : null}
            {entry.entry.instructor ? (
              <span className="flex items-center gap-1">
                <User className="size-3.5" aria-hidden />
                {entry.entry.instructor}
              </span>
            ) : null}
          </div>
        </>
      );
    }

    case "exam":
      return (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <CalendarClock className="text-warning size-4 shrink-0" aria-hidden />
            <p className="font-medium">{entry.exam.name}</p>
            <Badge className="bg-warning text-warning-foreground">
              {EXAM_TYPE_LABELS[entry.exam.type]}
            </Badge>
          </div>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
            <SubjectChip
              subject={entry.exam.subject}
              showName
              href={subjectPath(entry.exam.subject.id)}
            />
            <span className="tabular font-medium">
              {countdownLabel(entry.exam.examDate, now)}
            </span>
            {entry.exam.location ? (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden />
                {entry.exam.location}
              </span>
            ) : null}
          </div>
        </>
      );

    case "study":
      return (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Timer className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <p className="font-medium">
              {entry.session.topic ?? "Study session"}
            </p>
            <Badge variant="secondary" className="tabular">
              {formatDuration(entry.session.minutes)}
            </Badge>
          </div>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
            <SubjectChip
              subject={entry.session.subject}
              showName
              href={subjectPath(entry.session.subject.id)}
            />
            <span className="tabular">
              {formatTime(entry.session.startedAt)} –{" "}
              {formatTime(entry.session.endedAt)}
            </span>
          </div>
        </>
      );

    case "assignment": {
      const done = entry.assignment.status === "COMPLETED";
      return (
        <div className="flex gap-3">
          <ToggleCompleteButton
            completed={done}
            label={
              done
                ? `Reopen ${entry.assignment.title}`
                : `Mark ${entry.assignment.title} complete`
            }
            action={setAssignmentStatus.bind(
              null,
              entry.assignment.id,
              done ? "PENDING" : "COMPLETED",
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <ClipboardList
                className="text-muted-foreground size-4 shrink-0"
                aria-hidden
              />
              <p className={cn("font-medium", done && "text-muted-foreground line-through")}>
                {entry.assignment.title}
              </p>
              {!done ? <Badge variant="secondary">Due today</Badge> : null}
            </div>
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
              <SubjectChip
                subject={entry.assignment.subject}
                showName
                href={subjectPath(entry.assignment.subject.id)}
              />
              <span className="tabular">
                {formatTime(entry.assignment.dueDate)}
              </span>
            </div>
          </div>
        </div>
      );
    }

    case "task": {
      const done = entry.task.status === "COMPLETED";
      return (
        <div className="flex gap-3">
          <ToggleCompleteButton
            completed={done}
            label={done ? `Reopen ${entry.task.title}` : `Complete ${entry.task.title}`}
            action={setTaskStatus.bind(
              null,
              entry.task.id,
              done ? "PENDING" : "COMPLETED",
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <BookOpen className="text-muted-foreground size-4 shrink-0" aria-hidden />
              <p className={cn("font-medium", done && "text-muted-foreground line-through")}>
                {entry.task.title}
              </p>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">Task due today</p>
          </div>
        </div>
      );
    }
  }
}

function timelineKey(entry: TodayEntry): string {
  switch (entry.kind) {
    case "class":
      return `class:${entry.entry.id}`;
    case "exam":
      return `exam:${entry.exam.id}`;
    case "study":
      return `study:${entry.session.id}`;
    case "assignment":
      return `assignment:${entry.assignment.id}`;
    case "task":
      return `task:${entry.task.id}`;
  }
}

function timelineTime(entry: TodayEntry): string {
  switch (entry.kind) {
    case "class":
      return formatClockTime(entry.entry.startTime).replace(" ", " ");
    case "exam":
      return formatTime(entry.exam.examDate).replace(" ", " ");
    case "study":
      return formatTime(entry.session.startedAt).replace(" ", " ");
    case "assignment":
      return formatTime(entry.assignment.dueDate).replace(" ", " ");
    case "task":
      return entry.task.dueDate
        ? formatTime(entry.task.dueDate).replace(" ", " ")
        : "—";
  }
}
