import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import {
  DEFAULT_GRADING_SCALE,
  parseGradingScale,
  type GradeBand,
} from "@/lib/calculations/marks";
import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import type { ThemePreference } from "@/generated/prisma/enums";

/**
 * Who "I" am — the authorization boundary for the whole application.
 *
 * Every query in `src/lib/db/queries.ts` and every mutation in `src/actions`
 * scopes on the id this returns, and that id comes from a signed session cookie
 * the server verifies against a session row. Nothing here reads a user id from
 * a URL, a form field, a header or a request body, so there is no id for a
 * caller to tamper with: a request either carries a valid session or it gets
 * nothing.
 *
 * That is why hiding the navigation is not the security model. A hand-crafted
 * POST to a server action reaches this same function, gets the same
 * session-derived id, and its `where` clause therefore cannot match another
 * student's rows.
 */

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
 * The session behind the current request, or null.
 *
 * Cached per request, so a page that checks the session in six places still
 * verifies it once.
 */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/**
 * The signed-in student, or null when the request carries no valid session.
 *
 * Use this only where "signed out" is a legitimate outcome — the login and
 * signup pages, and the shell choosing which navigation to render. Data access
 * uses {@link requireUser}, which cannot return null.
 */
export const getCurrentUserOrNull = cache(
  async (): Promise<CurrentUser | null> => {
    const session = await getSession();
    if (!session?.user?.id) return null;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      // Named columns, not a whole row: the password hash lives on Account, and
      // selecting explicitly means a field added later cannot leak into a
      // payload by accident.
      select: {
        id: true,
        name: true,
        email: true,
        settings: {
          select: {
            collegeName: true,
            program: true,
            semester: true,
            attendanceTargetPercent: true,
            weeklyStudyGoalMinutes: true,
            gradingScale: true,
            theme: true,
          },
        },
      },
    });

    // The session referenced a user who no longer exists — a deleted account
    // whose cookie is still in the wild. Treat it as signed out.
    if (!user) return null;

    // Settings are created in the same transaction as the user, so this is a
    // repair path for rows that predate authentication, not a routine one.
    const settings =
      user.settings ??
      (await prisma.userSettings.create({
        data: { userId: user.id, gradingScale: DEFAULT_GRADING_SCALE },
      }));

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
  },
);

/**
 * The signed-in student, or a redirect to the login page.
 *
 * This is what the data layer uses. It never returns null, so a query cannot
 * accidentally run unscoped: there is no "no user" branch for a caller to
 * forget, and the type system will not let one be written.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUserOrNull();
  if (!user) redirect("/login");
  return user;
}

/** The name the twenty existing call sites already use. */
export const getCurrentUser = requireUser;

export async function getCurrentUserId(): Promise<string> {
  return (await requireUser()).id;
}
