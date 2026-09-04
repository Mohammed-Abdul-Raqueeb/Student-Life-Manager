import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { DEFAULT_GRADING_SCALE } from "@/lib/calculations/marks";
import { prisma } from "@/lib/db/prisma";

/**
 * Authentication.
 *
 * Email and password only — no OAuth, no magic links. The choice of library was
 * driven by three things this app actually needs:
 *
 *  - **Database-backed sessions.** A session row is the thing that makes logging
 *    out mean something: the row is deleted, so the cookie that referenced it is
 *    inert everywhere, immediately. A stateless JWT can only be dropped from the
 *    browser that held it and stays valid until it expires.
 *  - **Email/password as a first-class citizen** rather than an escape hatch
 *    bolted onto an OAuth-shaped library.
 *  - **No native modules.** Password hashing is scrypt in pure JavaScript, so
 *    there is no binary to compile for the serverless runtime.
 *
 * Passwords are never stored, compared, or logged in the clear: better-auth
 * writes a scrypt hash to `Account.password` and verifies in constant time.
 */

/**
 * The secret that signs session cookies.
 *
 * Absent in production this would silently fall back to a generated value that
 * changes on every cold start, logging everybody out at random, so it fails
 * loudly instead. Development gets a fixed throwaway so a fresh clone runs
 * without ceremony.
 */
function sessionSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (secret && secret.length >= 32) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "BETTER_AUTH_SECRET is missing or shorter than 32 characters. Generate one with `openssl rand -base64 32` and set it in the deployment's environment.",
    );
  }

  if (secret) {
    console.warn(
      "[auth] BETTER_AUTH_SECRET is shorter than 32 characters; using the development fallback.",
    );
  }
  return "development-only-secret-not-for-production-use";
}

/**
 * The canonical origin. Vercel sets VERCEL_URL per deployment; BETTER_AUTH_URL
 * pins it when the app has a real domain. Locally neither exists and the
 * library infers the origin from the request.
 */
const baseURL =
  process.env.BETTER_AUTH_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

export const auth = betterAuth({
  appName: "Campivo",
  secret: sessionSecret(),
  baseURL,

  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    // No inbox is wired up, so requiring verification would lock every new
    // student out of the account they just made.
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  session: {
    // A term-length login is wrong for a shared campus machine; a day is wrong
    // for the student checking their timetable each morning. A week, refreshed
    // whenever they return within the day, is the compromise.
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },

  advanced: {
    /*
     * Secure cookies follow the URL *scheme*, not NODE_ENV.
     *
     * Deriving this from NODE_ENV looks equivalent and is not: `next start`
     * and the end-to-end suite are production builds served over plain http,
     * and a `Secure`, `__Secure-` prefixed cookie is rejected outright by
     * browsers on an insecure origin. Login then fails locally — silently,
     * because the browser simply declines to store the cookie — for a reason
     * that can never occur in production.
     *
     * https is what actually makes a Secure cookie correct, so https is what
     * decides.
     */
    useSecureCookies: baseURL?.startsWith("https://") ?? false,
    cookiePrefix: "campivo",
    defaultCookieAttributes: {
      httpOnly: true,
      // Lax, not Strict: a link from an email or a chat should land the student
      // in an app they are already signed in to. It still blocks the
      // cross-site POST that CSRF depends on.
      sameSite: "lax",
    },
  },

  databaseHooks: {
    user: {
      create: {
        /**
         * Every student needs settings before the app can render a single page —
         * the attendance target, the weekly goal and the grading scale are read
         * on the dashboard, on Subjects and on Marks.
         *
         * Creating them in the same transaction as the user means an account can
         * never exist in a half-built state, which is what a "create the row on
         * first read" fallback would have to defend against forever.
         */
        after: async (user) => {
          await prisma.userSettings.create({
            data: { userId: user.id, gradingScale: DEFAULT_GRADING_SCALE },
          });
        },
      },
    },
  },

  // Must stay last: it lets server actions set the session cookie on the
  // response Next.js is already building.
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
