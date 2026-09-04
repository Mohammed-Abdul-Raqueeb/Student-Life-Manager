import "dotenv/config";

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
 * This script closes that gap without moving any data. It sets an email and a
 * password on the *existing* row, so everything already pointing at that user id
 * stays pointing at it. Nothing is created, reassigned, or deleted.
 *
 * The alternative — signing up fresh and repointing the old records at the new
 * user — would rewrite a foreign key on every row in the database to achieve
 * the same end. This changes two.
 *
 * Usage:
 *
 *   npm run auth:claim -- --list
 *   npm run auth:claim -- --user <id> --email you@example.com --password '<pw>'
 *
 * Run it against whichever database DATABASE_URL points at. It is safe to run
 * against production: it performs no destructive statement of any kind.
 */

const MIN_PASSWORD_LENGTH = 8;

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 1 }),
});

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set.");
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
          attendanceRecords: true,
          studySessions: true,
        },
      },
      accounts: { select: { id: true, providerId: true } },
    },
  });

  if (process.argv.includes("--list") || !arg("user")) {
    console.log(`\n${users.length} user row(s) in this database:\n`);
    for (const u of users) {
      const hasLogin = u.accounts.some((a) => a.providerId === "credential");
      console.log(`  id       ${u.id}`);
      console.log(`  name     ${u.name}`);
      console.log(`  email    ${u.email}`);
      console.log(`  created  ${u.createdAt.toISOString()}`);
      console.log(
        `  owns     ${u._count.subjects} subjects · ${u._count.assignments} assignments · ` +
          `${u._count.attendanceRecords} attendance · ${u._count.studySessions} study sessions`,
      );
      console.log(`  login    ${hasLogin ? "yes — already has a password" : "NO — cannot sign in"}\n`);
    }
    console.log(
      "Re-run with:  npm run auth:claim -- --user <id> --email <email> --password '<password>'\n",
    );
    return;
  }

  const userId = arg("user")!;
  const email = arg("email")?.trim().toLowerCase();
  const password = arg("password");

  if (!email || !password) {
    throw new Error("Both --email and --password are required.");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const target = users.find((u) => u.id === userId);
  if (!target) {
    throw new Error(`No user with id ${userId}. Run with --list to see the options.`);
  }

  const clash = users.find((u) => u.email === email && u.id !== userId);
  if (clash) {
    throw new Error(`Another user (${clash.id}) already uses ${email}.`);
  }

  // Both writes in one transaction: an email change that landed without its
  // credential would lock the account out of both the old address and the new.
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { email, emailVerified: true },
    });

    const existing = await tx.account.findFirst({
      where: { userId, providerId: "credential" },
      select: { id: true },
    });

    const hashed = await hashPassword(password);

    if (existing) {
      await tx.account.update({
        where: { id: existing.id },
        data: { password: hashed },
      });
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
      const { DEFAULT_GRADING_SCALE } = await import(
        "../src/lib/calculations/marks.js"
      );
      await tx.userSettings.create({
        data: { userId, gradingScale: DEFAULT_GRADING_SCALE },
      });
    }
  });

  console.log(`\n✓ ${target.name} can now log in as ${email}`);
  console.log(
    `  Still owns ${target._count.subjects} subjects, ${target._count.assignments} assignments, ` +
      `${target._count.attendanceRecords} attendance records and ${target._count.studySessions} study sessions.\n`,
  );
}

main()
  .catch((error) => {
    console.error(`\n✗ ${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
