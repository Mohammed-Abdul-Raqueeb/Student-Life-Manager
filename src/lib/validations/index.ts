import { z } from "zod";

import { isValidClockTime, parseCalendarDate, parseLocalDateTime } from "@/lib/date";

/**
 * Every mutation in the app funnels through one of these schemas. Forms parse
 * the same objects client-side for instant feedback, and the server actions
 * parse again before touching the database — client input is never trusted.
 */

// ── Shared field builders ────────────────────────────────────────────────────

const requiredText = (label: string, max = 200) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer.`)
    .optional()
    .transform((value) => (value === "" ? undefined : value));

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === "" ? undefined : value))
  .refine(
    (value) => value === undefined || /^https?:\/\/\S+$/i.test(value),
    "Enter a full URL starting with http:// or https://.",
  );

const cuid = z.string().min(1, "Select an option.");

/** `<input type="date">` value → a UTC-midnight date for a Postgres `date` column. */
const calendarDate = z
  .string()
  .min(1, "Pick a date.")
  .refine((value) => parseCalendarDate(value) !== null, "Enter a valid date.")
  .transform((value) => parseCalendarDate(value) as Date);

const clockTime = z
  .string()
  .min(1, "Pick a time.")
  .refine(isValidClockTime, "Enter a time as HH:MM.");

const dateInput = z
  .string()
  .min(1, "Pick a date.")
  .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), "Enter a valid date.");

const nonNegativeNumber = (label: string) =>
  z.coerce
    .number({ error: `${label} must be a number.` })
    .refine(Number.isFinite, `${label} must be a number.`)
    .min(0, `${label} cannot be negative.`);

// ── Enums (mirrored from the Prisma schema) ──────────────────────────────────

export const priorityEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);
export const assignmentStatusEnum = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
]);
export const taskStatusEnum = z.enum(["PENDING", "COMPLETED"]);
export const examTypeEnum = z.enum([
  "QUIZ",
  "MIDTERM",
  "FINAL",
  "PRACTICAL",
  "VIVA",
  "OTHER",
]);
export const timetableEntryTypeEnum = z.enum(["CLASS", "LAB", "STUDY", "OTHER"]);
export const weekdayEnum = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);
export const attendanceStatusEnum = z.enum(["PRESENT", "ABSENT"]);
export const assessmentTypeEnum = z.enum([
  "ASSIGNMENT",
  "QUIZ",
  "MIDTERM",
  "PROJECT",
  "PRACTICAL",
  "FINAL",
  "OTHER",
]);
export const themeEnum = z.enum(["LIGHT", "DARK", "SYSTEM"]);

// ── Subject ──────────────────────────────────────────────────────────────────

export const subjectSchema = z.object({
  name: requiredText("Subject name", 120),
  code: requiredText("Subject code", 20).transform((value) =>
    value.toUpperCase(),
  ),
  credits: z.coerce
    .number({ error: "Credits must be a number." })
    .int("Credits must be a whole number.")
    .min(0, "Credits cannot be negative.")
    .max(30, "Credits must be 30 or fewer."),
  instructor: optionalText(120),
  color: z.string().trim().min(1).max(24),
});

export type SubjectInput = z.input<typeof subjectSchema>;
export type SubjectValues = z.output<typeof subjectSchema>;

// ── Assignment ───────────────────────────────────────────────────────────────

export const assignmentSchema = z
  .object({
    title: requiredText("Title"),
    description: optionalText(),
    subjectId: cuid,
    dueDate: dateInput,
    dueTime: clockTime,
    priority: priorityEnum,
    status: assignmentStatusEnum,
    submissionUrl: optionalUrl,
  })
  .transform((values, ctx) => {
    const dueAt = parseLocalDateTime(values.dueDate, values.dueTime);
    if (!dueAt) {
      ctx.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Enter a valid due date and time.",
      });
      return z.NEVER;
    }
    return { ...values, dueAt };
  });

export type AssignmentInput = z.input<typeof assignmentSchema>;
export type AssignmentValues = z.output<typeof assignmentSchema>;

// ── Task ─────────────────────────────────────────────────────────────────────

export const taskSchema = z
  .object({
    title: requiredText("Title"),
    description: optionalText(),
    /** Optional: not every task has a deadline. */
    dueDate: z.string().trim().optional(),
    dueTime: z.string().trim().optional(),
    priority: priorityEnum,
    status: taskStatusEnum,
  })
  .transform((values, ctx) => {
    if (!values.dueDate) {
      return { ...values, dueAt: null as Date | null };
    }
    const dueAt = parseLocalDateTime(values.dueDate, values.dueTime || "23:59");
    if (!dueAt) {
      ctx.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Enter a valid due date.",
      });
      return z.NEVER;
    }
    return { ...values, dueAt };
  });

export type TaskInput = z.input<typeof taskSchema>;
export type TaskValues = z.output<typeof taskSchema>;

// ── Exam ─────────────────────────────────────────────────────────────────────

export const examSchema = z
  .object({
    name: requiredText("Exam name"),
    subjectId: cuid,
    type: examTypeEnum,
    examDate: dateInput,
    examTime: clockTime,
    durationMinutes: z
      .union([z.literal(""), z.coerce.number()])
      .optional()
      .transform((value) => (value === "" || value === undefined ? undefined : value))
      .refine(
        (value) => value === undefined || (Number.isFinite(value) && value > 0 && value <= 1440),
        "Duration must be between 1 and 1440 minutes.",
      ),
    location: optionalText(120),
    notes: optionalText(),
  })
  .transform((values, ctx) => {
    const startsAt = parseLocalDateTime(values.examDate, values.examTime);
    if (!startsAt) {
      ctx.addIssue({
        code: "custom",
        path: ["examDate"],
        message: "Enter a valid exam date and time.",
      });
      return z.NEVER;
    }
    return { ...values, startsAt };
  });

export type ExamInput = z.input<typeof examSchema>;
export type ExamValues = z.output<typeof examSchema>;

// ── Timetable entry ──────────────────────────────────────────────────────────

export const timetableEntrySchema = z
  .object({
    subjectId: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value === "" || value === "none" ? undefined : value)),
    title: optionalText(120),
    weekday: weekdayEnum,
    startTime: clockTime,
    endTime: clockTime,
    room: optionalText(60),
    instructor: optionalText(120),
    type: timetableEntryTypeEnum,
  })
  .refine((values) => values.subjectId !== undefined || !!values.title, {
    path: ["subjectId"],
    message: "Pick a subject, or give the entry a title.",
  })
  .refine((values) => values.endTime > values.startTime, {
    path: ["endTime"],
    message: "End time must be after the start time.",
  });

export type TimetableEntryInput = z.input<typeof timetableEntrySchema>;
export type TimetableEntryValues = z.output<typeof timetableEntrySchema>;

// ── Attendance ───────────────────────────────────────────────────────────────

export const attendanceSchema = z.object({
  subjectId: cuid,
  date: calendarDate,
  status: attendanceStatusEnum,
  note: optionalText(200),
});

export type AttendanceInput = z.input<typeof attendanceSchema>;
export type AttendanceValues = z.output<typeof attendanceSchema>;

// ── Note ─────────────────────────────────────────────────────────────────────

export const noteSchema = z.object({
  title: requiredText("Title"),
  content: z
    .string()
    .trim()
    .min(1, "Write something before saving.")
    .max(20_000, "Notes are limited to 20,000 characters."),
  subjectId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === "" || value === "none" ? undefined : value)),
});

export type NoteInput = z.input<typeof noteSchema>;
export type NoteValues = z.output<typeof noteSchema>;

// ── Assessment (marks) ───────────────────────────────────────────────────────

export const assessmentSchema = z
  .object({
    name: requiredText("Assessment name"),
    subjectId: cuid,
    type: assessmentTypeEnum,
    marksObtained: nonNegativeNumber("Marks obtained"),
    maxMarks: z.coerce
      .number({ error: "Maximum marks must be a number." })
      .refine(Number.isFinite, "Maximum marks must be a number.")
      .gt(0, "Maximum marks must be greater than zero."),
    weightage: nonNegativeNumber("Weightage").max(
      100,
      "Weightage cannot exceed 100%.",
    ),
    date: calendarDate,
  })
  .refine((values) => values.marksObtained <= values.maxMarks, {
    path: ["marksObtained"],
    message: "Marks obtained cannot exceed the maximum marks.",
  });

export type AssessmentInput = z.input<typeof assessmentSchema>;
export type AssessmentValues = z.output<typeof assessmentSchema>;

// ── Study session ────────────────────────────────────────────────────────────

/** A single session is capped at 24 hours; anything longer is a data-entry slip. */
const MAX_SESSION_MINUTES = 24 * 60;

export const studySessionSchema = z
  .object({
    subjectId: cuid,
    topic: optionalText(160),
    date: dateInput,
    startTime: clockTime,
    endTime: clockTime,
    /** Lets a session that ends after midnight roll onto the next day. */
    crossesMidnight: z.coerce.boolean().optional().default(false),
    notes: optionalText(),
  })
  .transform((values, ctx) => {
    const startedAt = parseLocalDateTime(values.date, values.startTime);
    let endedAt = parseLocalDateTime(values.date, values.endTime);

    if (!startedAt || !endedAt) {
      ctx.addIssue({
        code: "custom",
        path: ["date"],
        message: "Enter a valid date and time.",
      });
      return z.NEVER;
    }

    // An end time at or before the start means the session ran past midnight.
    if (endedAt.getTime() <= startedAt.getTime()) {
      endedAt = new Date(endedAt.getTime() + 86_400_000);
    }

    const minutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000);

    if (minutes <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "A session must be longer than zero minutes.",
      });
      return z.NEVER;
    }

    if (minutes > MAX_SESSION_MINUTES) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "A single session cannot be longer than 24 hours.",
      });
      return z.NEVER;
    }

    return { ...values, startedAt, endedAt, minutes };
  });

export type StudySessionInput = z.input<typeof studySessionSchema>;
export type StudySessionValues = z.output<typeof studySessionSchema>;

// ── Settings ─────────────────────────────────────────────────────────────────

export const gradeBandSchema = z.object({
  grade: requiredText("Grade label", 8),
  minPercent: z.coerce
    .number({ error: "Minimum percent must be a number." })
    .min(0, "Minimum percent cannot be negative.")
    .max(100, "Minimum percent cannot exceed 100."),
});

export const profileSettingsSchema = z.object({
  name: requiredText("Your name", 120),
  collegeName: optionalText(160),
  program: optionalText(160),
  semester: optionalText(60),
});

export const academicSettingsSchema = z.object({
  attendanceTargetPercent: z.coerce
    .number({ error: "Attendance target must be a number." })
    .int("Attendance target must be a whole number.")
    .min(0, "Attendance target cannot be negative.")
    .max(100, "Attendance target cannot exceed 100%."),
  weeklyStudyGoalHours: z.coerce
    .number({ error: "Weekly study goal must be a number." })
    .min(0, "Weekly study goal cannot be negative.")
    .max(168, "There are only 168 hours in a week."),
});

export const gradingScaleSchema = z
  .object({
    bands: z.array(gradeBandSchema).min(1, "Keep at least one grade band."),
  })
  .refine(
    (values) => {
      const labels = values.bands.map((b) => b.grade.toLowerCase());
      return new Set(labels).size === labels.length;
    },
    { path: ["bands"], message: "Grade labels must be unique." },
  );

export const themeSettingsSchema = z.object({
  theme: themeEnum,
});

export type ProfileSettingsValues = z.output<typeof profileSettingsSchema>;
export type AcademicSettingsValues = z.output<typeof academicSettingsSchema>;
export type GradingScaleValues = z.output<typeof gradingScaleSchema>;
