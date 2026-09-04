/**
 * The shape a server action hands back to a form.
 *
 * This file is deliberately free of server imports: forms are client components
 * and need these types and the `IDLE` initial state, so anything they import
 * must be safe to bundle for the browser. The server-side helpers that build
 * these values live in `./shared`, which is never imported from client code.
 */

export type FieldErrors = Record<string, string[]>;

export type ActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors?: FieldErrors };

export const IDLE: ActionState = { status: "idle" };
