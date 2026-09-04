import "dotenv/config";

import { createInterface } from "node:readline";

import { hashPassword } from "better-auth/crypto";
import { createLocalAccountIssuer } from "better-auth/db";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";

/**
 * Attach login credentials to a user row that already exists.
 *
 * Campivo ran single-user before it had authentication: one User row owned
 * every subject, assignment, attendance record and mark, and nothing had a
 * password because nothing needed one. Adding login left that row intact but
 * unreachable — there was no way to sign in as it.
 *
 * This script closes that gap without moving any data. It sets a name, an email
 * and a password on the *existing* row, so everything already pointing at that
 * user id stays pointing at it. Nothing is created, reassigned, or deleted.
 *
 * The alternative — signing up fresh and repointing the old records at the new
 * user — would rewrite a foreign key on every row in the database to reach the
 * same place. This changes two.
 *
 * Usage:
 *
 *   npm run auth:claim -- --list
 *   npm run auth:claim -- --user <id> --email you@example.com --name "Their Name"
 *
 * The password is never a command-line argument. Either it is typed at a prompt
 * with the terminal echo turned off, or it is piped in with `--password-stdin`.
 * Both keep it out of shell history, the process list, and this file. An actual
 * `--password` argument is rejected outright. See {@link resolvePassword}.
 *
 * Every statement it runs is an INSERT or a single-row UPDATE. There is no
 * DELETE, DROP or TRUNCATE anywhere in it, so it is safe against production —
 * but it still shows you the host and asks before writing.
 */

const MIN_PASSWORD_LENGTH = 8;

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

/**
 * The connection string this script uses, which is deliberately not always the
 * one in `.env`.
 *
 * Neon publishes two endpoints for the same database: a pooled one whose host
 * carries `-pooler`, and a direct one without it. The app wants the pooled
 * endpoint — many short-lived serverless invocations is exactly what PgBouncer
 * is for. This script wants the opposite: one interactive transaction, held
 * open across a human typing a password.
 *
 * So the pooled host is rewritten to the direct one here, in this process only,
 * and `.env` is left exactly as it is. Pass `--pooled` to opt out.
 */
function connectionString(): { url: string; rewritten: boolean } {
  const raw = process.env.DATABASE_URL ?? "";
  if (!raw || flag("pooled")) return { url: raw, rewritten: false };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { url: raw, rewritten: false };
  }
  if (!url.hostname.includes("-pooler")) return { url: raw, rewritten: false };

  url.hostname = url.hostname.replace("-pooler", "");
  return { url: url.toString(), rewritten: true };
}

const CONNECTION = connectionString();

const prisma = new PrismaClient({
  // Not `max: 1`. An interactive transaction reserves a connection for its whole
  // duration; with a pool of one there is no second connection to fall back on
  // when the first has gone stale — which is exactly what happens while the
  // password prompt waits for a human.
  adapter: new PrismaPg({ connectionString: CONNECTION.url, max: 5 }),
});

/**
 * How long Prisma may spend acquiring a connection for the transaction, and how
 * long the transaction may then run.
 *
 * The defaults are 2s and 5s, tuned for a warm pool inside a datacentre. This
 * script has neither: by the time it reaches the transaction the connection has
 * sat idle through two password prompts, and re-establishing one to Neon
 * measured 3–4 seconds from here — so the default gives up first, with exactly
 * "Unable to start a transaction in the given time". Twenty seconds is not a
 * hot path; it is a one-shot admin command that must not fail on a slow link.
 */
const TRANSACTION_OPTIONS = { maxWait: 20_000, timeout: 60_000 };

/** The endpoint actually being connected to, with any credentials stripped. */
function describeTarget(): { label: string; isLocal: boolean } {
  try {
    const url = new URL(CONNECTION.url);
    const isLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    return {
      label: `${url.hostname}:${url.port || "5432"}${url.pathname}`,
      isLocal,
    };
  } catch {
    return { label: "an unparseable DATABASE_URL", isLocal: false };
  }
}

/**
 * Read a password from the terminal without echoing it.
 *
 * Node has no built-in hidden prompt, so this mutes the output stream while the
 * line is being typed. It requires a real TTY: piping a password in would
 * defeat the point by putting it somewhere it can be recovered from.
 */
function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(
        new Error(
          "No terminal available to type a password into.\n" +
            "  Run this yourself in a normal terminal — the prompt hides what you type,\n" +
            "  which is the whole point. Do not pass the password as an argument.",
        ),
      );
      return;
    }

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const asMutable = rl as unknown as { output: NodeJS.WriteStream; _writeToOutput?: (s: string) => void };

    process.stdout.write(prompt);
    // Swallow every echoed character while the answer is being typed.
    asMutable._writeToOutput = () => {};

    rl.question("", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function ask(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    }),
  );
}

/**
 * The password, from a prompt or from stdin.
 *
 * `--password-stdin` is the same arrangement `docker login` uses: the secret
 * travels through a pipe rather than through argv, so it is never in the
 * process list and never in shell history. It also makes the claim scriptable,
 * and lets this path be tested — a hidden prompt cannot be driven by a test.
 */
async function resolvePassword(): Promise<string> {
  if (flag("password-stdin")) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    // Trim only the line ending a pipe adds. Everything else, including
    // leading and trailing spaces, is part of the password.
    let password = Buffer.concat(chunks).toString("utf8");
    if (password.endsWith("\n")) password = password.slice(0, -1);
    if (password.endsWith("\r")) password = password.slice(0, -1);
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    return password;
  }
  return readPasswordTwice();
}

/** Asks twice and compares, so a typo cannot lock the account you just claimed. */
async function readPasswordTwice(): Promise<string> {
  const first = await readHidden("  New password (not shown): ");
  if (first.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const second = await readHidden("  Confirm password:        ");
  if (first !== second) throw new Error("Those passwords did not match.");

  return first;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");

  const target = describeTarget();
  console.log(`\nDatabase: ${target.label}${target.isLocal ? "  (local)" : "  ← NOT local"}`);
  if (CONNECTION.rewritten) {
    console.log("          using Neon's direct endpoint for this transaction (.env is untouched)");
  }

  /*
   * --check proves the link end to end without writing anything and without
   * asking for a password. Worth having because the failure it guards against
   * only appears at the transaction — long after the point where a person has
   * already typed their password twice.
   */
  if (flag("check")) {
    const started = process.hrtime.bigint();
    await prisma.$queryRaw`select 1`;
    const connectMs = Number(process.hrtime.bigint() - started) / 1e6;

    const txStarted = process.hrtime.bigint();
    await prisma.$transaction(
      async (tx) => {
        await tx.user.findFirst({ select: { id: true } });
      },
      TRANSACTION_OPTIONS,
    );
    const txMs = Number(process.hrtime.bigint() - txStarted) / 1e6;

    console.log(`
  connection    OK  ${connectMs.toFixed(0)}ms`);
    console.log(`  transaction   OK  ${txMs.toFixed(0)}ms  (budget ${TRANSACTION_OPTIONS.maxWait}ms to start)`);
    console.log(`
  Read-only. Nothing was written.
`);
    return;
  }

  /*
   * The auth migration creates `accounts`. Without it the claim would fail
   * halfway through with a Prisma error about a missing table, so it is
   * checked up front and reported as the actionable thing it is.
   */
  const [{ exists: hasAccounts }] = await prisma.$queryRaw<{ exists: boolean }[]>`
    select exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'accounts'
    ) as exists`;

  if (!hasAccounts) {
    throw new Error(
      "This database has no `accounts` table, so authentication has not been migrated yet.\n" +
        "  Apply it first, against this same DATABASE_URL:\n\n" +
        "      npx prisma migrate deploy\n\n" +
        "  That migration only adds columns and tables — it alters and drops nothing.",
    );
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      _count: {
        select: {
          subjects: true,
          assignments: true,
          tasks: true,
          exams: true,
          timetableEntries: true,
          attendanceRecords: true,
          notes: true,
          assessments: true,
          studySessions: true,
        },
      },
      accounts: { select: { id: true, providerId: true } },
    },
  });

  if (flag("list") || !arg("user")) {
    console.log(`\n${users.length} user row(s):\n`);
    for (const u of users) {
      const c = u._count;
      console.log(`  id       ${u.id}`);
      console.log(`  name     ${u.name}`);
      console.log(`  email    ${u.email}`);
      console.log(`  created  ${u.createdAt.toISOString()}`);
      console.log(
        `  owns     ${c.subjects} subjects · ${c.assignments} assignments · ${c.tasks} tasks · ` +
          `${c.exams} exams · ${c.timetableEntries} timetable · ${c.attendanceRecords} attendance · ` +
          `${c.notes} notes · ${c.assessments} assessments · ${c.studySessions} study sessions`,
      );
      console.log(
        `  login    ${u.accounts.some((a) => a.providerId === "credential") ? "yes" : "NO — cannot sign in"}\n`,
      );
    }
    console.log(
      'Re-run with:  npm run auth:claim -- --user <id> --email <email> --name "<name>"\n' +
        "The password is asked for interactively; never pass it as an argument.\n",
    );
    return;
  }

  const userId = arg("user")!;
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name")?.trim();

  if (!email) throw new Error("--email is required.");
  if (arg("password") !== undefined) {
    throw new Error(
      "Refusing a --password argument: it would be recorded in your shell history\n" +
        "  and visible in the process list. Omit it and type it at the prompt instead.",
    );
  }

  const target_user = users.find((u) => u.id === userId);
  if (!target_user) {
    throw new Error(`No user with id ${userId}. Run with --list to see the options.`);
  }

  const clash = users.find((u) => u.email === email && u.id !== userId);
  if (clash) throw new Error(`Another user (${clash.id}) already uses ${email}.`);

  const c = target_user._count;
  const total =
    c.subjects + c.assignments + c.tasks + c.exams + c.timetableEntries +
    c.attendanceRecords + c.notes + c.assessments + c.studySessions;

  console.log("\nAbout to update this existing row in place:\n");
  console.log(`  ${target_user.name}  <${target_user.email}>`);
  console.log(`    name  →  ${name ?? "(unchanged)"}`);
  console.log(`    email →  ${email}`);
  console.log(`    password: set\n`);
  console.log(`  It owns ${total} records. None of them are touched — only the two`);
  console.log(`  columns above, plus one new row in \`accounts\` for the credential.\n`);

  if (!flag("yes")) {
    if (flag("password-stdin")) {
      throw new Error("--password-stdin needs --yes as well: stdin is the password, so it cannot also answer a prompt.");
    }
    const answer = await ask('Type "claim" to proceed: ');
    if (answer !== "claim") {
      console.log("\nCancelled. Nothing was written.\n");
      return;
    }
  }

  const password = await resolvePassword();

  /*
   * Hash before the transaction opens, not inside it.
   *
   * scrypt is deliberately slow — that is the whole point of it — and doing it
   * between BEGIN and COMMIT holds a database connection open for the duration
   * for no reason. Nothing here needs the database, so it happens first.
   */
  const hashed = await hashPassword(password);

  /*
   * Wake the connection before asking for a transaction.
   *
   * The pool has been idle through two password prompts, by which point Neon
   * has usually dropped the connection. A plain query re-establishes it outside
   * the transaction's `maxWait` budget, so that budget is spent on starting the
   * transaction rather than on a TLS handshake across a continent.
   */
  await prisma.$queryRaw`select 1`;

  // One transaction: an email change that landed without its credential would
  // lock the account out of both the old address and the new.
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { email, emailVerified: true, ...(name ? { name } : {}) },
    });

    const existing = await tx.account.findFirst({
      where: { userId, providerId: "credential" },
      select: { id: true },
    });

    if (existing) {
      await tx.account.update({ where: { id: existing.id }, data: { password: hashed } });
    } else {
      await tx.account.create({
        data: {
          userId,
          accountId: userId,
          providerId: "credential",
          // Asked of the library rather than hard-coded: sign-in matches on it.
          issuer: createLocalAccountIssuer("credential"),
          password: hashed,
        },
      });
    }

    // Predates settings, or they were never created. Without them the app
    // cannot render a page.
    const settings = await tx.userSettings.findUnique({ where: { userId } });
    if (!settings) {
      const { DEFAULT_GRADING_SCALE } = await import("../src/lib/calculations/marks.js");
      await tx.userSettings.create({ data: { userId, gradingScale: DEFAULT_GRADING_SCALE } });
    }
  }, TRANSACTION_OPTIONS);

  const after = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      _count: { select: { subjects: true, assignments: true, attendanceRecords: true, studySessions: true } },
    },
  });

  console.log(`\n✓ ${after!.name} can now log in as ${after!.email}`);
  console.log(
    `  Still owns ${after!._count.subjects} subjects, ${after!._count.assignments} assignments, ` +
      `${after!._count.attendanceRecords} attendance records and ${after!._count.studySessions} study sessions.\n`,
  );
}

main()
  .catch((error) => {
    console.error(`\n✗ ${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
