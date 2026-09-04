import { test as setup, expect } from "@playwright/test";

/**
 * Signs in as the seeded demo student once, and saves the session for the CRUD
 * suite to reuse.
 *
 * Those tests exercise the academic features against the seeded dataset and
 * have nothing to say about authentication, so having each of them log in would
 * add a page load per test to prove something `auth.spec.ts` already proves.
 * The auth and isolation suites deliberately do NOT use this state — they
 * create their own accounts, because who is signed in is the thing under test.
 */

const STORAGE_STATE = "e2e/.auth/student.json";

setup("authenticate as the seeded student", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email").fill("student@campivo.local");
  await page.getByLabel(/^Password/).fill("campivo-demo-1234");
  await page.getByRole("button", { name: "Log in" }).click();

  await page.waitForURL("/");
  await expect(
    page.getByRole("button", { name: /Account menu for Aarav Shah/ }),
  ).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
