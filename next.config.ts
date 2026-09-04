import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `pg` and the Prisma adapter are Node-native: they reach for `util/types`
  // and other built-ins that the bundler cannot resolve. Marking them external
  // leaves them to Node's own resolver at runtime, where they work fine.
  serverExternalPackages: ["pg", "pg-native", "@prisma/adapter-pg"],

  typedRoutes: true,
};

export default nextConfig;
