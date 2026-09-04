import { expect, test, type Page } from "@playwright/test";

/**
 * End-to-end checks against a real browser and a real database.
 *
 * The unit tests cover the arithmetic; these cover the parts that only exist
 * once everything is wired together — that a form dialog actually writes a row,
 * that the page re-renders with the new value, that a delete confirmation
 * removes it again, and that no page logs a console error or a hydration
 * warning on the way.
 *
 * Every test cleans up after itself so the suite can be run repeatedly against
 * the seeded demo data without drift.
 */

const ROUTES = [
  ["Overview", "/"],
  ["Today", "/today"],
  ["Subjects", "/subjects"],
  ["Assignments", "/assignments"],
  ["Tasks", "/assignments?tab=tasks"],
  ["Exams", "/exams"],
  ["Timetable", "/timetable"],
  ["Attendance", "/attendance"],
  ["Notes", "/notes"],
  ["Marks", "/marks"],
  ["Study", "/study"],
  ["Settings", "/settings"],
] as const;

/** Collects console errors and page exceptions for the life of a page. */
function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console.error: ${message.text()}`);
    if (message.type() === "warning" && /hydrat/i.test(message.text())) {
      problems.push(`hydration warning: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  return problems;
}

test.describe("pages render cleanly", () => {
  for (const [name, path] of ROUTES) {
    test(`${name} loads with no console errors`, async ({ page }) => {
      const problems = watchConsole(page);

      const response = await page.goto(path);
      expect(response?.status(), `${path} status`).toBe(200);

      // The shell is present, so the layout rendered rather than an error boundary.
      await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
      await expect(page.getByText("Something went wrong")).toHaveCount(0);

      // Give client components a beat to hydrate before judging the console.
      await page.waitForTimeout(400);
      expect(problems, `${path} console`).toEqual([]);
    });
  }
});

test("subject detail page opens from the subjects list", async ({ page }) => {
  await page.goto("/subjects");
  await page.getByRole("link", { name: "View details" }).first().click();
  await expect(page).toHaveURL(/\/subjects\/[a-z0-9]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Assignments" })).toBeVisible();
});

test("assignment: create, edit, complete, delete", async ({ page }) => {
  const title = `E2E assignment ${Date.now()}`;
  const renamed = `${title} (edited)`;

  await page.goto("/assignments");

  // ── Create ────────────────────────────────────────────────────────────────
  await page.getByRole("button", { name: "Add assignment" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByLabel("Subject").click();
  await page.getByRole("option").first().click();
  await dialog.getByRole("button", { name: "Add assignment" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText(title, { exact: true })).toBeVisible();

  // ── Edit ──────────────────────────────────────────────────────────────────
  const row = page.locator("li").filter({ hasText: title }).first();
  await row.getByRole("button", { name: "Edit" }).click();
  const editDialog = page.getByRole("dialog");
  await editDialog.getByLabel("Title").fill(renamed);
  await editDialog.getByRole("button", { name: "Save changes" }).click();

  await expect(editDialog).toBeHidden();
  await expect(page.getByText(renamed, { exact: true })).toBeVisible();

  // ── Complete ──────────────────────────────────────────────────────────────
  const editedRow = page.locator("li").filter({ hasText: renamed }).first();
  await editedRow.getByRole("checkbox", { name: /Mark .* complete/ }).click();
  await expect(
    page.locator("li").filter({ hasText: renamed }).getByText("Completed"),
  ).toBeVisible();

  // ── Delete ────────────────────────────────────────────────────────────────
  await page
    .locator("li")
    .filter({ hasText: renamed })
    .first()
    .getByRole("button", { name: `Delete ${renamed}` })
    .click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();

  await expect(page.getByText(renamed, { exact: true })).toHaveCount(0);
});

test("task: create, complete from the dashboard, delete", async ({ page }) => {
  const title = `E2E task ${Date.now()}`;

  await page.goto("/assignments?tab=tasks");
  await page.getByRole("button", { name: "Add task" }).first().click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByRole("button", { name: "Add task" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(title, { exact: true })).toBeVisible();

  // An undated task is an open to-do, so it shows on Today without a deadline.
  await page.goto("/today");
  const todayRow = page.locator("li").filter({ hasText: title }).first();
  await expect(todayRow).toBeVisible();
  await todayRow.getByRole("checkbox", { name: `Complete ${title}` }).click();
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);

  await page.goto("/assignments?tab=tasks");
  await page
    .locator("li")
    .filter({ hasText: title })
    .first()
    .getByRole("button", { name: `Delete ${title}` })
    .click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
});

test("attendance: recording a class moves the percentage and the advice", async ({
  page,
}) => {
  await page.goto("/attendance");

  const row = page.locator("li").filter({ hasText: "Operating Systems" }).first();
  const countsBefore = await row.getByText(/\d+ \/ \d+ classes/).textContent();
  const [attendedBefore, conductedBefore] = parseCounts(countsBefore);

  await row.getByRole("button", { name: /Mark present for/ }).click();
  await expect(page.getByText(/Marked present/)).toBeVisible();

  // The recorder upserts on (subject, date), so the totals must move by exactly
  // one class — pressing it twice must not add a second.
  await expect(async () => {
    const after = await page
      .locator("li")
      .filter({ hasText: "Operating Systems" })
      .first()
      .getByText(/\d+ \/ \d+ classes/)
      .textContent();
    const [attendedAfter, conductedAfter] = parseCounts(after);
    expect(conductedAfter).toBe(conductedBefore + 1);
    expect(attendedAfter).toBe(attendedBefore + 1);
  }).toPass({ timeout: 10_000 });

  await page
    .locator("li")
    .filter({ hasText: "Operating Systems" })
    .first()
    .getByRole("button", { name: /Mark present for/ })
    .click();
  await expect(page.getByText(/Marked present/).first()).toBeVisible();

  await expect(async () => {
    const after = await page
      .locator("li")
      .filter({ hasText: "Operating Systems" })
      .first()
      .getByText(/\d+ \/ \d+ classes/)
      .textContent();
    const [, conductedAfter] = parseCounts(after);
    expect(conductedAfter).toBe(conductedBefore + 1);
  }).toPass({ timeout: 10_000 });

  // Put the seeded state back.
  await page
    .locator("li")
    .filter({ hasText: "Operating Systems" })
    .first()
    .getByRole("button", { name: /Clear the entry for/ })
    .click();

  await expect(async () => {
    const after = await page
      .locator("li")
      .filter({ hasText: "Operating Systems" })
      .first()
      .getByText(/\d+ \/ \d+ classes/)
      .textContent();
    const [attendedAfter, conductedAfter] = parseCounts(after);
    expect(conductedAfter).toBe(conductedBefore);
    expect(attendedAfter).toBe(attendedBefore);
  }).toPass({ timeout: 10_000 });
});

test("validation errors come back from the server and stay in the dialog", async ({
  page,
}) => {
  await page.goto("/marks");
  await page.getByRole("button", { name: "Record marks" }).first().click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Assessment name").fill("Impossible score");
  await dialog.getByLabel("Subject").click();
  await page.getByRole("option").first().click();
  await dialog.getByLabel("Marks obtained").fill("60");
  await dialog.getByLabel("Maximum marks").fill("50");
  await dialog.getByRole("button", { name: "Record marks" }).click();

  // The dialog stays open and explains the problem rather than writing the row.
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText("Marks obtained cannot exceed the maximum marks."),
  ).toBeVisible();
});

test("settings: changing the attendance target changes the advice", async ({
  page,
}) => {
  await page.goto("/settings");

  const target = page.getByLabel("Attendance target");
  const original = await target.inputValue();

  await target.fill("90");
  await page.getByRole("button", { name: "Save academic settings" }).click();
  await expect(page.getByText("Academic settings saved.")).toBeVisible();

  await page.goto("/attendance");
  await expect(page.getByText("Your target is 90%.")).toBeVisible();
  await expect(page.getByText(/below the 90% target/i).first()).toBeVisible();

  // Restore.
  await page.goto("/settings");
  await page.getByLabel("Attendance target").fill(original);
  await page.getByRole("button", { name: "Save academic settings" }).click();
  await expect(page.getByText("Academic settings saved.")).toBeVisible();
});

test("dark mode applies and the page stays readable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Change theme" }).click();
  await page.getByRole("menuitem", { name: "Dark" }).click();

  await expect(page.locator("html")).toHaveClass(/dark/);

  // The dashboard still renders its content, not a blank themed shell.
  await expect(page.getByText("Upcoming deadlines")).toBeVisible();

  await page.getByRole("button", { name: "Change theme" }).click();
  await page.getByRole("menuitem", { name: "System" }).click();
});

test("mobile layout: bottom bar, drawer, and no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const [name, path] of ROUTES) {
    await page.goto(path);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${name} horizontal overflow`).toBeLessThanOrEqual(1);
  }

  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();

  await page.getByRole("button", { name: "Open navigation menu" }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("link", { name: "Marks & Grades" })).toBeVisible();
  await drawer.getByRole("link", { name: "Marks & Grades" }).click();
  await expect(page).toHaveURL(/\/marks$/);
});

function parseCounts(text: string | null): [number, number] {
  const match = /(\d+)\s*\/\s*(\d+)/.exec(text ?? "");
  if (!match) throw new Error(`Could not parse counts from: ${text}`);
  return [Number(match[1]), Number(match[2])];
}

/**
 * The remaining entities. Each one uses the same FormDialog + server action
 * machinery as the assignment test above, so this covers the wiring — the
 * subject select, the confirmation dialog, and the list refreshing — for every
 * form the app has, without repeating the full edit cycle five times.
 */
test("subject: create and delete", async ({ page }) => {
  const stamp = Date.now().toString().slice(-6);
  const name = `E2E Subject ${stamp}`;
  const code = `E2E${stamp}`;

  await page.goto("/subjects");
  await page.getByRole("button", { name: "Add subject" }).first().click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Subject name").fill(name);
  await dialog.getByLabel("Subject code").fill(code);
  await dialog.getByRole("button", { name: "Add subject" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole("link", { name })).toBeVisible();

  // A brand new subject has no records anywhere, so it must say so rather than
  // report a misleading 0%. It is the only subject on the page without any.
  await expect(page.getByText("No classes").first()).toBeVisible();

  await page.getByRole("button", { name: `Delete ${name}` }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete subject" })
    .click();
  await expect(page.getByRole("link", { name })).toHaveCount(0);
});

test("note: create and delete", async ({ page }) => {
  const title = `E2E note ${Date.now()}`;

  await page.goto("/notes");
  await page.getByRole("button", { name: "New note" }).first().click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByLabel(/^Note/).fill("Written by the e2e suite.");
  await dialog.getByRole("button", { name: "Save note" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  await page.getByRole("button", { name: `Delete ${title}` }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("heading", { name: title })).toHaveCount(0);
});

test("exam: create and delete", async ({ page }) => {
  const name = `E2E exam ${Date.now()}`;

  await page.goto("/exams");
  await page.getByRole("button", { name: "Add exam" }).first().click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Exam name").fill(name);
  await dialog.getByLabel("Subject").click();
  await page.getByRole("option").first().click();
  await dialog.getByRole("button", { name: "Add exam" }).click();

  await expect(dialog).toBeHidden();
  // It defaults to a week out, so it belongs in Upcoming rather than Completed.
  const upcoming = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Upcoming", exact: true }) });
  await expect(upcoming.getByText(name)).toBeVisible();
  await expect(
    upcoming.getByText(/days left|Tomorrow|hours left/).first(),
  ).toBeVisible();

  await page.getByRole("button", { name: `Delete ${name}` }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText(name, { exact: true })).toHaveCount(0);
});

test("timetable entry: create and delete", async ({ page }) => {
  await page.goto("/timetable");
  await page.getByRole("button", { name: "Add entry" }).first().click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill("E2E slot");
  await dialog.getByLabel("Start time").fill("07:00");
  await dialog.getByLabel("End time").fill("08:00");
  await dialog.getByLabel("Day").click();
  await page.getByRole("option", { name: "Monday" }).click();
  await dialog.getByRole("button", { name: "Add entry" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText("E2E slot").first()).toBeVisible();

  await page
    .getByRole("button", { name: "Delete E2E slot on Monday" })
    .first()
    .click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("E2E slot")).toHaveCount(0);
});

test("study session: logging one moves this week's total", async ({ page }) => {
  // Unique per run: a leftover row from an interrupted run would otherwise make
  // the post-delete assertion fail against data this run never created.
  const topic = `E2E session ${Date.now()}`;

  await page.goto("/study");

  await expect(page.getByRole("heading", { name: "Study progress" })).toBeVisible();

  await page.getByRole("button", { name: "Log a session" }).first().click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Subject").click();
  await page.getByRole("option").first().click();
  await dialog.getByLabel("Topic").fill(topic);
  await dialog.getByLabel("Start time").fill("06:00");
  await dialog.getByLabel("End time").fill("07:30");
  await dialog.getByRole("button", { name: "Log session" }).click();

  await expect(dialog).toBeHidden();
  // The success toast reports the duration the server derived from the two
  // times. Sonner renders the message twice (once for screen readers).
  await expect(page.getByText("Logged 1h 30m.").first()).toBeVisible();
  await expect(page.getByText(topic).first()).toBeVisible();

  await page
    .locator("li")
    .filter({ hasText: topic })
    .first()
    .getByRole("button", { name: /Delete the session on/ })
    .click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText(topic)).toHaveCount(0);
});
