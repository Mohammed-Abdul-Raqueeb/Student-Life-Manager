/**
 * Demo data for a fictional student.
 *
 * The point of this seed is not volume — it is that every state the UI can show
 * is represented at least once, and that the numbers are relative to *today* so
 * the dashboard is meaningful whenever it is run:
 *
 *   - four subjects comfortably above the attendance target, one below it
 *   - one assignment overdue, one due tomorrow, several completed
 *   - an overdue task, open tasks, and tasks completed today
 *   - a past exam and four upcoming ones, the nearest inside a week
 *   - weighted marks in four subjects and unweighted marks in another
 *   - study sessions across this week and the previous five
 *
 * No real person's details appear anywhere.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { createLocalAccountIssuer } from "better-auth/db";
import { addDays, format, set } from "date-fns";
import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { inAppZone } from "../src/lib/date.js";
import type {
  AssessmentType,
  AssignmentStatus,
  ExamType,
  Priority,
  TimetableEntryType,
  Weekday,
} from "../src/generated/prisma/enums.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. See .env.example.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const STUDENT_EMAIL = "student@campivo.local";
/**
 * The demo account's password. A seed is for local development and a
 * throwaway demo login, so this is deliberately fixed, obvious, and printed at
 * the end of the run — it is not a secret and must never be treated as one.
 * The seed refuses to run against production (see `main`).
 */
const STUDENT_PASSWORD = "campivo-demo-1234";

// ── Date helpers, all relative to the moment the seed runs ───────────────────

// Anchored to the app's calendar, not the machine running the seed. Otherwise a
// seed run on a UTC box lays down data on UTC day boundaries that the app then
// reads on IST ones, and the demo dashboard is a day out for no visible reason.
const NOW = new Date();

function seedDay(daysFromToday: number) {
  return addDays(inAppZone(NOW), daysFromToday);
}

function atTime(daysFromToday: number, hours: number, minutes = 0): Date {
  const day = set(seedDay(daysFromToday), {
    hours,
    minutes,
    seconds: 0,
    milliseconds: 0,
  });
  return new Date(day.getTime());
}

/** UTC midnight, as Postgres `date` columns expect. */
function calendarDate(daysFromToday: number): Date {
  return new Date(`${format(seedDay(daysFromToday), "yyyy-MM-dd")}T00:00:00.000Z`);
}

const WEEKDAYS: Weekday[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

function weekdayOf(daysFromToday: number): Weekday {
  return WEEKDAYS[seedDay(daysFromToday).getDay()];
}

/** Days back to the most recent Monday (0 if today is Monday). */
function daysSinceMonday(): number {
  return (inAppZone(NOW).getDay() + 6) % 7;
}

// ── Subject definitions ──────────────────────────────────────────────────────

type SubjectSeed = {
  key: string;
  name: string;
  code: string;
  credits: number;
  instructor: string;
  color: string;
  /** Classes conducted and attended, chosen to land on a specific percentage. */
  conducted: number;
  attended: number;
};

const SUBJECTS: SubjectSeed[] = [
  {
    key: "db",
    name: "Database Systems",
    code: "CS301",
    credits: 4,
    instructor: "Dr. R. Menon",
    color: "indigo",
    conducted: 32,
    attended: 29, // 90.6% — healthy
  },
  {
    key: "math",
    name: "Discrete Mathematics",
    code: "MA204",
    credits: 4,
    instructor: "Prof. A. Iyer",
    color: "teal",
    conducted: 28,
    attended: 23, // 82.1% — healthy
  },
  {
    key: "dl",
    name: "Deep Learning",
    code: "CS412",
    credits: 3,
    instructor: "Dr. S. Kulkarni",
    color: "violet",
    conducted: 27,
    attended: 21, // 77.8% — just above target
  },
  {
    key: "os",
    name: "Operating Systems",
    code: "CS305",
    credits: 4,
    instructor: "Dr. N. Fernandes",
    color: "amber",
    conducted: 30,
    attended: 22, // 73.3% — below the 75% target
  },
  {
    key: "net",
    name: "Computer Networks",
    code: "CS308",
    credits: 3,
    instructor: "Prof. K. Deshpande",
    color: "rose",
    conducted: 26,
    attended: 24, // 92.3% — healthy
  },
];

/**
 * Hash the demo password the same way the app does.
 *
 * better-auth owns the hashing scheme (scrypt with its own parameter choices),
 * so the seed asks it rather than reimplementing it — otherwise a change to
 * those parameters would silently make the demo login stop working.
 */
async function hashPassword(plain: string): Promise<string> {
  const { hashPassword: hash } = await import("better-auth/crypto");
  return hash(plain);
}

function assertNotProduction(): void {
  if (process.env.SEED_ALLOW_REMOTE === "1") return;

  const url = process.env.DATABASE_URL ?? "";
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();

  const isLocal =
    host === "localhost" || host === "127.0.0.1" || host === "::1";

  if (!isLocal) {
    throw new Error(
      `Refusing to seed: DATABASE_URL points at "${host || "an unrecognised host"}", not localhost. ` +
        "This seed deletes its user and everything that cascades from it. " +
        "Set SEED_ALLOW_REMOTE=1 only if you are certain the target is disposable.",
    );
  }
}

async function main() {
  console.log("Seeding Campivo…");

  /*
   * The seed deletes and recreates its user, which cascades to every record
   * that user owns. That is exactly what makes it idempotent locally, and
   * exactly what must never happen to a real deployment — so it refuses to run
   * anywhere that looks like one. Opt out with SEED_ALLOW_REMOTE=1 if you
   * genuinely mean it.
   */
  assertNotProduction();

  // Deleting the user cascades to everything else, so the seed is idempotent.
  await prisma.user.deleteMany({ where: { email: STUDENT_EMAIL } });

  const user = await prisma.user.create({
    data: {
      email: STUDENT_EMAIL,
      name: "Aarav Shah",
      settings: {
        create: {
          collegeName: "Riverside Institute of Technology",
          program: "B.Tech Computer Science",
          semester: "Semester 5",
          attendanceTargetPercent: 75,
          weeklyStudyGoalMinutes: 15 * 60,
          gradingScale: [
            { grade: "A+", minPercent: 90 },
            { grade: "A", minPercent: 85 },
            { grade: "A-", minPercent: 80 },
            { grade: "B+", minPercent: 75 },
            { grade: "B", minPercent: 70 },
            { grade: "B-", minPercent: 65 },
            { grade: "C+", minPercent: 60 },
            { grade: "C", minPercent: 55 },
            { grade: "D", minPercent: 40 },
            { grade: "F", minPercent: 0 },
          ],
          theme: "SYSTEM",
        },
      },
    },
  });

  const userId = user.id;

  // ── Subjects ──────────────────────────────────────────────────────────────
  const subjects = new Map<string, string>();
  for (const seed of SUBJECTS) {
    const subject = await prisma.subject.create({
      data: {
        userId,
        name: seed.name,
        code: seed.code,
        credits: seed.credits,
        instructor: seed.instructor,
        color: seed.color,
      },
    });
    subjects.set(seed.key, subject.id);
  }

  const id = (key: string): string => {
    const value = subjects.get(key);
    if (!value) throw new Error(`Unknown subject key: ${key}`);
    return value;
  };

  // ── Attendance ────────────────────────────────────────────────────────────
  // One record per subject per weekday, walking backwards from yesterday, with
  // the absences spread through the run rather than bunched at one end.
  const attendanceRows: {
    userId: string;
    subjectId: string;
    date: Date;
    status: "PRESENT" | "ABSENT";
  }[] = [];

  for (const seed of SUBJECTS) {
    const absentSlots = pickAbsentSlots(
      seed.conducted,
      seed.conducted - seed.attended,
    );
    let placed = 0;
    let offset = 1;

    while (placed < seed.conducted && offset < 90) {
      const weekday = weekdayOf(-offset);
      if (weekday !== "SATURDAY" && weekday !== "SUNDAY") {
        attendanceRows.push({
          userId,
          subjectId: id(seed.key),
          date: calendarDate(-offset),
          status: absentSlots.has(placed) ? "ABSENT" : "PRESENT",
        });
        placed += 1;
      }
      offset += 1;
    }
  }

  await prisma.attendanceRecord.createMany({ data: attendanceRows });

  // ── Timetable ─────────────────────────────────────────────────────────────
  const timetable: {
    subjectKey: string | null;
    title?: string;
    weekday: Weekday;
    startTime: string;
    endTime: string;
    room?: string;
    type?: TimetableEntryType;
  }[] = [
    { subjectKey: "db", weekday: "MONDAY", startTime: "09:00", endTime: "10:30", room: "204" },
    { subjectKey: "math", weekday: "MONDAY", startTime: "11:00", endTime: "12:30", room: "301" },
    { subjectKey: "os", weekday: "MONDAY", startTime: "14:00", endTime: "15:30", room: "112" },
    { subjectKey: "dl", weekday: "TUESDAY", startTime: "09:00", endTime: "10:30", room: "410" },
    { subjectKey: "net", weekday: "TUESDAY", startTime: "11:00", endTime: "12:30", room: "208" },
    { subjectKey: "db", weekday: "TUESDAY", startTime: "14:00", endTime: "16:00", room: "Lab 2", type: "LAB" },
    { subjectKey: "math", weekday: "WEDNESDAY", startTime: "09:00", endTime: "10:30", room: "301" },
    { subjectKey: "os", weekday: "WEDNESDAY", startTime: "11:00", endTime: "12:30", room: "112" },
    { subjectKey: null, title: "Self study", weekday: "WEDNESDAY", startTime: "16:00", endTime: "18:00", type: "STUDY" },
    { subjectKey: "dl", weekday: "THURSDAY", startTime: "09:00", endTime: "10:30", room: "410" },
    { subjectKey: "db", weekday: "THURSDAY", startTime: "11:00", endTime: "12:30", room: "204" },
    { subjectKey: "net", weekday: "THURSDAY", startTime: "14:00", endTime: "16:00", room: "Lab 1", type: "LAB" },
    { subjectKey: "os", weekday: "FRIDAY", startTime: "09:00", endTime: "10:30", room: "112" },
    { subjectKey: "math", weekday: "FRIDAY", startTime: "11:00", endTime: "12:30", room: "301" },
    { subjectKey: "dl", weekday: "FRIDAY", startTime: "14:00", endTime: "16:00", room: "Lab 3", type: "LAB" },
    { subjectKey: null, title: "Project group", weekday: "SATURDAY", startTime: "10:00", endTime: "12:00", type: "OTHER" },
  ];

  await prisma.timetableEntry.createMany({
    data: timetable.map((entry) => ({
      userId,
      subjectId: entry.subjectKey ? id(entry.subjectKey) : null,
      title: entry.title ?? null,
      weekday: entry.weekday,
      startTime: entry.startTime,
      endTime: entry.endTime,
      room: entry.room ?? null,
      instructor: entry.subjectKey
        ? (SUBJECTS.find((s) => s.key === entry.subjectKey)?.instructor ?? null)
        : null,
      type: entry.type ?? "CLASS",
    })),
  });

  // ── Assignments ───────────────────────────────────────────────────────────
  const assignments: {
    subjectKey: string;
    title: string;
    description?: string;
    due: Date;
    priority: Priority;
    status: AssignmentStatus;
    completedDaysAgo?: number;
    submissionUrl?: string;
  }[] = [
    {
      subjectKey: "os",
      title: "Process scheduling report",
      description:
        "Compare round-robin, SJF and multilevel feedback queues on the provided trace. Six pages plus the simulation output.",
      due: atTime(-2, 23, 59),
      priority: "HIGH",
      status: "PENDING", // overdue
    },
    {
      subjectKey: "db",
      title: "Database normalization worksheet",
      description:
        "Normalise the given schema to BCNF and justify each decomposition step.",
      due: atTime(1, 23, 59),
      priority: "HIGH",
      status: "IN_PROGRESS",
      submissionUrl: "https://example.edu/portal/cs301/assignment-4",
    },
    {
      subjectKey: "dl",
      title: "CNN architecture comparison",
      description:
        "Train ResNet-18 and a small VGG variant on CIFAR-10, then write up the accuracy against compute trade-off.",
      due: atTime(4, 18, 0),
      priority: "MEDIUM",
      status: "PENDING",
    },
    {
      subjectKey: "net",
      title: "Socket programming exercise",
      description:
        "Implement a concurrent TCP echo server and a client that stress-tests it.",
      due: atTime(6, 23, 59),
      priority: "MEDIUM",
      status: "PENDING",
    },
    {
      subjectKey: "math",
      title: "Graph theory problem set 3",
      description: "Problems 1 to 14 from the handout, including the planarity proofs.",
      due: atTime(9, 23, 59),
      priority: "LOW",
      status: "PENDING",
    },
    {
      subjectKey: "math",
      title: "Graph theory problem set 2",
      due: atTime(-6, 23, 59),
      priority: "MEDIUM",
      status: "COMPLETED",
      completedDaysAgo: 7,
    },
    {
      subjectKey: "db",
      title: "ER modelling case study",
      due: atTime(-12, 23, 59),
      priority: "MEDIUM",
      status: "COMPLETED",
      completedDaysAgo: 13,
    },
    {
      subjectKey: "dl",
      title: "Backpropagation by hand",
      due: atTime(-1, 23, 59),
      priority: "LOW",
      status: "COMPLETED",
      completedDaysAgo: 0, // completed today — feeds the "completed today" tile
    },
  ];

  for (const assignment of assignments) {
    await prisma.assignment.create({
      data: {
        userId,
        subjectId: id(assignment.subjectKey),
        title: assignment.title,
        description: assignment.description ?? null,
        dueDate: assignment.due,
        priority: assignment.priority,
        status: assignment.status,
        submissionUrl: assignment.submissionUrl ?? null,
        completedAt:
          assignment.status === "COMPLETED"
            ? atTime(-(assignment.completedDaysAgo ?? 0), 16, 30)
            : null,
      },
    });
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────
  await prisma.task.createMany({
    data: [
      {
        userId,
        title: "Submit scholarship form",
        description: "Merit renewal — needs last semester's transcript attached.",
        dueDate: atTime(-3, 17, 0),
        priority: "HIGH",
        status: "PENDING", // overdue
      },
      {
        userId,
        title: "Prepare presentation slides",
        description: "Ten minutes on distributed consensus for the seminar.",
        dueDate: atTime(2, 20, 0),
        priority: "HIGH",
        status: "PENDING",
      },
      {
        userId,
        title: "Read Chapter 5 — Deadlocks",
        dueDate: atTime(0, 21, 0),
        priority: "MEDIUM",
        status: "PENDING",
      },
      {
        userId,
        title: "Meet project group",
        description:
          "Split the networking assignment and agree on the interfaces.",
        dueDate: atTime(3, 16, 0),
        priority: "MEDIUM",
        status: "PENDING",
      },
      {
        userId,
        title: "Back up lab notebooks",
        priority: "LOW",
        status: "PENDING", // no due date — an open to-do, not a deadline
      },
      {
        userId,
        title: "Return library books",
        dueDate: atTime(-1, 12, 0),
        priority: "MEDIUM",
        status: "COMPLETED",
        completedAt: atTime(0, 9, 15), // completed today
      },
      {
        userId,
        title: "Email Dr. Menon about the lab slot",
        dueDate: atTime(-2, 12, 0),
        priority: "LOW",
        status: "COMPLETED",
        completedAt: atTime(0, 11, 5), // completed today
      },
    ],
  });

  // ── Exams ─────────────────────────────────────────────────────────────────
  const exams: {
    subjectKey: string;
    name: string;
    type: ExamType;
    at: Date;
    durationMinutes: number;
    location: string;
    notes?: string;
  }[] = [
    {
      subjectKey: "dl",
      name: "Deep Learning Final",
      type: "FINAL",
      at: atTime(5, 9, 0),
      durationMinutes: 180,
      location: "Hall A",
      notes:
        "Covers everything from convolutions onward. One A4 sheet of notes allowed.",
    },
    {
      subjectKey: "os",
      name: "Operating Systems Midterm 2",
      type: "MIDTERM",
      at: atTime(9, 14, 0),
      durationMinutes: 120,
      location: "Hall C",
      notes: "Scheduling, synchronisation and deadlocks.",
    },
    {
      subjectKey: "db",
      name: "Database Systems Practical",
      type: "PRACTICAL",
      at: atTime(14, 10, 0),
      durationMinutes: 150,
      location: "Lab 2",
      notes: "Query writing and index tuning on the sample warehouse schema.",
    },
    {
      subjectKey: "math",
      name: "Discrete Mathematics Quiz 4",
      type: "QUIZ",
      at: atTime(21, 11, 0),
      durationMinutes: 45,
      location: "Room 301",
    },
    {
      subjectKey: "net",
      name: "Computer Networks Midterm 1",
      type: "MIDTERM",
      at: atTime(-16, 10, 0),
      durationMinutes: 120,
      location: "Hall B",
      notes: "Completed — marks recorded under Marks & Grades.",
    },
  ];

  for (const exam of exams) {
    await prisma.exam.create({
      data: {
        userId,
        subjectId: id(exam.subjectKey),
        name: exam.name,
        type: exam.type,
        examDate: exam.at,
        durationMinutes: exam.durationMinutes,
        location: exam.location,
        notes: exam.notes ?? null,
      },
    });
  }

  // ── Assessments ───────────────────────────────────────────────────────────
  // Four subjects use weightage; Discrete Mathematics is deliberately
  // unweighted, so both branches of the score calculation are exercised.
  const assessments: {
    subjectKey: string;
    name: string;
    type: AssessmentType;
    obtained: number;
    max: number;
    weightage: number;
    daysAgo: number;
  }[] = [
    { subjectKey: "db", name: "Quiz 1", type: "QUIZ", obtained: 17, max: 20, weightage: 10, daysAgo: 46 },
    { subjectKey: "db", name: "Midterm 1", type: "MIDTERM", obtained: 41, max: 50, weightage: 25, daysAgo: 30 },
    { subjectKey: "db", name: "ER modelling case study", type: "ASSIGNMENT", obtained: 22, max: 25, weightage: 10, daysAgo: 12 },

    { subjectKey: "math", name: "Problem set 1", type: "ASSIGNMENT", obtained: 18, max: 20, weightage: 0, daysAgo: 48 },
    { subjectKey: "math", name: "Problem set 2", type: "ASSIGNMENT", obtained: 16, max: 20, weightage: 0, daysAgo: 26 },
    { subjectKey: "math", name: "Quiz 3", type: "QUIZ", obtained: 12, max: 15, weightage: 0, daysAgo: 10 },

    { subjectKey: "dl", name: "Lab 1 — Perceptrons", type: "PRACTICAL", obtained: 19, max: 20, weightage: 10, daysAgo: 40 },
    { subjectKey: "dl", name: "Midterm", type: "MIDTERM", obtained: 33, max: 50, weightage: 30, daysAgo: 21 },

    { subjectKey: "os", name: "Midterm 1", type: "MIDTERM", obtained: 28, max: 50, weightage: 25, daysAgo: 34 },
    { subjectKey: "os", name: "Assignment 1", type: "ASSIGNMENT", obtained: 18, max: 25, weightage: 10, daysAgo: 19 },

    { subjectKey: "net", name: "Midterm 1", type: "MIDTERM", obtained: 44, max: 50, weightage: 30, daysAgo: 16 },
    { subjectKey: "net", name: "Lab record", type: "PRACTICAL", obtained: 23, max: 25, weightage: 15, daysAgo: 8 },
  ];

  await prisma.assessment.createMany({
    data: assessments.map((a) => ({
      userId,
      subjectId: id(a.subjectKey),
      name: a.name,
      type: a.type,
      marksObtained: a.obtained,
      maxMarks: a.max,
      weightage: a.weightage,
      date: calendarDate(-a.daysAgo),
    })),
  });

  // ── Notes ─────────────────────────────────────────────────────────────────
  await prisma.note.createMany({
    data: [
      {
        userId,
        subjectId: id("db"),
        title: "Normal forms, 1NF to BCNF",
        content: [
          "1NF — every attribute holds a single atomic value; no repeating groups.",
          "2NF — 1NF, and no non-key attribute depends on part of a composite key.",
          "3NF — 2NF, and no transitive dependency between non-key attributes.",
          "BCNF — for every dependency X -> Y, X must be a superkey.",
          "",
          "Worth remembering: BCNF can cost you dependency preservation. 3NF always",
          "preserves dependencies, BCNF does not, which is why 3NF survives in practice.",
        ].join("\n"),
      },
      {
        userId,
        subjectId: id("os"),
        title: "Deadlock — the four conditions",
        content: [
          "All four must hold at once:",
          "  1. Mutual exclusion",
          "  2. Hold and wait",
          "  3. No preemption",
          "  4. Circular wait",
          "",
          "Prevention breaks one of them by design. Avoidance (the Banker's algorithm)",
          "keeps the system in a safe state. Detection lets it happen and recovers",
          "afterwards. Most real systems simply ignore it.",
        ].join("\n"),
      },
      {
        userId,
        subjectId: id("dl"),
        title: "Why residual connections help",
        content: [
          "A residual block learns F(x) + x rather than F(x) directly.",
          "",
          "The gradient reaches earlier layers through the identity path, so it does not",
          "have to survive multiplication by every intermediate Jacobian. That is what",
          "makes very deep stacks trainable — it is about gradient flow, not capacity.",
        ].join("\n"),
      },
      {
        userId,
        subjectId: id("math"),
        title: "Planarity — quick checks",
        content: [
          "Euler: for a connected planar graph, V - E + F = 2.",
          "Corollary: a simple planar graph with V >= 3 has E <= 3V - 6.",
          "If the graph is triangle-free, E <= 2V - 4.",
          "",
          "Kuratowski: a graph is planar if and only if it contains no subdivision of",
          "K5 or K3,3. The edge bound is the fast way to rule planarity out in an exam.",
        ].join("\n"),
      },
      {
        userId,
        subjectId: id("net"),
        title: "TCP congestion control phases",
        content: [
          "Slow start — cwnd doubles each RTT until it reaches ssthresh.",
          "Congestion avoidance — cwnd grows by roughly one MSS per RTT.",
          "Fast retransmit — three duplicate ACKs trigger a resend without waiting.",
          "Fast recovery — halve cwnd instead of dropping back to one.",
        ].join("\n"),
      },
      {
        userId,
        subjectId: null,
        title: "Exam week plan",
        content: [
          "Deep Learning is first, so it gets the next four evenings.",
          "The Operating Systems midterm is four days after that — revise scheduling",
          "and deadlocks in the gap, since those are the weakest topics right now.",
          "",
          "Operating Systems attendance is below target: do not miss any more classes.",
        ].join("\n"),
      },
    ],
  });

  // ── Study sessions ────────────────────────────────────────────────────────
  // This week (relative to Monday) plus five previous weeks, so the weekly trend
  // chart has a real shape rather than a single bar.
  const mondayOffset = -daysSinceMonday();

  const thisWeek: {
    subjectKey: string;
    dayOffset: number;
    start: [number, number];
    end: [number, number];
    topic: string;
  }[] = [
    { subjectKey: "dl", dayOffset: 0, start: [19, 0], end: [21, 0], topic: "Convolution arithmetic" },
    { subjectKey: "db", dayOffset: 1, start: [16, 30], end: [18, 0], topic: "Normalization practice" },
    { subjectKey: "os", dayOffset: 1, start: [20, 0], end: [21, 30], topic: "Scheduling algorithms" },
    { subjectKey: "math", dayOffset: 2, start: [17, 0], end: [18, 30], topic: "Graph colouring" },
    { subjectKey: "dl", dayOffset: 3, start: [18, 0], end: [20, 30], topic: "Backpropagation by hand" },
    { subjectKey: "net", dayOffset: 4, start: [15, 0], end: [16, 30], topic: "Socket programming" },
    // Deliberately crosses midnight: the duration must still come out as 90 minutes.
    { subjectKey: "os", dayOffset: 4, start: [23, 30], end: [1, 0], topic: "Deadlock detection" },
  ];

  const sessions: {
    userId: string;
    subjectId: string;
    topic: string;
    startedAt: Date;
    endedAt: Date;
  }[] = [];

  for (const session of thisWeek) {
    const offset = mondayOffset + session.dayOffset;
    // Only seed days that have already happened.
    if (offset > 0) continue;

    const startedAt = atTime(offset, session.start[0], session.start[1]);
    let endedAt = atTime(offset, session.end[0], session.end[1]);
    if (endedAt <= startedAt) {
      endedAt = new Date(endedAt.getTime() + 86_400_000);
    }

    sessions.push({
      userId,
      subjectId: id(session.subjectKey),
      topic: session.topic,
      startedAt,
      endedAt,
    });
  }

  // Five earlier weeks, trending gently upward towards exam season.
  const previousWeeks = [
    { weeksAgo: 5, sessionsPerWeek: 3, minutes: 90 },
    { weeksAgo: 4, sessionsPerWeek: 4, minutes: 90 },
    { weeksAgo: 3, sessionsPerWeek: 4, minutes: 105 },
    { weeksAgo: 2, sessionsPerWeek: 5, minutes: 105 },
    { weeksAgo: 1, sessionsPerWeek: 6, minutes: 120 },
  ];

  const topics = [
    "Revision",
    "Problem sets",
    "Lecture catch-up",
    "Lab preparation",
    "Past papers",
    "Reading",
  ];

  for (const week of previousWeeks) {
    for (let i = 0; i < week.sessionsPerWeek; i += 1) {
      const dayOffset = mondayOffset - week.weeksAgo * 7 + (i % 6);
      const startHour = 16 + (i % 3);
      const startedAt = atTime(dayOffset, startHour, 0);
      const endedAt = new Date(startedAt.getTime() + week.minutes * 60_000);

      sessions.push({
        userId,
        subjectId: id(SUBJECTS[i % SUBJECTS.length].key),
        topic: topics[i % topics.length],
        startedAt,
        endedAt,
      });
    }
  }

  await prisma.studySession.createMany({ data: sessions });

  // ── Summary ───────────────────────────────────────────────────────────────
  const counts = {
    subjects: await prisma.subject.count({ where: { userId } }),
    assignments: await prisma.assignment.count({ where: { userId } }),
    tasks: await prisma.task.count({ where: { userId } }),
    exams: await prisma.exam.count({ where: { userId } }),
    timetable: await prisma.timetableEntry.count({ where: { userId } }),
    attendance: await prisma.attendanceRecord.count({ where: { userId } }),
    notes: await prisma.note.count({ where: { userId } }),
    assessments: await prisma.assessment.count({ where: { userId } }),
    studySessions: await prisma.studySession.count({ where: { userId } }),
  };

  await prisma.account.create({
    data: {
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      // The library owns this value and matches on it at sign-in. Hard-coding
      // a plausible-looking string produces a row that looks right in the
      // database and that sign-in silently cannot find.
      issuer: createLocalAccountIssuer("credential"),
      password: await hashPassword(STUDENT_PASSWORD),
    },
  });

  console.log(`Seeded ${user.name} <${user.email}>`);
  console.log(`  log in with  ${STUDENT_EMAIL} / ${STUDENT_PASSWORD}`);
  for (const [label, count] of Object.entries(counts)) {
    console.log(`  ${label.padEnd(14)} ${count}`);
  }
}

/**
 * Spreads `absences` absent slots evenly through `total` classes, so a subject
 * below target does not look like the student simply stopped attending.
 */
function pickAbsentSlots(total: number, absences: number): Set<number> {
  const slots = new Set<number>();
  if (absences <= 0 || total <= 0) return slots;

  const stride = total / absences;
  for (let i = 0; i < absences; i += 1) {
    slots.add(Math.min(total - 1, Math.floor(i * stride + stride / 2)));
  }
  return slots;
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
