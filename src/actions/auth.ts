"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { loginSchema, signUpSchema } from "@/lib/validations/auth";

import { failure, formValues, validationFailure } from "./shared";
import type { ActionState } from "./types";

/**
 * Sign up, log in, log out.
 *
 * These run on the server rather than calling the auth client from the browser
 * for three reasons: the password never enters client state, validation happens
 * in the one place that is authoritative, and the redirect is the server's
 * decision rather than something the page asks for afterwards.
 *
 * On success they `redirect()`, which throws — so they never return a success
 * state, only a failure one. The forms render whatever comes back.
 */

/**
 * The message shown whenever a credential check fails, for any reason.
 *
 * Deliberately identical for "no such account" and "wrong password". Splitting
 * them would turn the login form into an oracle for which email addresses have
 * Campivo accounts, which is worth more to someone enumerating accounts than
 * the marginal clarity is worth to a student who mistyped.
 */
type RedirectTarget = Parameters<typeof redirect>[0];

const INVALID_CREDENTIALS = "That email and password do not match an account.";

export async function signUpAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(formValues(formData));
  if (!parsed.success) return validationFailure(parsed.error);

  const { name, email, password } = parsed.data;

  try {
    // Creates the user, hashes the password with scrypt, writes the settings row
    // (see the databaseHooks in lib/auth/server) and sets the session cookie.
    await auth.api.signUpEmail({
      body: { name, email, password },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      // A taken email has to be reported — the student cannot proceed otherwise
      // — but it is attached to the field rather than dressed up as a hint, and
      // the wording assumes the reader owns the address.
      if (isEmailTaken(error)) {
        return failure("An account already exists for that email.", {
          email: ["An account already exists for that email. Log in instead."],
        });
      }
      return failure(error.body?.message ?? "Could not create your account.");
    }

    console.error("[auth] sign-up failed", error);
    return failure("Could not create your account. Please try again.");
  }

  redirect("/");
}

export async function loginAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse(formValues(formData));
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    await auth.api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) return failure(INVALID_CREDENTIALS);

    console.error("[auth] login failed", error);
    return failure("Could not sign you in. Please try again.");
  }

  redirect(safeNext(formData.get("next")));
}

/**
 * Where to land after logging in.
 *
 * The destination arrives in the form, so it is attacker-controllable and is
 * treated as such: anything that is not a plain in-app path falls back to the
 * dashboard. Rejecting a leading "//" matters as much as rejecting "http://" —
 * browsers read "//evil.example" as protocol-relative and would leave the site.
 */
function safeNext(value: FormDataEntryValue | null): RedirectTarget {
  const fallback = "/" as RedirectTarget;
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.startsWith("/login") || value.startsWith("/signup")) return fallback;
  // Checked above to be a single-slash in-app path; typed routes cannot verify
  // a runtime string, so this is where that guarantee is asserted.
  return value as RedirectTarget;
}

/**
 * Log out.
 *
 * Deletes the session row, so the cookie stops resolving everywhere rather than
 * merely being dropped by this browser — a session copied elsewhere dies too.
 */
export async function logoutAction(): Promise<void> {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (error) {
    // A session that is already gone is the outcome the student wanted; send
    // them to the login page rather than showing an error for a success.
    console.error("[auth] sign-out failed", error);
  }

  redirect("/login");
}

function isEmailTaken(error: APIError): boolean {
  const code = error.body?.code;
  if (typeof code === "string" && code.includes("EMAIL")) return true;
  return /already exists|already registered|taken/i.test(
    error.body?.message ?? "",
  );
}
