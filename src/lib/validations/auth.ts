import { z } from "zod";

/**
 * Credential validation, shared by the auth forms and the server actions behind
 * them. As everywhere else in the app the client parse is a convenience and the
 * server parse is the one that counts.
 */

/** Password rules live here so signup and any future reset flow cannot drift. */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

const email = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .max(254, "That email is too long.")
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));

const name = z
  .string()
  .trim()
  .min(1, "Your name is required.")
  .max(80, "Name must be 80 characters or fewer.");

const newPassword = z
  .string()
  .min(1, "Password is required.")
  .min(
    MIN_PASSWORD_LENGTH,
    `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
  )
  .max(
    MAX_PASSWORD_LENGTH,
    `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`,
  );

export const signUpSchema = z
  .object({
    name,
    email,
    password: newPassword,
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Those passwords do not match.",
    path: ["confirmPassword"],
  });

/**
 * Login deliberately does *not* reuse the signup password rules.
 *
 * Telling someone at the login screen that their password is "too short" is a
 * free hint about an account that may not be theirs, and it would reject an
 * existing account whose password predates a rule change. Any non-empty string
 * is submittable; the credential check decides.
 */
export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required."),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
