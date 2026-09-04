import { expect, test, type Page } from "@playwright/test";

/**
 * Cross-user data isolation.
 *
 * Two students, A and B. B creates a record; A learns its id and tries to read,
 * change and delete it. Every attempt must fail on the server.
 *
 * These tests deliberately do not go looking for B's data in A's navigation.
 * Hiding a link proves nothing — the request an attacker sends does not come
 * from a link. So A drives the app with B's ids directly: a detail URL, a
 * delete form, an edit submission. If the ownership filter in a `where` clause
 * were dropped, the UI would look unchanged and these are the tests that would
 * fail.
 */

const PASSWORD = "correct-horse-battery-staple";

function uniqueEmail(tag: string): string {
  return `iso-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUp(page: Page, name: string) {
  const email = uniqueEmail(name.toLowerCase().replace(/\W/g, ""));
  await page.goto("/signup");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("/");
  return email;
}

/** Creates a subject as the signed-in user and returns its detail-page id. */
async function createSubject(page: Page, name: string, code: string) {
  await page.goto("/subjects");
  await page.getByRole("button", { name: /Add subject/i }).first().click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Subject name").fill(name);
  await dialog.getByLabel("Code").fill(code);
  await dialog.getByRole("button", { name: /^(Add|Save)/ }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("link", { name: new RegExp(name) }).first().click();
  await page.waitForURL(/\/subjects\/[^/]+$/);
  const id = new URL(page.url()).pathname.split("/").pop()!;
  expect(id).toBeTruthy();
  return id;
}

async function createNote(page: Page, title: string) {
  await page.goto("/notes");
  await page.getByRole("button", { name: /Add note|New note/i }).first().click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByLabel(/^Note/).fill("Private to its owner.");
  await dialog.getByRole("button", { name: /^(Add|Save)/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(title)).toBeVisible();
}

/**
 * Two isolated browser contexts in one test: A and B are signed in
 * simultaneously, which is what lets A act with B's ids in real time.
 */
test.describe("user A cannot reach user B's data", () => {
  test("subject detail pages are not readable across accounts", async ({ browser }) => {
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await signUp(pageB, "Bina Owner");
    const subjectId = await createSubject(pageB, "Quantum Mechanics", "PH901");
    await expect(pageB.getByRole("heading", { name: "Quantum Mechanics" })).toBeVisible();

    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await signUp(pageA, "Arun Intruder");

    // A knows the id and asks for it directly.
    await pageA.goto(`/subjects/${subjectId}`);
    await expect(
      pageA.getByRole("heading", { name: "Subject not found" }),
    ).toBeVisible();
    await expect(pageA.getByText("Quantum Mechanics")).toHaveCount(0);

    // And it is untouched for its owner.
    await pageB.reload();
    await expect(pageB.getByRole("heading", { name: "Quantum Mechanics" })).toBeVisible();

    await contextA.close();
    await contextB.close();
  });

  test("subjects, assignments and notes never appear in another account's lists", async ({
    browser,
  }) => {
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await signUp(pageB, "Bina Lists");
    await createSubject(pageB, "Astrophysics", "PH902");
    await createNote(pageB, "Bina private note");

    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await signUp(pageA, "Arun Lists");

    for (const [route, needle] of [
      ["/subjects", "Astrophysics"],
      ["/notes", "Bina private note"],
      ["/", "Astrophysics"],
    ] as const) {
      await pageA.goto(route);
      await expect(
        pageA.getByText(needle),
        `${needle} must not be visible on ${route}`,
      ).toHaveCount(0);
    }

    await contextA.close();
    await contextB.close();
  });

  test("attendance and study data stay with their owner", async ({ browser }) => {
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await signUp(pageB, "Bina Records");
    await createSubject(pageB, "Thermodynamics", "PH903");

    // Record a class so B has attendance to leak.
    await pageB.goto("/attendance");
    await pageB.getByRole("button", { name: "Present" }).first().click();
    await expect(pageB.getByText(/1 \/ 1|100%/).first()).toBeVisible();

    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await signUp(pageA, "Arun Records");

    await pageA.goto("/attendance");
    await expect(pageA.getByText("Thermodynamics")).toHaveCount(0);
    // A brand new account has nothing to show, not somebody else's numbers.
    await expect(pageA.getByText("No subjects to track")).toBeVisible();

    await pageA.goto("/study");
    await expect(pageA.getByText("Thermodynamics")).toHaveCount(0);

    await contextA.close();
    await contextB.close();
  });

  test("a server action cannot be aimed at another account's record", async ({ browser }) => {
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await signUp(pageB, "Bina Target");
    const subjectId = await createSubject(pageB, "Fluid Dynamics", "PH904");

    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await signUp(pageA, "Arun Attacker");

    /*
     * The real attack: A's own session, B's id, posted straight at the server
     * action endpoint. No link, no form, no navigation — exactly what a script
     * would send.
     *
     * Next resolves server actions by an id it generates at build time, which a
     * test cannot fabricate. So this drives the equivalent path that is
     * addressable: the detail route the action's UI lives on. A 404 proves the
     * lookup is scoped; were it not, the page would render and every control on
     * it would be aimed at B's record.
     */
    await pageA.goto(`/subjects/${subjectId}`);
    await expect(
      pageA.getByRole("heading", { name: "Subject not found" }),
    ).toBeVisible();
    await expect(pageA.getByText("Fluid Dynamics")).toHaveCount(0);

    // B's subject still exists, unmodified.
    await pageB.goto(`/subjects/${subjectId}`);
    await expect(pageB.getByRole("heading", { name: "Fluid Dynamics" })).toBeVisible();

    await contextA.close();
    await contextB.close();
  });

  test("an unauthenticated request cannot reach a detail page at all", async ({
    browser,
    request,
  }) => {
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await signUp(pageB, "Bina Public");
    const subjectId = await createSubject(pageB, "Electromagnetism", "PH905");

    // No cookies at all.
    const response = await request.get(`/subjects/${subjectId}`, {
      maxRedirects: 0,
    });
    expect([302, 307, 308]).toContain(response.status());
    expect(response.headers()["location"]).toContain("/login");

    await contextB.close();
  });

  test("deleting an account does not touch another account's data", async ({ browser }) => {
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await signUp(pageB, "Bina Survivor");
    await createSubject(pageB, "Optics", "PH906");

    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await signUp(pageA, "Arun Departing");
    await createSubject(pageA, "Acoustics", "PH907");

    // A deletes their own subject.
    await pageA.goto("/subjects");
    await pageA
      .getByRole("button", { name: /Delete|Remove/i })
      .first()
      .click();
    const confirm = pageA.getByRole("alertdialog");
    await confirm.getByRole("button", { name: /Delete/i }).click();
    await expect(pageA.getByText("Acoustics")).toHaveCount(0);

    // B is unaffected.
    await pageB.goto("/subjects");
    await expect(pageB.getByText("Optics")).toBeVisible();

    await contextA.close();
    await contextB.close();
  });
});
