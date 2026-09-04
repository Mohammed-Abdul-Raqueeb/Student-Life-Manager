import { describe, expect, it } from "vitest";

import {
  MIN_PASSWORD_LENGTH,
  loginSchema,
  signUpSchema,
} from "@/lib/validations/auth";

/**
 * Credential validation.
 *
 * The server re-parses these schemas on every submission, so what they accept
 * is what the database is asked to store. The asymmetry between signup and
 * login is deliberate and is asserted here so it cannot be "tidied up" into
 * consistency later.
 */

const valid = {
  name: "Aarav Shah",
  email: "aarav@example.com",
  password: "correct-horse-battery",
  confirmPassword: "correct-horse-battery",
};

describe("signUpSchema", () => {
  it("accepts a well-formed registration", () => {
    const result = signUpSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("normalises the email so case cannot create a second account", () => {
    const result = signUpSchema.safeParse({
      ...valid,
      email: "  Aarav@Example.COM  ",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("aarav@example.com");
  });

  it("trims the name rather than storing the whitespace", () => {
    const result = signUpSchema.safeParse({ ...valid, name: "  Aarav Shah  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Aarav Shah");
  });

  it("requires a name", () => {
    const result = signUpSchema.safeParse({ ...valid, name: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldMessages(result, "name")[0]).toMatch(/name is required/i);
    }
  });

  it.each([
    ["missing @", "not-an-email"],
    ["missing domain", "someone@"],
    ["empty", ""],
    ["spaces only", "   "],
  ])("rejects an invalid email (%s)", (_label, email) => {
    expect(signUpSchema.safeParse({ ...valid, email }).success).toBe(false);
  });

  it("rejects a password below the minimum length", () => {
    const short = "a".repeat(MIN_PASSWORD_LENGTH - 1);
    const result = signUpSchema.safeParse({
      ...valid,
      password: short,
      confirmPassword: short,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldMessages(result, "password")[0]).toContain(
        String(MIN_PASSWORD_LENGTH),
      );
    }
  });

  it("accepts a password of exactly the minimum length", () => {
    const exact = "a".repeat(MIN_PASSWORD_LENGTH);
    const result = signUpSchema.safeParse({
      ...valid,
      password: exact,
      confirmPassword: exact,
    });
    expect(result.success).toBe(true);
  });

  it("reports a mismatch on the confirm field, where the correction happens", () => {
    const result = signUpSchema.safeParse({
      ...valid,
      confirmPassword: "something-else",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldMessages(result, "confirmPassword")[0]).toMatch(
        /do not match/i,
      );
      // Not on `password` — that field is fine and marking it red is a lie.
      expect(fieldMessages(result, "password")).toHaveLength(0);
    }
  });

  it("does not trim the password", () => {
    // Leading and trailing spaces are legitimate password characters; silently
    // stripping them would make a password fail to match itself later.
    const padded = "  spaces are fine  ";
    const result = signUpSchema.safeParse({
      ...valid,
      password: padded,
      confirmPassword: padded,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.password).toBe(padded);
  });
});

describe("loginSchema", () => {
  it("accepts any non-empty password", () => {
    // Deliberately laxer than signup: an account whose password predates a rule
    // change must still be able to log in, and telling a stranger their guess
    // is "too short" is a free hint about an account that may not be theirs.
    const result = loginSchema.safeParse({
      email: "aarav@example.com",
      password: "x",
    });
    expect(result.success).toBe(true);
  });

  it("still requires a password to be present", () => {
    const result = loginSchema.safeParse({
      email: "aarav@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("normalises the email the same way signup does", () => {
    const result = loginSchema.safeParse({
      email: "  Aarav@Example.COM ",
      password: "whatever",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("aarav@example.com");
  });

  it("rejects a malformed email", () => {
    expect(
      loginSchema.safeParse({ email: "nope", password: "whatever" }).success,
    ).toBe(false);
  });
});

function fieldMessages(
  result: { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } },
  field: string,
): string[] {
  return result.error.issues
    .filter((issue) => issue.path[0] === field)
    .map((issue) => issue.message);
}
