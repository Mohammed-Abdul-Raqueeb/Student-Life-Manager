import type { Route } from "next";

/**
 * Route builders for the app's dynamic segments.
 *
 * `typedRoutes` is on, so every literal `<Link href="…">` in the app is checked
 * against the real route table at build time — a renamed or deleted page becomes
 * a type error rather than a 404 someone finds later.
 *
 * The one thing it cannot check is a path built from a runtime id: interpolating
 * a `string` produces `/subjects/${string}`, which the generated `Route` union
 * cannot narrow. Rather than scatter `as Route` across every call site, the cast
 * lives here once, next to the literal path it corresponds to — so if
 * `src/app/subjects/[id]/page.tsx` ever moves, this is the single place to fix.
 */

export function subjectPath(id: string): Route {
  return `/subjects/${id}` as Route;
}
