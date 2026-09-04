import "dotenv/config";

import { createInterface } from "node:readline";

import { PrismaPg } from "@prisma/adapter-pg";
import { addDays, format, set, startOfWeek } from "date-fns";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { APP_TIME_ZONE, WEEK_STARTS_ON, inAppZone } from "../src/lib/date.js";
import type {
  AssessmentType,
  AttendanceStatus,
  AssignmentStatus,
  ExamType,
  Priority,
  TaskStatus,
  TimetableEntryType,
  Weekday,
} from "../src/generated/prisma/enums.js";

/**
 * Populate ONE existing account with realistic demo data.
 *
 * This is not the seed. The seed owns a database: it deletes its user and lets
 * the cascade clear everything, which is right for a disposable local database
 * and catastrophic anywhere else. This script owns nothing. It adds rows to an
 * account that already exists and never removes any.
 *
 * ## The guarantees, and how they are enforced
 *
 *  - **No deletes, ever.** There is no `delete`, `deleteMany`, `DROP` or
 *    `TRUNCATE` anywhere in this file. Grep it.
 *  - **One user.** Every row written carries the resolved `userId`, and the
 *    script refuses to start unless exactly one user matches the target email.
 *    No other account's rows are read, written, or referenced.
 *  - **No overwriting.** It refuses to run if the target already owns academic
 *    records, because a second run would silently double every subject and
 *    duplicate the dashboard. `--append` opts out of that check deliberately.
 *  - **Settings are updated, not replaced.** The account already has a
 *    UserSettings row; its profile fields are filled in and the grading scale
 *    left alone unless it is empty.
 *  - **All or nothing.** Everything happens in one transaction, so a failure
 *    halfway leaves the account exactly as it was.
 *
 * ## Dates
 *
 * Every date is computed relative to now, on the app's calendar
 * (Asia/Kolkata — see src/lib/date.ts), so the dashboard is populated whenever
 * this runs rather than frozen at the moment it was written. The data is shaped
 * to exercise every state the UI can show: an overdue assignment, one due
 * tomorrow, attendance below target in exactly one subject, a past exam and
 * several upcoming, and study sessions across this week and the previous five.
 *
 * ## Usage
 *
 *   npm run demo:data -- --email demo@campivo.app --dry-run
 *   npm run demo:data -- --email demo@campivo.app
 */

// ── CLI ──────────────────────────────────────────────────────────────────────

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const TARGET_EMAIL = (arg("email") ?? "demo@campivo.app").trim().toLowerCase();
const DRY_RUN = flag("dry-run");
const APPEND = flag("append");

/**
 * Neon publishes a pooled endpoint (host contains `-pooler`) and a direct one.
 * The app wants the pooled endpoint; one long write transaction wants the
 * direct one. The host is rewritten here, in this process only — `.env` is left
 * exactly as it is. Pass `--pooled` to opt out.
 */
function connectionString(): { url: string; rewritten: boolean } {
  const raw = process.env.DATABASE_URL ?? "";
  if (!raw || flag("pooled")) return { url: raw, rewritten: false };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { url: raw, rewritten: false };
  }
  if (!url.hostname.includes("-pooler")) return { url: raw, rewritten: false };
  url.hostname = url.hostname.replace("-pooler", "");
  return { url: url.toString(), rewritten: true };
}

const CONNECTION = connectionString();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: CONNECTION.url, max: 5 }),
});

/**
 * Prisma's defaults are 2s to acquire a connection and 5s to run the
 * transaction. Both are wrong here. The connection has sat idle through a
 * confirmation prompt, and re-establishing one to Neon measured 2–4 seconds
 * from here; and this transaction writes two hundred rows across an ocean.
 */
const TRANSACTION_OPTIONS = { maxWait: 20_000, timeout: 120_000 };

// ── Dates, on the app's calendar ─────────────────────────────────────────────

const NOW = new Date();
const TODAY = inAppZone(NOW);

/** Midnight `offset` days from today, in the app's zone. */
const day = (offset: number) => addDays(TODAY, offset);

/** An instant at a wall-clock time, `offset` days from today, in the app's zone. */
function at(offset: number, hours: number, minutes = 0): Date {
  return new Date(
    set(day(offset), { hours, minutes, seconds: 0, milliseconds: 0 }).getTime(),
  );
}

/** UTC midnight, the form a Postgres `date` column expects. */
const calendarDate = (offset: number) =>
  new Date(`${format(day(offset), "yyyy-MM-dd")}T00:00:00.000Z`);

/** Indexed by `Date.getDay()`, so Sunday first. */
const WEEKDAYS: Weekday[] = [
  "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY",
];

/** Days back to the most recent Monday (0 if today is Monday). */
const daysSinceMonday = () => (TODAY.getDay() + 6) % 7;

// ── The data ─────────────────────────────────────────────────────────────────

type SubjectSpec = {
  key: string;
  name: string;
  code: string;
  credits: number;
  instructor: string;
  color: string;
  /** Attendance shape: total classes held, and how many were missed. */
  held: number;
  missed: number;
};

/**
 * Five subjects. Four sit comfortably above the 75% target and one — Operating
 * Systems at 22/30 — sits below it, so the attendance warning, the "classes
 * needed to recover" maths and the red state on the dashboard all have
 * something real to describe.
 */
const SUBJECTS: SubjectSpec[] = [
  { key: "db",  name: "Database Systems",  code: "CS301", credits: 4, instructor: "Dr. Meera Iyer",     color: "indigo", held: 32, missed: 3 },
  { key: "ma",  name: "Mathematics",       code: "MA201", credits: 4, instructor: "Prof. Anil Deshmukh", color: "amber",  held: 28, missed: 5 },
  { key: "dl",  name: "Deep Learning",     code: "CS402", credits: 3, instructor: "Dr. Kavya Rao",       color: "violet", held: 26, missed: 6 },
  { key: "os",  name: "Operating Systems", code: "CS303", credits: 4, instructor: "Dr. Rahul Nair",      color: "rose",   held: 30, missed: 8 },
  { key: "net", name: "Computer Networks", code: "CS304", credits: 3, instructor: "Prof. Sneha Kulkarni", color: "teal",   held: 24, missed: 3 },
];

type AssignmentSpec = {
  subject: string;
  title: string;
  description: string;
  dueOffset: number;
  dueHour: number;
  priority: Priority;
  status: AssignmentStatus;
  completedOffset?: number;
};

const ASSIGNMENTS: AssignmentSpec[] = [
  // Overdue and still open — the state the dashboard shouts about.
  { subject: "os",  title: "Deadlock detection write-up", description: "Banker's algorithm traced over the four sample process tables, with a short note on why detection beats avoidance here.", dueOffset: -2, dueHour: 23, priority: "HIGH", status: "PENDING" },
  // Due tomorrow — the "Due soon" card.
  { subject: "db",  title: "Database normalization", description: "Normalise the given library schema to BCNF. Show each functional dependency and every decomposition step.", dueOffset: 1, dueHour: 23, priority: "HIGH", status: "IN_PROGRESS" },
  // Due later this week.
  { subject: "dl",  title: "CNN architecture comparison", description: "Train ResNet-18 and a small VGG on CIFAR-10 and compare accuracy against parameter count.", dueOffset: 4, dueHour: 18, priority: "MEDIUM", status: "PENDING" },
  { subject: "net", title: "Subnetting worksheet", description: "Twelve VLSM problems. Show the address block, mask and usable host range for each.", dueOffset: 6, dueHour: 17, priority: "MEDIUM", status: "PENDING" },
  { subject: "ma",  title: "Probability problem set 6", description: "Bayes' theorem and conditional independence, questions 1 to 14.", dueOffset: 9, dueHour: 23, priority: "LOW", status: "PENDING" },
  // Completed.
  { subject: "db",  title: "ER diagram for the hostel system", description: "Entities, relationships and cardinalities for the hostel allocation case study.", dueOffset: -9, dueHour: 23, priority: "MEDIUM", status: "COMPLETED", completedOffset: -10 },
  { subject: "ma",  title: "Linear algebra problem set 5", description: "Eigenvalues, eigenvectors and diagonalisation.", dueOffset: -14, dueHour: 23, priority: "MEDIUM", status: "COMPLETED", completedOffset: -15 },
  { subject: "net", title: "Packet capture report", description: "Annotated Wireshark capture of a TCP handshake and teardown.", dueOffset: -5, dueHour: 17, priority: "LOW", status: "COMPLETED", completedOffset: -6 },
];

type TaskSpec = {
  title: string;
  description?: string;
  dueOffset: number | null;
  priority: Priority;
  status: TaskStatus;
  completedOffset?: number;
};

const TASKS: TaskSpec[] = [
  { title: "Submit scholarship form", description: "Merit renewal — needs last semester's grade card attached.", dueOffset: -1, priority: "HIGH", status: "PENDING" },
  { title: "Prepare DBMS presentation", description: "Ten minutes on query optimisation for Thursday's tutorial.", dueOffset: 3, priority: "HIGH", status: "PENDING" },
  { title: "Read Chapter 5 — Virtual memory", dueOffset: 2, priority: "MEDIUM", status: "PENDING" },
  { title: "Meet project group", description: "Divide the Deep Learning term project before the reviews open.", dueOffset: 1, priority: "MEDIUM", status: "PENDING" },
  { title: "Return library books", dueOffset: 5, priority: "LOW", status: "PENDING" },
  { title: "Back up semester notes", dueOffset: 0, priority: "LOW", status: "COMPLETED", completedOffset: 0 },
  { title: "Pay hostel mess bill", dueOffset: -3, priority: "MEDIUM", status: "COMPLETED", completedOffset: -3 },
];

type ExamSpec = {
  subject: string;
  name: string;
  type: ExamType;
  offset: number;
  hour: number;
  minutes: number;
  duration: number;
  location: string;
  notes?: string;
};

const EXAMS: ExamSpec[] = [
  { subject: "dl",  name: "Deep Learning — Midterm",   type: "MIDTERM",   offset: 5,   hour: 9,  minutes: 0,  duration: 120, location: "Hall B, Block 2", notes: "Units 1–4. Closed book; one A4 formula sheet allowed." },
  { subject: "db",  name: "DBMS Quiz 3",               type: "QUIZ",      offset: 9,   hour: 11, minutes: 0,  duration: 45,  location: "Room 204" },
  { subject: "os",  name: "Operating Systems — Practical", type: "PRACTICAL", offset: 16, hour: 14, minutes: 0, duration: 180, location: "Systems Lab 1", notes: "Bring the shell assignment on a USB drive." },
  { subject: "ma",  name: "Mathematics — Final",       type: "FINAL",     offset: 27,  hour: 9,  minutes: 30, duration: 180, location: "Exam Hall A" },
  // Already sat — proves the "Completed" countdown state.
  { subject: "net", name: "Computer Networks Quiz 2",  type: "QUIZ",      offset: -11, hour: 10, minutes: 0,  duration: 45,  location: "Room 301" },
];

type SlotSpec = {
  weekday: number; // 0 = Monday
  subject: string | null;
  title?: string;
  start: string;
  end: string;
  room: string;
  type: TimetableEntryType;
};

const TIMETABLE: SlotSpec[] = [
  { weekday: 0, subject: "db",  start: "09:00", end: "10:00", room: "Room 204",     type: "CLASS" },
  { weekday: 0, subject: "ma",  start: "11:00", end: "12:00", room: "Room 301",     type: "CLASS" },
  { weekday: 0, subject: "os",  start: "14:00", end: "16:00", room: "Systems Lab 1", type: "LAB" },
  { weekday: 1, subject: "dl",  start: "10:00", end: "11:00", room: "Hall B",       type: "CLASS" },
  { weekday: 1, subject: "net", start: "11:15", end: "12:15", room: "Room 108",     type: "CLASS" },
  { weekday: 1, subject: "db",  start: "15:00", end: "17:00", room: "DB Lab",       type: "LAB" },
  { weekday: 2, subject: "ma",  start: "09:00", end: "10:00", room: "Room 301",     type: "CLASS" },
  { weekday: 2, subject: "os",  start: "10:15", end: "11:15", room: "Room 207",     type: "CLASS" },
  { weekday: 2, subject: "dl",  start: "14:00", end: "16:00", room: "AI Lab",       type: "LAB" },
  { weekday: 3, subject: "db",  start: "09:00", end: "10:00", room: "Room 204",     type: "CLASS" },
  { weekday: 3, subject: "net", start: "10:15", end: "11:15", room: "Room 108",     type: "CLASS" },
  { weekday: 3, subject: null, title: "Group project time", start: "16:00", end: "18:00", room: "Library, Level 3", type: "STUDY" },
  { weekday: 4, subject: "os",  start: "09:00", end: "10:00", room: "Room 207",     type: "CLASS" },
  { weekday: 4, subject: "ma",  start: "11:00", end: "12:00", room: "Room 301",     type: "CLASS" },
  { weekday: 4, subject: "dl",  start: "14:00", end: "15:00", room: "Hall B",       type: "CLASS" },
  { weekday: 5, subject: null, title: "Revision block", start: "10:00", end: "12:00", room: "Reading Room", type: "STUDY" },
];

type NoteSpec = { subject: string | null; title: string; content: string; agoDays: number };

const NOTES: NoteSpec[] = [
  { subject: "db", title: "Normal forms, in one place", agoDays: 2, content: "1NF — atomic values, no repeating groups.\n2NF — 1NF plus no partial dependency on part of a composite key.\n3NF — 2NF plus no transitive dependency on a non-key attribute.\nBCNF — every determinant is a candidate key.\n\nThe exam question is almost always \"decompose to BCNF and say whether it is lossless\". Check the intersection of the two relations contains a key of at least one of them." },
  { subject: "os", title: "Deadlock — the four conditions", agoDays: 4, content: "Mutual exclusion, hold and wait, no preemption, circular wait. All four must hold at once, so breaking any one prevents deadlock.\n\nBanker's algorithm is avoidance, not prevention: it refuses a request that would leave the system in an unsafe state. Unsafe is not the same as deadlocked — it just means no ordering is guaranteed to finish." },
  { subject: "dl", title: "Why batch norm helps", agoDays: 6, content: "Normalises each mini-batch to zero mean and unit variance, then rescales with learned gamma and beta.\n\nThe original \"internal covariate shift\" story is disputed; the smoother loss landscape explanation holds up better. Practical effect either way: higher learning rates are usable and the network is far less sensitive to initialisation." },
  { subject: "ma", title: "Bayes — the form I keep forgetting", agoDays: 8, content: "P(A|B) = P(B|A) · P(A) / P(B)\n\nExpand the denominator with total probability when B is not given directly:\nP(B) = P(B|A)·P(A) + P(B|¬A)·P(¬A)\n\nThe medical-test question is this every single time." },
  { subject: "net", title: "TCP handshake and teardown", agoDays: 11, content: "Open: SYN → SYN-ACK → ACK.\nClose: FIN → ACK → FIN → ACK, and the initiator then waits 2·MSL in TIME_WAIT so a delayed duplicate cannot land in a new connection on the same port pair." },
  { subject: null, title: "Semester admin", agoDays: 1, content: "- Scholarship renewal closes Friday; grade card must be attached.\n- Library fine waiver runs until month end.\n- Elective registration for next semester opens in three weeks." },
];

type AssessmentSpec = {
  subject: string;
  name: string;
  type: AssessmentType;
  obtained: number;
  max: number;
  weightage: number;
  agoDays: number;
};

/**
 * Four subjects use weighted assessments; Computer Networks deliberately does
 * not, so the unweighted average path is exercised too.
 */
const ASSESSMENTS: AssessmentSpec[] = [
  { subject: "db",  name: "Quiz 1",            type: "QUIZ",       obtained: 17,   max: 20,  weightage: 10, agoDays: 38 },
  { subject: "db",  name: "Quiz 2",            type: "QUIZ",       obtained: 18.5, max: 20,  weightage: 10, agoDays: 24 },
  { subject: "db",  name: "Midterm",           type: "MIDTERM",    obtained: 41,   max: 50,  weightage: 30, agoDays: 17 },
  { subject: "ma",  name: "Quiz 1",            type: "QUIZ",       obtained: 15,   max: 20,  weightage: 10, agoDays: 35 },
  { subject: "ma",  name: "Midterm",           type: "MIDTERM",    obtained: 36,   max: 50,  weightage: 30, agoDays: 19 },
  { subject: "dl",  name: "Assignment 1",      type: "ASSIGNMENT", obtained: 22,   max: 25,  weightage: 15, agoDays: 29 },
  { subject: "dl",  name: "Term project — interim", type: "PROJECT", obtained: 27, max: 30,  weightage: 20, agoDays: 12 },
  { subject: "os",  name: "Quiz 1",            type: "QUIZ",       obtained: 12,   max: 20,  weightage: 10, agoDays: 33 },
  { subject: "os",  name: "Midterm",           type: "MIDTERM",    obtained: 31,   max: 50,  weightage: 30, agoDays: 18 },
  { subject: "os",  name: "Lab practical 1",   type: "PRACTICAL",  obtained: 18,   max: 25,  weightage: 15, agoDays: 9  },
  { subject: "net", name: "Quiz 1",            type: "QUIZ",       obtained: 16,   max: 20,  weightage: 0,  agoDays: 31 },
  { subject: "net", name: "Quiz 2",            type: "QUIZ",       obtained: 18,   max: 20,  weightage: 0,  agoDays: 11 },
];

/** Study sessions: [daysAgo, startHour, minutes, subjectKey, topic]. */
const STUDY: Array<[number, number, number, string, string]> = [
  // This week so far.
  [0, 7,  60,  "db",  "Normalization practice"],
  [0, 18, 90,  "dl",  "CNN architectures"],
  [1, 20, 75,  "os",  "Virtual memory"],
  [2, 8,  45,  "ma",  "Probability revision"],
  [2, 19, 120, "db",  "Query optimisation"],
  [3, 17, 60,  "net", "Subnetting drills"],
  [4, 21, 90,  "dl",  "Backprop by hand"],
  [5, 10, 120, "os",  "Deadlock problems"],
  [6, 16, 60,  "ma",  "Eigenvalues"],
  // Earlier weeks, for the trend chart.
  [8,  19, 90,  "db",  "ER modelling"],
  [10, 20, 60,  "os",  "Scheduling algorithms"],
  [12, 18, 120, "dl",  "Optimisers"],
  [14, 17, 75,  "ma",  "Linear algebra"],
  [16, 20, 90,  "net", "Routing protocols"],
  [19, 19, 60,  "db",  "Transactions and ACID"],
  [21, 18, 120, "os",  "Paging and TLBs"],
  [24, 20, 90,  "dl",  "Regularisation"],
  [27, 17, 60,  "ma",  "Probability basics"],
  [30, 19, 90,  "net", "OSI layers"],
  [33, 20, 75,  "db",  "Indexing"],
];

const SETTINGS = {
  collegeName: "Riverside Institute of Technology",
  program: "B.Tech Computer Science",
  semester: "Semester 5",
  attendanceTargetPercent: 75,
  weeklyStudyGoalMinutes: 15 * 60,
};

// ── Plan ─────────────────────────────────────────────────────────────────────

/**
 * Attendance is generated backwards from today over the subject's own weekday
 * slots, so the records land on days the class actually meets. The absences are
 * spread rather than clustered at one end, which is what makes the percentage
 * move gradually in the history view.
 */
function attendanceFor(spec: SubjectSpec) {
  const slots = TIMETABLE.filter((s) => s.subject === spec.key).map((s) => s.weekday);
  if (slots.length === 0) return [];

  const records: Array<{ offset: number; present: boolean }> = [];
  const absentEvery = spec.missed > 0 ? Math.max(2, Math.floor(spec.held / spec.missed)) : Infinity;

  let offset = -1;
  let taken = 0;
  let guard = 0;
  while (taken < spec.held && guard < 400) {
    guard += 1;
    const weekdayIndex = (day(offset).getDay() + 6) % 7; // 0 = Monday
    if (slots.includes(weekdayIndex)) {
      records.push({ offset, present: taken % absentEvery !== absentEvery - 1 });
      taken += 1;
    }
    offset -= 1;
  }

  // Rebalance so the count of absences matches the spec exactly.
  const absent = records.filter((r) => !r.present).length;
  for (let i = 0; absent > spec.missed && i < records.length; i += 1) {
    if (!records[i].present) { records[i].present = true; break; }
  }
  for (let i = 0; records.filter((r) => !r.present).length < spec.missed && i < records.length; i += 1) {
    if (records[i].present && i % 3 === 1) records[i].present = false;
  }
  return records;
}

function buildPlan() {
  const attendance = Object.fromEntries(SUBJECTS.map((s) => [s.key, attendanceFor(s)]));
  const weekStart = startOfWeek(TODAY, { weekStartsOn: WEEK_STARTS_ON });

  return {
    subjects: SUBJECTS,
    assignments: ASSIGNMENTS,
    tasks: TASKS,
    exams: EXAMS,
    timetable: TIMETABLE,
    notes: NOTES,
    assessments: ASSESSMENTS,
    study: STUDY,
    attendance,
    weekStart,
    counts: {
      subjects: SUBJECTS.length,
      assignments: ASSIGNMENTS.length,
      tasks: TASKS.length,
      exams: EXAMS.length,
      timetableEntries: TIMETABLE.length,
      notes: NOTES.length,
      assessments: ASSESSMENTS.length,
      studySessions: STUDY.length,
      attendanceRecords: Object.values(attendance).reduce((n, r) => n + r.length, 0),
    },
  };
}

function printPlan(plan: ReturnType<typeof buildPlan>) {
  const c = plan.counts;
  const total = Object.values(c).reduce((a, b) => a + b, 0);

  console.log(`\nRows this will INSERT (${total} total), all owned by ${TARGET_EMAIL}:\n`);
  for (const [k, v] of Object.entries(c)) console.log(`  ${k.padEnd(20)} ${v}`);
  console.log(`\n  user_settings        1  (UPDATE of the account's own row, not an insert)`);

  console.log(`\nSubjects and the attendance each will show:\n`);
  for (const s of plan.subjects) {
    const recs = plan.attendance[s.key];
    const present = recs.filter((r) => r.present).length;
    const pct = recs.length ? Math.round((present / recs.length) * 100) : 0;
    const warn = pct < SETTINGS.attendanceTargetPercent ? "  ← below the 75% target" : "";
    console.log(`  ${s.name.padEnd(20)} ${s.code.padEnd(7)} ${String(present).padStart(2)}/${String(recs.length).padEnd(2)} = ${String(pct).padStart(3)}%${warn}`);
  }

  console.log(`\nDeadlines, relative to today (${format(TODAY, "EEE d MMM yyyy")}, ${APP_TIME_ZONE}):\n`);
  for (const a of [...plan.assignments].sort((x, y) => x.dueOffset - y.dueOffset)) {
    const when = a.dueOffset === 0 ? "today" : a.dueOffset < 0 ? `${-a.dueOffset}d ago` : `in ${a.dueOffset}d`;
    const state = a.status === "COMPLETED" ? "done" : a.dueOffset < 0 ? "OVERDUE" : a.status.toLowerCase();
    console.log(`  ${format(day(a.dueOffset), "EEE d MMM")}  ${when.padEnd(8)} ${state.padEnd(11)} ${a.title}`);
  }

  console.log(`\nExams:\n`);
  for (const e of [...plan.exams].sort((x, y) => x.offset - y.offset)) {
    const when = e.offset < 0 ? `${-e.offset}d ago (past)` : e.offset === 0 ? "today" : `in ${e.offset}d`;
    console.log(`  ${format(day(e.offset), "EEE d MMM")}  ${when.padEnd(14)} ${e.name}`);
  }

  console.log(`\nStudy: ${plan.study.length} sessions, ${plan.study.reduce((n, s) => n + s[2], 0)} minutes total.`);
  console.log(`Week beginning ${format(plan.weekStart, "EEE d MMM")} holds ${plan.study.filter((s) => s[0] <= daysSinceMonday()).length} of them.\n`);
}

// ── Write ────────────────────────────────────────────────────────────────────

async function ask(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(prompt, (a) => { rl.close(); r(a.trim()); }));
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");

  const url = new URL(CONNECTION.url);
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  console.log(`\nDatabase: ${url.hostname}${url.pathname}${isLocal ? "  (local)" : "  ← NOT local"}`);
  if (CONNECTION.rewritten) {
    console.log("          using Neon's direct endpoint for this transaction (.env is untouched)");
  }

  const plan = buildPlan();

  // Resolve the target. Exactly one user, matched by email — never by position,
  // never "the first row", so this cannot wander onto another account.
  const user = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    select: {
      id: true, name: true, email: true,
      settings: { select: { id: true, gradingScale: true } },
      _count: {
        select: {
          subjects: true, assignments: true, tasks: true, exams: true,
          timetableEntries: true, attendanceRecords: true, notes: true,
          assessments: true, studySessions: true,
        },
      },
    },
  });

  if (!user) {
    printPlan(plan);
    throw new Error(
      `No user with email ${TARGET_EMAIL} in this database.\n` +
        "  Claim the account first:\n" +
        '      npm run auth:claim -- --user <id> --email demo@campivo.app --name "Lucius Zogratis"',
    );
  }

  const existing = Object.values(user._count).reduce((a, b) => a + b, 0);
  console.log(`Target:   ${user.name} <${user.email}>  (owns ${existing} records)\n`);

  printPlan(plan);

  if (DRY_RUN) {
    console.log("--dry-run: nothing was written.\n");
    return;
  }

  if (existing > 0 && !APPEND) {
    throw new Error(
      `${user.email} already owns ${existing} records.\n` +
        "  Refusing, because running twice would duplicate every subject and leave the\n" +
        "  dashboard showing each one twice. This script never deletes, so it cannot\n" +
        "  clean up after itself.\n\n" +
        "  Pass --append if you genuinely want a second set of rows added alongside.",
    );
  }

  if (!flag("yes")) {
    const answer = await ask('Type "add" to write these rows: ');
    if (answer !== "add") {
      console.log("\nCancelled. Nothing was written.\n");
      return;
    }
  }

  const userId = user.id;

  /*
   * Wake the connection before opening the transaction.
   *
   * The pool has been idle through the confirmation prompt, by which point Neon
   * has usually dropped the connection. Re-establishing it here means that cost
   * is not charged against the transaction's acquisition budget.
   */
  await prisma.$queryRaw`select 1`;

  await prisma.$transaction(async (tx) => {
    // Settings: fill in the profile, and only supply a grading scale if the
    // account somehow has none. An existing scale is the student's own.
    const hasScale = Array.isArray(user.settings?.gradingScale)
      && (user.settings!.gradingScale as unknown[]).length > 0;
    await tx.userSettings.update({
      where: { userId },
      data: {
        ...SETTINGS,
        ...(hasScale ? {} : { gradingScale: DEFAULT_SCALE }),
      },
    });

    /*
     * Subjects go one at a time because everything else needs their generated
     * ids. Five round trips is the unavoidable cost of that.
     */
    const subjectIds: Record<string, string> = {};
    for (const s of SUBJECTS) {
      const row = await tx.subject.create({
        data: {
          userId, name: s.name, code: s.code, credits: s.credits,
          instructor: s.instructor, color: s.color,
        },
        select: { id: true },
      });
      subjectIds[s.key] = row.id;
    }

    /*
     * Everything else goes in one statement per table.
     *
     * Written as a loop of `create` calls this was 214 sequential round trips.
     * Against Neon from here that is roughly 370ms each — about eighty seconds
     * of latency inside a transaction whose default budget is five. `createMany`
     * turns each table into a single INSERT, which is the difference between
     * this working and timing out every time.
     */
    await tx.assignment.createMany({
      data: ASSIGNMENTS.map((a) => ({
        userId, subjectId: subjectIds[a.subject], title: a.title,
        description: a.description,
        dueDate: at(a.dueOffset, a.dueHour, a.dueHour === 23 ? 59 : 0),
        priority: a.priority, status: a.status,
        completedAt: a.completedOffset === undefined ? null : at(a.completedOffset, 20),
      })),
    });

    await tx.task.createMany({
      data: TASKS.map((t) => ({
        userId, title: t.title, description: t.description ?? null,
        dueDate: t.dueOffset === null ? null : at(t.dueOffset, 18),
        priority: t.priority, status: t.status,
        completedAt: t.completedOffset === undefined ? null : at(t.completedOffset, 12),
      })),
    });

    await tx.exam.createMany({
      data: EXAMS.map((e) => ({
        userId, subjectId: subjectIds[e.subject], name: e.name, type: e.type,
        examDate: at(e.offset, e.hour, e.minutes), durationMinutes: e.duration,
        location: e.location, notes: e.notes ?? null,
      })),
    });

    await tx.timetableEntry.createMany({
      data: TIMETABLE.map((s) => ({
        userId,
        subjectId: s.subject ? subjectIds[s.subject] : null,
        title: s.title ?? null,
        weekday: WEEKDAYS[(s.weekday + 1) % 7],
        startTime: s.start, endTime: s.end, room: s.room,
        instructor: s.subject ? SUBJECTS.find((x) => x.key === s.subject)!.instructor : null,
        type: s.type,
      })),
    });

    await tx.attendanceRecord.createMany({
      data: SUBJECTS.flatMap((s) =>
        plan.attendance[s.key].map((r) => ({
          userId, subjectId: subjectIds[s.key], date: calendarDate(r.offset),
          status: (r.present ? "PRESENT" : "ABSENT") as AttendanceStatus,
        })),
      ),
    });

    await tx.note.createMany({
      data: NOTES.map((n) => ({
        userId,
        subjectId: n.subject ? subjectIds[n.subject] : null,
        title: n.title, content: n.content,
      })),
    });

    await tx.assessment.createMany({
      data: ASSESSMENTS.map((a) => ({
        userId, subjectId: subjectIds[a.subject], name: a.name, type: a.type,
        marksObtained: a.obtained, maxMarks: a.max, weightage: a.weightage,
        date: calendarDate(-a.agoDays),
      })),
    });

    await tx.studySession.createMany({
      data: STUDY.map(([agoDays, hour, minutes, subject, topic]) => {
        const startedAt = at(-agoDays, hour);
        return {
          userId, subjectId: subjectIds[subject], topic,
          startedAt, endedAt: new Date(startedAt.getTime() + minutes * 60_000),
        };
      }),
    });
  }, TRANSACTION_OPTIONS);

  const after = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true, email: true,
      _count: {
        select: {
          subjects: true, assignments: true, tasks: true, exams: true,
          timetableEntries: true, attendanceRecords: true, notes: true,
          assessments: true, studySessions: true,
        },
      },
    },
  });

  console.log(`\n✓ ${after!.name} <${after!.email}> now owns:`);
  for (const [k, v] of Object.entries(after!._count)) console.log(`    ${k.padEnd(20)} ${v}`);
  console.log("");
}

/** Only used when the account has no grading scale at all. */
const DEFAULT_SCALE = [
  { grade: "A+", minPercent: 90 },
  { grade: "A", minPercent: 85 },
  { grade: "A-", minPercent: 80 },
  { grade: "B+", minPercent: 75 },
  { grade: "B", minPercent: 70 },
  { grade: "B-", minPercent: 65 },
  { grade: "C+", minPercent: 60 },
  { grade: "C", minPercent: 55 },
  { grade: "D", minPercent: 50 },
  { grade: "F", minPercent: 0 },
];

main()
  .catch((error) => {
    console.error(`\n✗ ${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
