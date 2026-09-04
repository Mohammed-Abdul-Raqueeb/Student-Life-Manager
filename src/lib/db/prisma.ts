import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

// One adapter for every environment: the local `prisma dev` server, a self-hosted
// Postgres, and Neon's pooled endpoint all speak the same wire protocol, so there
// is no dev/prod driver split to get wrong.
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and point it at a PostgreSQL database.",
    );
  }

  // Keep the pool small and deliberate. Pages fan out with `Promise.all`, so an
  // unbounded pool opens a burst of connections per request — which a serverless
  // deployment multiplies by every warm instance, and which small local servers
  // simply refuse. Five is comfortably more than the widest fan-out in
  // `src/lib/db/queries.ts` while staying inside Neon's free-tier limits.
  const max = Number(process.env.DATABASE_POOL_MAX ?? 5);

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max: Number.isFinite(max) && max > 0 ? max : 5,
      // Hold connections open instead of recycling them. Reconnect churn is the
      // expensive part on a serverless host (a warm instance reuses its pool
      // across invocations) and the part that small local servers cope with
      // worst; an idle TCP connection costs nothing by comparison.
      idleTimeoutMillis: 0,
      connectionTimeoutMillis: 10_000,
    }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Next.js clears the module registry on every hot reload; without this the dev
// server would leak a connection pool per edit.
const globalForPrisma = globalThis as typeof globalThis & {
  __studentLifePrisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.__studentLifePrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__studentLifePrisma = prisma;
}
