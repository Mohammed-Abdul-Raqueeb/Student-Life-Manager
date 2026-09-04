import { cache } from "react";

import { prisma } from "@/lib/db/prisma";
import {
  DEFAULT_GRADING_SCALE,
  parseGradingScale,
  type GradeBand,
} from "@/lib/calculations/marks";
import type { ThemePreference } from "@/generated/prisma/enums";

/**
 * Who "I" am.
 *
 * This release is deliberately single-user: there is no login, so the app
 * resolves the one student row in the database (creating it on first run). Every
 * query and mutation still goes through this function and scopes on the id it
 * returns, so adding real authentication later means changing this file — not
 * the twenty callers that depend on it.
 */

const DEFAULT_STUDENT_EMAIL = "student@studentlife.local";
const DEFAULT_STUDENT_NAME = "Student";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  settings: {
    collegeName: string | null;
    program: string | null;
    semester: string | null;
    attendanceTargetPercent: number;
    weeklyStudyGoalMinutes: number;
    gradingScale: GradeBand[];
    theme: ThemePreference;
  };
};

/**
 * Cached per request, so a page that needs the student in six components still
 * makes one query.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const existing = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    include: { settings: true },
  });

  if (existing?.settings) {
    return toCurrentUser(existing, existing.settings);
  }

  // First run (or a user row whose settings were never created).
  const user =
    existing ??
    (await prisma.user.upsert({
      where: { email: DEFAULT_STUDENT_EMAIL },
      update: {},
      create: { email: DEFAULT_STUDENT_EMAIL, name: DEFAULT_STUDENT_NAME },
    }));

  const settings = await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      gradingScale: DEFAULT_GRADING_SCALE,
    },
  });

  return toCurrentUser(user, settings);
});

export async function getCurrentUserId(): Promise<string> {
  return (await getCurrentUser()).id;
}

type UserRow = { id: string; name: string; email: string };
type SettingsRow = {
  collegeName: string | null;
  program: string | null;
  semester: string | null;
  attendanceTargetPercent: number;
  weeklyStudyGoalMinutes: number;
  gradingScale: unknown;
  theme: ThemePreference;
};

function toCurrentUser(user: UserRow, settings: SettingsRow): CurrentUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    settings: {
      collegeName: settings.collegeName,
      program: settings.program,
      semester: settings.semester,
      attendanceTargetPercent: settings.attendanceTargetPercent,
      weeklyStudyGoalMinutes: settings.weeklyStudyGoalMinutes,
      gradingScale: parseGradingScale(settings.gradingScale),
      theme: settings.theme,
    },
  };
}
