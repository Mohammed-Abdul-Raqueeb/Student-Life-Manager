import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/db/user";

/**
 * Everything behind the login.
 *
 * `requireUser()` redirects to /login when the request carries no valid
 * session, and because a layout wraps every segment beneath it, that one call
 * covers Overview, Today, Subjects, Assignments, Exams, Timetable, Attendance,
 * Notes, Marks and Study Progress without each page repeating the check.
 *
 * It is not the only guard, and is not load-bearing on its own: `middleware.ts`
 * turns unauthenticated requests away before they reach here, and every query
 * and mutation independently scopes on the session-derived user id. This layer
 * exists so a signed-out visitor gets the login page instead of an empty shell.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return <AppShell user={user}>{children}</AppShell>;
}
