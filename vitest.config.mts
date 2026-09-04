import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**"],
    // Run on the production host's clock. Vercel reserves `TZ` and pins it to
    // UTC, while the app's calendar is Asia/Kolkata — so UTC here is what
    // actually exercises the gap between the two. A zone bug that would only
    // show up in production fails here instead, on the machine that can still
    // do something about it.
    // Override with VITEST_TZ to prove the suite is independent of the host.
    env: { TZ: process.env.VITEST_TZ ?? "UTC" },
  },
});
