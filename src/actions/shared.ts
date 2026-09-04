import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";

import type { ActionState, FieldErrors } from "./types";

/**
 * Server-action plumbing shared by every mutation.
 *
 * Three rules hold everywhere:
 *   1. Input is re-validated on the server with the same Zod schema the form
 *      used — a hand-crafted request gets the same treatment as the UI.
 *   2. Foreign keys are checked against the current user before use, so a
 *      client cannot attach a record to somebody else's subject by guessing an
 *      id (`assertOwnedSubject`).
 *   3. Raw database errors never reach the browser; they are logged on the
 *      server and replaced with a sentence a student can act on.
 *
 * The `server-only` import at the top is load-bearing: it turns "a client
 * component accidentally imported this and dragged the database driver into the
 * browser bundle" from a confusing build failure into a precise one. The types
 * forms genuinely need live in `./types`.
 */

export type { ActionState, FieldErrors } from "./types";
export { IDLE } from "./types";

export function success(message: string): ActionState {
  return { status: "success", message };
}

export function failure(message: string, fieldErrors?: FieldErrors): ActionState {
  return { status: "error", message, fieldErrors };
}

/** Turns a Zod failure into per-field messages the form can render inline. */
export function validationFailure(error: z.ZodError): ActionState {
  const flat = z.flattenError(error);
  const fieldErrors: FieldErrors = {};
  for (const [key, messages] of Object.entries(flat.fieldErrors)) {
    if (Array.isArray(messages) && messages.length > 0) {
      fieldErrors[key] = messages.map(String);
    }
  }

  const firstFieldMessage = Object.values(fieldErrors)[0]?.[0];

  return failure(
    flat.formErrors[0] ?? firstFieldMessage ?? "Please check the form and try again.",
    Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
  );
}

/**
 * Wraps an action body so an unexpected database failure becomes a friendly
 * message instead of a Next.js error overlay. Control-flow errors thrown by
 * `redirect()` and `notFound()` are re-thrown untouched.
 */
export async function guard(
  action: () => Promise<ActionState>,
  fallback = "Something went wrong. Please try again.",
): Promise<ActionState> {
  try {
    return await action();
  } catch (error) {
    if (isNextControlFlowError(error)) throw error;
    console.error("[action]", error);
    return failure(describeDatabaseError(error, fallback));
  }
}

function isNextControlFlowError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    /^(NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK)/.test(
      (error as { digest: string }).digest,
    )
  );
}

/** Maps the few Prisma error codes with a genuinely useful student-facing message. */
function describeDatabaseError(error: unknown, fallback: string): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : null;

  switch (code) {
    case "P2002":
      return "That already exists. Try a different name or code.";
    case "P2003":
    case "P2025":
      return "That record no longer exists. Refresh the page and try again.";
    case "P1001":
    case "P1002":
      return "Could not reach the database. Check your connection and try again.";
    default:
      return fallback;
  }
}

/**
 * Confirms a subject id really belongs to the signed-in student. Every mutation
 * that accepts a `subjectId` from the client goes through here first.
 */
export async function assertOwnedSubject(
  userId: string,
  subjectId: string,
): Promise<boolean> {
  const count = await prisma.subject.count({ where: { id: subjectId, userId } });
  return count === 1;
}

/**
 * One revalidation helper for the whole app.
 *
 * The data is deeply interlinked — completing an assignment changes the
 * dashboard, Today, the subject card and the deadline stream — so rather than
 * enumerate paths at every call site (and get one wrong), mutations invalidate
 * the root layout. For a single student's dataset that is a handful of small
 * queries, not a meaningful cost.
 */
export function revalidateApp(): void {
  revalidatePath("/", "layout");
}

/** `FormData` → a plain object Zod can parse. Empty strings are preserved. */
export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value;
  }
  return values;
}
