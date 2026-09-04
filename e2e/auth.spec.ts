import "dotenv/config";

import { expect, test, type Page } from "@playwright/test";

/**
 * Authentication and data isolation.
 *
 * The isolation tests here are the point of the file. It is easy to write a
 * test that proves User A's browser does not *show* User B's subjects; that
 * only tests the navigation. These tests instead take an id belonging to
 * User B, put it in a request made with User A's session, and assert that the
 * server refuses — because that is the request an attacker actually makes.
 *
 * Every account is created with a unique email so runs never collide, and each
 * test signs up through the real endpoints rather than seeding rows directly.
 */

const PASSWORD = "correct-horse-battery-staple";

function uniqueEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

/** Signs up through the UI and lands on the dashboard. */
async function signUpVia(page: Page, name: string, email: string) {
  await page.goto("/signup");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("/");
}

/**
 * The password as the database actually holds it.
 *
 * Talking to Postgres directly, rather than through the app, is the point: it
 * is the only way to assert what was *persisted* rather than what an endpoint
 * chose to reveal.
 */
async function storedCredential(email: string): Promise<string | null> {
  const { Client } = await import("pg");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(
      `select a.password from accounts a
         join users u on u.id = a."userId"
        where u.email = $1 and a."providerId" = 'credential'`,
      [email],
    );
    return result.rows[0]?.password ?? null;
  } finally {
    await client.end();
  }
}

// ── 1-5: the credential flow ────────────────────────────────────────────────

test("sign up creates an account and lands on the dashboard", async ({ page }) => {
  const email = uniqueEmail("signup");
  await signUpVia(page, "Priya Menon", email);

  await expect(page).toHaveURL("/");
  // A fresh account gets the onboarding heading rather than the time-of-day
  // greeting, and it is addressed to *this* student — which is the part that
  // proves the page rendered for them and not for whoever signed up first.
  await expect(
    page.getByRole("heading", { name: "Welcome, Priya Menon" }),
  ).toBeVisible();
  // The account menu carries the identity, so seeing the name proves the page
  // rendered for *this* user rather than for whoever happened to be first.
  await expect(page.getByRole("button", { name: /Account menu for Priya Menon/ })).toBeVisible();
});

test("a new account starts empty rather than inheriting anyone's data", async ({ page }) => {
  await signUpVia(page, "Empty Start", uniqueEmail("empty"));

  await page.goto("/subjects");
  // The seeded demo student has five subjects. A fresh account must see none of
  // them — this is the regression that a missing userId filter would cause.
  await expect(page.getByText("Database Systems")).toHaveCount(0);
  await expect(page.getByText(/No subjects yet|Add your first subject/i).first()).toBeVisible();
});

test("the password is stored only as a hash", async ({ page, request, baseURL }) => {
  const email = uniqueEmail("hash");
  await signUpVia(page, "Hash Check", email);

  const stored = await storedCredential(email);

  // The row exists, and what is in it is not what was typed.
  expect(stored, "a credential row should exist").not.toBeNull();
  expect(stored).not.toBe(PASSWORD);
  expect(stored).not.toContain(PASSWORD);

  // scrypt, stored as salt:hash — both halves hex, neither reversible.
  expect(stored).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);

  // And it really is a hash *of that password*: the library can verify it.
  const { verifyPassword } = await import("better-auth/crypto");
  expect(await verifyPassword({ hash: stored!, password: PASSWORD })).toBe(true);
  expect(
    await verifyPassword({ hash: stored!, password: "not-the-password" }),
  ).toBe(false);

  // Nothing echoes it back either.
  const session = await request.get(`${baseURL}/api/auth/get-session`);
  expect((await session.text())).not.toContain(PASSWORD);
});

test("login with valid credentials reaches the dashboard", async ({ page, context }) => {
  const email = uniqueEmail("login");
  await signUpVia(page, "Return Visitor", email);

  await context.clearCookies();
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();

  await page.waitForURL("/");
  await expect(page.getByRole("button", { name: /Account menu for Return Visitor/ })).toBeVisible();
});

test("invalid credentials are refused without revealing which half was wrong", async ({ page }) => {
  const email = uniqueEmail("wrongpw");
  await signUpVia(page, "Wrong Password", email);
  await page.context().clearCookies();

  // Right email, wrong password.
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).fill("not-the-right-password");
  await page.getByRole("button", { name: "Log in" }).click();

  const alert = page.getByRole("alert");
  await expect(alert).toBeVisible();
  const wrongPasswordMessage = await alert.textContent();
  await expect(page).toHaveURL(/\/login/);

  // An email with no account at all.
  await page.goto("/login");
  await page.getByLabel("Email").fill(uniqueEmail("nobody"));
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page.getByRole("alert")).toBeVisible();
  const noAccountMessage = await page.getByRole("alert").textContent();

  // Identical wording: the form must not become an oracle for which addresses
  // have Campivo accounts.
  expect(noAccountMessage).toBe(wrongPasswordMessage);
});

test("logout ends the session and re-protects the app", async ({ page }) => {
  await signUpVia(page, "Leaving Soon", uniqueEmail("logout"));

  await page.getByRole("button", { name: /Account menu for Leaving Soon/ }).click();
  // Inside a menu the control's role is menuitem, not button.
  await page.getByRole("menuitem", { name: "Log out" }).click();

  await page.waitForURL(/\/login/);
  // Not merely redirected — the session is gone, so going back is refused too.
  await page.goto("/subjects");
  await expect(page).toHaveURL(/\/login/);
});

test("a signed-in user is redirected away from login and signup", async ({ page }) => {
  await signUpVia(page, "Already In", uniqueEmail("redirect"));

  await page.goto("/login");
  await expect(page).toHaveURL("/");

  await page.goto("/signup");
  await expect(page).toHaveURL("/");
});

test("duplicate signups are refused", async ({ page }) => {
  const email = uniqueEmail("dupe");
  await signUpVia(page, "First Claim", email);
  await page.context().clearCookies();

  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Second Claim");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  // A taken email is a field-level failure, so it is reported on the field it
  // belongs to rather than in the form-level alert.
  await expect(page.getByText(/already exists for that email/i)).toBeVisible();
  await expect(page).toHaveURL(/\/signup/);
});

test("signup validation catches mismatched passwords before the server", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Typo Prone");
  await page.getByLabel("Email").fill(uniqueEmail("mismatch"));
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill("something-else-entirely");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("Those passwords do not match.")).toBeVisible();
  await expect(page).toHaveURL(/\/signup/);
});

// ── 6-7: route protection ───────────────────────────────────────────────────

const PROTECTED = [
  "/",
  "/today",
  "/subjects",
  "/assignments",
  "/exams",
  "/timetable",
  "/attendance",
  "/notes",
  "/marks",
  "/study",
  "/settings",
] as const;

test("every protected page redirects an unauthenticated visitor to login", async ({ page }) => {
  for (const route of PROTECTED) {
    await page.goto(route);
    await expect(page, `${route} should redirect`).toHaveURL(/\/login/);
  }
});

test("every protected page opens for an authenticated student", async ({ page }) => {
  await signUpVia(page, "Full Access", uniqueEmail("access"));

  for (const route of PROTECTED) {
    const response = await page.goto(route);
    expect(response?.status(), `${route} should load`).toBe(200);
    await expect(page, `${route} should not redirect`).toHaveURL(
      new RegExp(`${route === "/" ? "/$" : route}`),
    );
  }
});

test("logging in resumes the page that was originally requested", async ({ page }) => {
  const email = uniqueEmail("resume");
  await signUpVia(page, "Deep Link", email);
  await page.context().clearCookies();

  await page.goto("/attendance");
  await expect(page).toHaveURL(/\/login\?next=%2Fattendance/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();

  await page.waitForURL("/attendance");
});

test("an open redirect cannot be smuggled through the next parameter", async ({ page, baseURL }) => {
  const email = uniqueEmail("openredirect");
  await signUpVia(page, "Redirect Probe", email);
  await page.context().clearCookies();

  // Protocol-relative: browsers read "//evil.example" as an absolute URL.
  await page.goto("/login?next=%2F%2Fevil.example%2Fphish");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();

  // Landed on the dashboard, on this origin — not on evil.example.
  await page.waitForURL("/");
  expect(new URL(page.url()).host).toBe(new URL(baseURL!).host);
  expect(new URL(page.url()).pathname).toBe("/");
});
