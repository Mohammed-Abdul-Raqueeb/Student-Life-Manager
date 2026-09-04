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
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: {
    command: `next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
