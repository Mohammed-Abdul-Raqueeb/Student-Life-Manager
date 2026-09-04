import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * The end-to-end suite runs against a production build and the real database,
 * because the things it checks — server actions writing rows, revalidation
 * re-rendering the page, hydration staying quiet — only behave correctly there.
 *
 * Workers are capped at one: the tests share a single student's data, and the
 * local dev Postgres does not enjoy several clients at once.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: "retain-on-failure",
  },

  projects: [
    // Signs in once as the seeded student and saves the cookie.
    { name: "setup", testMatch: /auth.setup.ts/ },

    {
      // The academic features, driven as a signed-in student. They are about
      // subjects and attendance, not about logging in, so they reuse one
      // session rather than each establishing their own.
      name: "app",
      testMatch: /crud.spec.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/student.json",
      },
    },

    {
      // Authentication and isolation start signed out on purpose: each test
      // creates the accounts it needs, because *who is signed in* is precisely
      // what these assert.
      name: "auth",
      testMatch: /(auth|isolation).spec.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: `next start --port ${PORT}`,
    env: {
      // The suite runs on its own port; without this the auth library warns
      // that it cannot determine its own origin and falls back to guessing
      // from each request.
      BETTER_AUTH_URL: baseURL,
    },
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
