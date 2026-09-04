import { NextResponse, type NextRequest } from "next/server";

/**
 * The outer gate.
 *
 * Next 16 calls this a proxy; it is the file that used to be `middleware.ts`.
 * It runs before a protected route renders and turns away requests carrying no
 * session cookie, so a signed-out visitor gets the login page instead of a
 * render that only redirects at the end of it.
 *
 * It is deliberately a *cheap* check and not the security boundary. It reads
 * whether a session cookie is present — it does not verify it, because doing so
 * needs the database and this runs on every matched request. The real
 * enforcement is downstream and independent: `(app)/layout.tsx` requires a
 * verified session, and every query and mutation scopes on the user id derived
 * from it. A forged cookie gets past this line and no further.
 */

/** Mirrors `advanced.cookiePrefix` in lib/auth/server, plus the https variant. */
const SESSION_COOKIES = [
  "campivo.session_token",
  "__Secure-campivo.session_token",
];

const PUBLIC_ROUTES = new Set(["/login", "/signup"]);

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSessionCookie = SESSION_COOKIES.some(
    (name) => request.cookies.get(name)?.value,
  );

  if (PUBLIC_ROUTES.has(pathname)) {
    // The pages themselves re-check with a verified session; this only saves a
    // render for the common case.
    if (hasSessionCookie) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!hasSessionCookie) {
    const login = new URL("/login", request.url);
    // Remember where they were headed, so logging in resumes it rather than
    // dumping everyone on the dashboard.
    if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  /*
   * Everything except Next's own assets and the auth endpoints — those must
   * stay open, or signing in would require being signed in.
   *
   * The double backslashes are load-bearing. Written as a single `\.` this is
   * not an escape JavaScript recognises in a string literal, so it collapses to
   * a bare `.`; the alternative becomes `.*.`, which matches every path, the
   * negative lookahead therefore rejects every path, and the proxy matches
   * nothing at all. It still builds, and Next still lists a proxy in the route
   * table — it simply never runs.
   */
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon\\.ico|.*\\.).*)"],
};
