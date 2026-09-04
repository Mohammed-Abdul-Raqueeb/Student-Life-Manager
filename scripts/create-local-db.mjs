/**
 * Creates the `studentlife` database on the local `prisma dev` server.
 *
 * `prisma dev` starts a real PostgreSQL server but only provisions `template1`,
 * so the app's own database has to be created once before migrations can run.
 * Safe to re-run: an existing database is left alone.
 *
 *   node scripts/create-local-db.mjs
 */
import "dotenv/config";
import { Client } from "pg";

const target = process.env.DATABASE_URL;
if (!target) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env first.");
  process.exit(1);
}

const url = new URL(target);
const dbName = url.pathname.replace(/^\//, "");
if (!dbName) {
  console.error(`DATABASE_URL has no database name: ${target}`);
  process.exit(1);
}

// Connect to template1 (always present) to issue the CREATE DATABASE.
const adminUrl = new URL(target);
adminUrl.pathname = "/template1";

const client = new Client({ connectionString: adminUrl.toString() });
await client.connect();

try {
  // The database name comes from our own .env, and CREATE DATABASE does not
  // accept a bound parameter, so it is quoted rather than parameterised.
  await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
  console.log(`Created database "${dbName}".`);
} catch (error) {
  if (error.code === "42P04") console.log(`Database "${dbName}" already exists.`);
  else throw error;
} finally {
  await client.end();
}
