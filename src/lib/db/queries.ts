import "server-only";

import { addDays } from "date-fns";

import { cache } from "react";

import type {
  AssessmentType,
  AssignmentStatus,
  AttendanceStatus,
  ExamType,
  Priority,
  TaskStatus,
  TimetableEntryType,
  Weekday,
} from "@/generated/prisma/enums";
import {
  attendanceStats,
  overallAttendance,
  type AttendanceStats,
} from "@/lib/calculations/attendance";
import {
  buildDeadlineStream,
  type DeadlineItem,
} from "@/lib/calculations/deadlines";
import {
  gradeFor,
  overallAverage,
  subjectScore,
  type GradeBand,
  type SubjectScore,
} from "@/lib/calculations/marks";
import {
  minutesByDay,
  minutesBySubject,
  sessionMinutes,
  totalMinutes,
  weeklyTrend,
  type DayTotal,
  type WeeklyTrendPoint,
} from "@/lib/calculations/study";
import { clockToMinutes, dayRange, inAppZone, weekRange } from "@/lib/date";
import { WEEKDAY_ORDER, weekdayFor } from "@/lib/weekdays";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, type CurrentUser } from "@/lib/db/user";

// Re-exported so server code can keep importing everything from one place; the
// definitions live in a database-free module because client components need them.
export { WEEKDAY_LABELS, WEEKDAY_ORDER, weekdayFor } from "@/lib/weekdays";

/**
 * The read layer.
 *
 * Pages call these functions; no page or component talks to Prisma directly.
 * Each function issues a small, fixed set of queries (attendance and assignment
 * counts come back as `groupBy` aggregates rather than as rows to be counted in
 * JavaScript) and hands back a view model with every derived number already
 * computed by `src/lib/calculations`.
 */


// ── Shared shapes ────────────────────────────────────────────────────────────

export type SubjectRef = {
  id: string;
  name: string;
  code: string;
  color: string;
};

const subjectRefSelect = {
  id: true,
  name: true,
  code: true,
  color: true,
} as const;

export type SubjectSummary = SubjectRef & {
  credits: number;
  instructor: string | null;
  attendance: AttendanceStats;
  score: SubjectScore;
  grade: string | null;
  pendingAssignments: number;
  nextExam: { id: string; name: string; type: ExamType; examDate: Date } | null;
};

// ── Subjects ─────────────────────────────────────────────────────────────────

export const getSubjects = cache(async () => {
  const user = await getCurrentUser();
  return prisma.subject.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
  });
});

export const getSubjectRefs = cache(async (): Promise<SubjectRef[]> => {
  const user = await getCurrentUser();
  return prisma.subject.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
    select: subjectRefSelect,
  });
});

/** Subjects plus every headline number the Subjects page shows, in 5 queries. */
export const getSubjectSummaries = cache(
  async (now: Date = new Date()): Promise<SubjectSummary[]> => {
    const user = await getCurrentUser();
    const { id: userId, settings } = user;

    const [subjects, attendanceGroups, assessments, pendingGroups, upcomingExams] =
      await Promise.all([
        prisma.subject.findMany({
          where: { userId },
          orderBy: { name: "asc" },
        }),
        prisma.attendanceRecord.groupBy({
          by: ["subjectId", "status"],
          where: { userId },
          _count: { _all: true },
        }),
        prisma.assessment.findMany({
          where: { userId },
          select: {
            subjectId: true,
            marksObtained: true,
            maxMarks: true,
            weightage: true,
          },
        }),
        prisma.assignment.groupBy({
          by: ["subjectId"],
          where: { userId, status: { not: "COMPLETED" } },
          _count: { _all: true },
        }),
        prisma.exam.findMany({
          where: { userId, examDate: { gte: now } },
          orderBy: { examDate: "asc" },
          select: { id: true, name: true, type: true, examDate: true, subjectId: true },
        }),
      ]);

    const counts = attendanceCountsBySubject(attendanceGroups);
    const pendingBySubject = new Map(
      pendingGroups.map((row) => [row.subjectId, row._count._all]),
    );

    return subjects.map((subject) => {
      const subjectAssessments = assessments.filter(
        (a) => a.subjectId === subject.id,
      );
      const score = subjectScore(subjectAssessments);

      return {
        id: subject.id,
        name: subject.name,
        code: subject.code,
        color: subject.color,
        credits: subject.credits,
        instructor: subject.instructor,
        attendance: attendanceStats(
          counts.get(subject.id) ?? { attended: 0, conducted: 0 },
          settings.attendanceTargetPercent,
        ),
        score,
        grade: score.hasAssessments
          ? gradeFor(score.score, settings.gradingScale)
          : null,
        pendingAssignments: pendingBySubject.get(subject.id) ?? 0,
        nextExam:
          upcomingExams.find((exam) => exam.subjectId === subject.id) ?? null,
      };
    });
  },
);

/**
 * A single subject, cached per request.
 *
 *  uses this to reject an unknown id before the response
 * starts streaming — once streaming has begun the status line is already sent,
 * and a `notFound()` from the page body renders the right UI under a 200.
 */
export const getSubjectById = cache(async (subjectId: string) => {
  const user = await getCurrentUser();
  return prisma.subject.findFirst({ where: { id: subjectId, userId: user.id } });
});

export type SubjectDetail = {
  subject: {
    id: string;
    name: string;
    code: string;
    color: string;
    credits: number;
    instructor: string | null;
  };
  attendance: AttendanceStats;
  score: SubjectScore;
  grade: string | null;
  gradingScale: GradeBand[];
  attendanceTargetPercent: number;
  assignments: AssignmentRow[];
  exams: ExamRow[];
  assessments: AssessmentRow[];
  notes: NoteRow[];
  timetable: TimetableRow[];
  studyMinutes: number;
  recentSessions: StudySessionRow[];
  attendanceHistory: AttendanceHistoryRow[];
};

// Everything here is a complete history rather than a window on "now", so this
// query takes no clock: the page decides what counts as upcoming.
export async function getSubjectDetail(
  subjectId: string,
): Promise<SubjectDetail | null> {
  const user = await getCurrentUser();
  const userId = user.id;

  const subject = await getSubjectById(subjectId);
  if (!subject) return null;

  const [
    assignments,
    exams,
    assessments,
    notes,
    timetable,
    sessions,
    attendanceGroups,
    attendanceHistory,
  ] = await Promise.all([
    prisma.assignment.findMany({
      where: { userId, subjectId },
      orderBy: { dueDate: "asc" },
      include: { subject: { select: subjectRefSelect } },
    }),
    prisma.exam.findMany({
      where: { userId, subjectId },
      orderBy: { examDate: "asc" },
      include: { subject: { select: subjectRefSelect } },
    }),
    prisma.assessment.findMany({
      where: { userId, subjectId },
      orderBy: { date: "desc" },
      include: { subject: { select: subjectRefSelect } },
    }),
    prisma.note.findMany({
      where: { userId, subjectId },
      orderBy: { updatedAt: "desc" },
      include: { subject: { select: subjectRefSelect } },
    }),
    prisma.timetableEntry.findMany({
      where: { userId, subjectId },
      include: { subject: { select: subjectRefSelect } },
    }),
    prisma.studySession.findMany({
      where: { userId, subjectId },
      orderBy: { startedAt: "desc" },
      include: { subject: { select: subjectRefSelect } },
    }),
    prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: { userId, subjectId },
      _count: { _all: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { userId, subjectId },
      orderBy: { date: "desc" },
      take: 40,
      include: { subject: { select: subjectRefSelect } },
    }),
  ]);

  const conducted = attendanceGroups.reduce((n, g) => n + g._count._all, 0);
  const attended =
    attendanceGroups.find((g) => g.status === "PRESENT")?._count._all ?? 0;

  const score = subjectScore(assessments);

  return {
    subject: {
      id: subject.id,
      name: subject.name,
      code: subject.code,
      color: subject.color,
      credits: subject.credits,
      instructor: subject.instructor,
    },
    attendance: attendanceStats(
      { attended, conducted },
      user.settings.attendanceTargetPercent,
    ),
    score,
    grade: score.hasAssessments
      ? gradeFor(score.score, user.settings.gradingScale)
      : null,
    gradingScale: user.settings.gradingScale,
    attendanceTargetPercent: user.settings.attendanceTargetPercent,
    assignments,
    exams,
    assessments,
    notes,
    timetable: sortTimetable(timetable),
    studyMinutes: totalMinutes(sessions),
    recentSessions: sessions.slice(0, 10).map(toStudySessionRow),
    attendanceHistory: attendanceHistory.map(toAttendanceHistoryRow),
  };
}

// ── Assignments and tasks ────────────────────────────────────────────────────

export type AssignmentRow = {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date;
  priority: Priority;
  status: AssignmentStatus;
  submissionUrl: string | null;
  completedAt: Date | null;
  createdAt: Date;
  subject: SubjectRef;
};

export type AssignmentFilters = {
  subjectId?: string;
  status?: AssignmentStatus;
  priority?: Priority;
  search?: string;
  sort?: "dueDate" | "priority" | "created";
};

export async function getAssignments(
  filters: AssignmentFilters = {},
): Promise<AssignmentRow[]> {
  const user = await getCurrentUser();

  const rows = await prisma.assignment.findMany({
    where: {
      userId: user.id,
      ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: "insensitive" } },
              { description: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy:
      filters.sort === "created"
        ? { createdAt: "desc" }
        : filters.sort === "priority"
          ? [{ priority: "desc" }, { dueDate: "asc" }]
          : { dueDate: "asc" },
    include: { subject: { select: subjectRefSelect } },
  });

  return rows;
}

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  priority: Priority;
  status: TaskStatus;
  completedAt: Date | null;
  createdAt: Date;
};

export async function getTasks(filters: { status?: TaskStatus } = {}): Promise<
  TaskRow[]
> {
  const user = await getCurrentUser();
  return prisma.task.findMany({
    where: {
      userId: user.id,
      ...(filters.status ? { status: filters.status } : {}),
    },
    // Undated tasks sort last, then by due date, then newest first.
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
  });
}

// ── Exams ────────────────────────────────────────────────────────────────────

export type ExamRow = {
  id: string;
  name: string;
  type: ExamType;
  examDate: Date;
  durationMinutes: number | null;
  location: string | null;
  notes: string | null;
  subject: SubjectRef;
};

export async function getExams(): Promise<ExamRow[]> {
  const user = await getCurrentUser();
  return prisma.exam.findMany({
    where: { userId: user.id },
    orderBy: { examDate: "asc" },
    include: { subject: { select: subjectRefSelect } },
  });
}

// ── Timetable ────────────────────────────────────────────────────────────────

export type TimetableRow = {
  id: string;
  title: string | null;
  weekday: Weekday;
  startTime: string;
  endTime: string;
  room: string | null;
  instructor: string | null;
  type: TimetableEntryType;
  subject: SubjectRef | null;
};

export async function getTimetable(): Promise<TimetableRow[]> {
  const user = await getCurrentUser();
  const rows = await prisma.timetableEntry.findMany({
    where: { userId: user.id },
    include: { subject: { select: subjectRefSelect } },
  });
  return sortTimetable(rows);
}

export function groupTimetableByDay(
  rows: readonly TimetableRow[],
): Record<Weekday, TimetableRow[]> {
  const grouped = Object.fromEntries(
    WEEKDAY_ORDER.map((day) => [day, [] as TimetableRow[]]),
  ) as Record<Weekday, TimetableRow[]>;

  for (const row of rows) grouped[row.weekday].push(row);
  return grouped;
}

function sortTimetable<T extends { weekday: Weekday; startTime: string }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => {
    const dayDelta =
      WEEKDAY_ORDER.indexOf(a.weekday) - WEEKDAY_ORDER.indexOf(b.weekday);
    if (dayDelta !== 0) return dayDelta;
    return clockToMinutes(a.startTime) - clockToMinutes(b.startTime);
  });
}

// ── Attendance ───────────────────────────────────────────────────────────────

export type AttendanceHistoryRow = {
  id: string;
  date: Date;
  status: AttendanceStatus;
  note: string | null;
  subject: SubjectRef;
};

export type AttendanceOverview = {
  targetPercent: number;
  overall: AttendanceStats;
  subjects: {
    subject: SubjectRef;
    stats: AttendanceStats;
    todayStatus: AttendanceStatus | null;
  }[];
  history: AttendanceHistoryRow[];
};

export async function getAttendanceOverview(
  now: Date = new Date(),
): Promise<AttendanceOverview> {
  const user = await getCurrentUser();
  const userId = user.id;
  const target = user.settings.attendanceTargetPercent;
  const { start, end } = dayRange(now);

  const [subjects, groups, today, history] = await Promise.all([
    prisma.subject.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: subjectRefSelect,
    }),
    prisma.attendanceRecord.groupBy({
      by: ["subjectId", "status"],
      where: { userId },
      _count: { _all: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { userId, date: { gte: toCalendarBound(start), lte: toCalendarBound(end) } },
      select: { subjectId: true, status: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { userId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 60,
      include: { subject: { select: subjectRefSelect } },
    }),
  ]);

  const counts = attendanceCountsBySubject(groups);
  const todayBySubject = new Map(today.map((r) => [r.subjectId, r.status]));

  const perSubject = subjects.map((subject) => ({
    subject,
    stats: attendanceStats(
      counts.get(subject.id) ?? { attended: 0, conducted: 0 },
      target,
    ),
    todayStatus: todayBySubject.get(subject.id) ?? null,
  }));

  return {
    targetPercent: target,
    overall: overallAttendance(
      perSubject.map((entry) => entry.stats),
      target,
    ),
    subjects: perSubject,
    history: history.map(toAttendanceHistoryRow),
  };
}

// ── Notes ────────────────────────────────────────────────────────────────────

export type NoteRow = {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  subject: SubjectRef | null;
};

export async function getNotes(
  filters: { subjectId?: string; search?: string; general?: boolean } = {},
): Promise<NoteRow[]> {
  const user = await getCurrentUser();
  return prisma.note.findMany({
    where: {
      userId: user.id,
      ...(filters.general ? { subjectId: null } : {}),
      ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: "insensitive" } },
              { content: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: { subject: { select: subjectRefSelect } },
  });
}

// ── Marks ────────────────────────────────────────────────────────────────────

export type AssessmentRow = {
  id: string;
  name: string;
  type: AssessmentType;
  marksObtained: number;
  maxMarks: number;
  weightage: number;
  date: Date;
  subject: SubjectRef;
};

export type MarksOverview = {
  gradingScale: GradeBand[];
  subjects: {
    subject: SubjectRef & { credits: number };
    score: SubjectScore;
    grade: string | null;
    assessments: AssessmentRow[];
  }[];
  overallAverage: number | null;
  overallGrade: string | null;
  assessments: AssessmentRow[];
};

export async function getMarksOverview(): Promise<MarksOverview> {
  const user = await getCurrentUser();
  const scale = user.settings.gradingScale;

  const [subjects, assessments] = await Promise.all([
    prisma.subject.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
      select: { ...subjectRefSelect, credits: true },
    }),
    prisma.assessment.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
      include: { subject: { select: subjectRefSelect } },
    }),
  ]);

  const perSubject = subjects.map((subject) => {
    const own = assessments.filter((a) => a.subject.id === subject.id);
    const score = subjectScore(own);
    return {
      subject,
      score,
      grade: score.hasAssessments ? gradeFor(score.score, scale) : null,
      assessments: own,
    };
  });

  const average = overallAverage(
    perSubject.map((entry) => ({
      score: entry.score.score,
      credits: entry.subject.credits,
      hasAssessments: entry.score.hasAssessments,
    })),
  );

  return {
    gradingScale: scale,
    subjects: perSubject,
    overallAverage: average,
    overallGrade: average === null ? null : gradeFor(average, scale),
    assessments,
  };
}

// ── Study ────────────────────────────────────────────────────────────────────

export type StudySessionRow = {
  id: string;
  topic: string | null;
  startedAt: Date;
  endedAt: Date;
  minutes: number;
  notes: string | null;
  subject: SubjectRef;
};

export type StudyOverview = {
  weeklyGoalMinutes: number;
  minutesThisWeek: number;
  minutesToday: number;
  byDay: DayTotal[];
  bySubject: { subject: SubjectRef; minutes: number }[];
  trend: WeeklyTrendPoint[];
  sessions: StudySessionRow[];
  totalMinutesAllTime: number;
  sessionCount: number;
};

const TREND_WEEKS = 6;

export async function getStudyOverview(
  now: Date = new Date(),
): Promise<StudyOverview> {
  const user = await getCurrentUser();
  const week = weekRange(now);
  const today = dayRange(now);

  // The trend chart needs six weeks; everything else is a slice of that window.
  // Stepped as civil days in the app's zone so the window opens at the student's
  // midnight rather than the host's.
  const trendStart = new Date(
    addDays(inAppZone(week.start), -(TREND_WEEKS - 1) * 7).getTime(),
  );

  const [subjects, windowSessions, recentSessions, allTime] = await Promise.all([
    prisma.subject.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
      select: subjectRefSelect,
    }),
    prisma.studySession.findMany({
      where: { userId: user.id, startedAt: { gte: trendStart } },
      orderBy: { startedAt: "asc" },
      select: { subjectId: true, startedAt: true, endedAt: true },
    }),
    prisma.studySession.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: "desc" },
      take: 30,
      include: { subject: { select: subjectRefSelect } },
    }),
    prisma.studySession.findMany({
      where: { userId: user.id },
      select: { startedAt: true, endedAt: true },
    }),
  ]);

  const thisWeek = windowSessions.filter(
    (s) => s.startedAt >= week.start && s.startedAt <= week.end,
  );

  return {
    weeklyGoalMinutes: user.settings.weeklyStudyGoalMinutes,
    minutesThisWeek: totalMinutes(thisWeek),
    minutesToday: totalMinutes(
      windowSessions.filter(
        (s) => s.startedAt >= today.start && s.startedAt <= today.end,
      ),
    ),
    byDay: minutesByDay(thisWeek, week.start),
    bySubject: minutesBySubject(thisWeek, subjects),
    trend: weeklyTrend(windowSessions, now, TREND_WEEKS),
    sessions: recentSessions.map(toStudySessionRow),
    totalMinutesAllTime: totalMinutes(allTime),
    sessionCount: allTime.length,
  };
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export type DashboardData = {
  user: CurrentUser;
  now: Date;
  deadlines: DeadlineItem[];
  assignments: AssignmentRow[];
  exams: ExamRow[];
  tasks: TaskRow[];
  attendance: AttendanceOverview;
  study: StudyOverview;
  subjects: SubjectSummary[];
  completedToday: number;
  hasAnyData: boolean;
};

export async function getDashboardData(
  now: Date = new Date(),
): Promise<DashboardData> {
  const user = await getCurrentUser();
  const today = dayRange(now);

  const [assignments, exams, tasks, attendance, study, subjects, completedToday] =
    await Promise.all([
      prisma.assignment.findMany({
        where: { userId: user.id },
        orderBy: { dueDate: "asc" },
        include: { subject: { select: subjectRefSelect } },
      }),
      prisma.exam.findMany({
        where: { userId: user.id },
        orderBy: { examDate: "asc" },
        include: { subject: { select: subjectRefSelect } },
      }),
      getTasks(),
      getAttendanceOverview(now),
      getStudyOverview(now),
      getSubjectSummaries(now),
      countCompletedToday(user.id, today),
    ]);

  const deadlines = buildDeadlineStream({ assignments, exams, tasks }, now);

  return {
    user,
    now,
    deadlines,
    assignments,
    exams,
    tasks,
    attendance,
    study,
    subjects,
    completedToday,
    hasAnyData:
      subjects.length > 0 ||
      assignments.length > 0 ||
      tasks.length > 0 ||
      exams.length > 0,
  };
}

async function countCompletedToday(
  userId: string,
  today: { start: Date; end: Date },
): Promise<number> {
  const [assignments, tasks] = await Promise.all([
    prisma.assignment.count({
      where: {
        userId,
        status: "COMPLETED",
        completedAt: { gte: today.start, lte: today.end },
      },
    }),
    prisma.task.count({
      where: {
        userId,
        status: "COMPLETED",
        completedAt: { gte: today.start, lte: today.end },
      },
    }),
  ]);
  return assignments + tasks;
}

// ── Today ────────────────────────────────────────────────────────────────────

export type TodayEntry =
  | { kind: "class"; sortKey: number; entry: TimetableRow }
  | { kind: "exam"; sortKey: number; exam: ExamRow }
  | { kind: "assignment"; sortKey: number; assignment: AssignmentRow }
  | { kind: "task"; sortKey: number; task: TaskRow }
  | { kind: "study"; sortKey: number; session: StudySessionRow };

export type TodayData = {
  now: Date;
  weekday: Weekday;
  entries: TodayEntry[];
  overdue: AssignmentRow[];
  overdueTasks: TaskRow[];
  openTasks: TaskRow[];
  completedToday: number;
  studyMinutesToday: number;
};

export async function getTodayData(now: Date = new Date()): Promise<TodayData> {
  const user = await getCurrentUser();
  const userId = user.id;
  const today = dayRange(now);
  const weekday = weekdayFor(now);

  const [classes, exams, assignments, tasks, sessions, completedToday] =
    await Promise.all([
      prisma.timetableEntry.findMany({
        where: { userId, weekday },
        include: { subject: { select: subjectRefSelect } },
      }),
      prisma.exam.findMany({
        where: { userId, examDate: { gte: today.start, lte: today.end } },
        orderBy: { examDate: "asc" },
        include: { subject: { select: subjectRefSelect } },
      }),
      prisma.assignment.findMany({
        where: {
          userId,
          OR: [
            { dueDate: { gte: today.start, lte: today.end } },
            { status: { not: "COMPLETED" }, dueDate: { lt: today.start } },
          ],
        },
        orderBy: { dueDate: "asc" },
        include: { subject: { select: subjectRefSelect } },
      }),
      prisma.task.findMany({
        where: {
          userId,
          OR: [
            { dueDate: { lte: today.end } },
            { dueDate: null, status: "PENDING" },
          ],
        },
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      }),
      prisma.studySession.findMany({
        where: { userId, startedAt: { gte: today.start, lte: today.end } },
        orderBy: { startedAt: "asc" },
        include: { subject: { select: subjectRefSelect } },
      }),
      countCompletedToday(userId, today),
    ]);

  const dueToday = assignments.filter(
    (a) => a.dueDate >= today.start && a.dueDate <= today.end,
  );

  const entries: TodayEntry[] = [
    ...classes.map((entry) => ({
      kind: "class" as const,
      sortKey: clockToMinutes(entry.startTime),
      entry,
    })),
    ...exams.map((exam) => ({
      kind: "exam" as const,
      sortKey: minutesOfDay(exam.examDate),
      exam,
    })),
    ...sessions.map((session) => ({
      kind: "study" as const,
      sortKey: minutesOfDay(session.startedAt),
      session: toStudySessionRow(session),
    })),
    ...dueToday.map((assignment) => ({
      kind: "assignment" as const,
      sortKey: minutesOfDay(assignment.dueDate),
      assignment,
    })),
    ...tasks
      .filter((t) => t.dueDate && t.dueDate >= today.start && t.dueDate <= today.end)
      .map((task) => ({
        kind: "task" as const,
        sortKey: minutesOfDay(task.dueDate as Date),
        task,
      })),
  ].sort((a, b) => a.sortKey - b.sortKey);

  return {
    now,
    weekday,
    entries,
    overdue: assignments.filter(
      (a) => a.status !== "COMPLETED" && a.dueDate < today.start,
    ),
    overdueTasks: tasks.filter(
      (t) => t.status === "PENDING" && t.dueDate !== null && t.dueDate < today.start,
    ),
    openTasks: tasks.filter((t) => t.status === "PENDING"),
    completedToday,
    studyMinutesToday: totalMinutes(sessions),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function attendanceCountsBySubject(
  groups: readonly {
    subjectId: string;
    status: AttendanceStatus;
    _count: { _all: number };
  }[],
): Map<string, { attended: number; conducted: number }> {
  const counts = new Map<string, { attended: number; conducted: number }>();
  for (const group of groups) {
    const current = counts.get(group.subjectId) ?? { attended: 0, conducted: 0 };
    current.conducted += group._count._all;
    if (group.status === "PRESENT") current.attended += group._count._all;
    counts.set(group.subjectId, current);
  }
  return counts;
}

function toStudySessionRow(session: {
  id: string;
  topic: string | null;
  startedAt: Date;
  endedAt: Date;
  notes: string | null;
  subject: SubjectRef;
}): StudySessionRow {
  return {
    id: session.id,
    topic: session.topic,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    minutes: sessionMinutes(session),
    notes: session.notes,
    subject: session.subject,
  };
}

function toAttendanceHistoryRow(record: {
  id: string;
  date: Date;
  status: AttendanceStatus;
  note: string | null;
  subject: SubjectRef;
}): AttendanceHistoryRow {
  return {
    id: record.id,
    date: record.date,
    status: record.status,
    note: record.note,
    subject: record.subject,
  };
}

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** Local day boundary → the UTC-midnight value a `date` column compares against. */
function toCalendarBound(date: Date): Date {
  return new Date(
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T00:00:00.000Z`,
  );
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
