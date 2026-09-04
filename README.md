# Campivo

A personal academic dashboard: subjects, assignments, exams, timetable,
attendance, notes, marks and study progress in one place, backed by PostgreSQL.

It is built to answer the questions a student actually asks — *what is due
today, which subject's attendance is in trouble, how many classes must I attend
to fix it, how am I doing, how much have I studied this week* — and to answer
them from real records rather than from stored summaries.

---

## Quick start

```bash
npm install

# 1. A local PostgreSQL 17 server, no Docker and no cloud account needed.
#    Leave this running in its own terminal, or add -d to detach.
npm run db:dev

# 2. Point .env at it and provision the schema + demo data.
cp .env.example .env          # then set DATABASE_URL (see below)
npm run db:create             # creates the database itself
npm run db:deploy             # applies the committed migration
npm run db:seed               # loads a term of realistic demo data

# 3. Run it.
npm run dev                   # http://localhost:3000
```

The seed creates a demo student you can log straight in as:

```
student@campivo.local / campivo-demo-1234
```

Or create your own account at `/signup` — it starts empty.

`npm run db:dev` prints a connection string like
`postgres://postgres:postgres@localhost:51214/template1`. Copy it into `.env`
with the database name changed to `studentlife`:

```
DATABASE_URL="postgres://postgres:postgres@localhost:51214/studentlife?sslmode=disable"
```

That is the only variable the app needs.

Any PostgreSQL 14+ server works just as well — a local install, a container, or
a Neon branch. **If you already have Postgres running, point `DATABASE_URL` at
it and skip step 1**; that is the more robust option.

### If the bundled server stops responding

`prisma dev` runs PostgreSQL compiled to WebAssembly. It is genuinely
convenient — no Docker, no account, no password — but under sustained load it
can start refusing connections (`ECONNRESET`, or Prisma reporting
`Connection terminated unexpectedly`) while still reporting itself as running.
`prisma dev rm` does **not** clear the corrupted state; the server's data
directory has to go:

```bash
npx prisma dev stop slm
rm -rf "$LOCALAPPDATA/prisma-dev-nodejs/Data"   # ~/.local/share on Linux/macOS
npm run db:dev
npm run db:create && npm run db:deploy && npm run db:seed
```

For the same reason `.env` sets `DATABASE_POOL_MAX=1` for local development —
that server handles one client at a time, and a wider pool is what tips it over.
Leave the variable unset against a real PostgreSQL or Neon, where the default
pool of 5 applies.

---

## Deploying to Vercel

1. Create a Neon project and copy the **pooled** connection string.
2. Set `DATABASE_URL` to it, plus `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`
   (see [Authentication](#authentication)). Do **not** try to set `TZ` — Vercel
   reserves it, which is why the zone is pinned in code (see
   [Timezone](#timezone)).
3. Deploy. `npm run build` runs `prisma generate` first, and `postinstall`
   regenerates the client on the build machine.
4. Apply migrations once with `npm run db:deploy` (from CI or a dev machine
   pointed at the production URL). The app never migrates itself at runtime.

No secret is hardcoded anywhere; `.env` is gitignored and `.env.example`
documents every variable.

---

## Authentication

Email and password, with database-backed sessions.
[`better-auth`](https://better-auth.com) handles the credential and session
mechanics; the app owns the pages, the validation and the authorization.

**Sign up** creates the user, hashes the password with scrypt, and creates the
student's `UserSettings` in the same transaction — an account can never exist in
a half-built state. **Log in** and **log out** are server actions, so the
password never enters client state and the redirect is the server's decision.
Logging out deletes the session *row*, which is what makes it real: the cookie
stops resolving everywhere at once, not just in the browser that dropped it.

### Where authorization actually happens

Not in the navigation. There are three independent layers, and only the last
two are load-bearing:

1. `src/proxy.ts` turns away requests with no session cookie. It is a cheap
   check that saves a render — it does not verify the cookie, and a forged one
   gets past it.
2. `src/app/(app)/layout.tsx` calls `requireUser()`, which verifies the session
   against the database. One call covers every page beneath it.
3. **Every query and every mutation** scopes on the id from that verified
   session. `getCurrentUser()` in [`src/lib/db/user.ts`](src/lib/db/user.ts) is
   the only source of a user id in the entire app — no id is ever read from a
   URL, a form field or a request body, so there is none to tamper with.

That third layer is the one that matters. A request carrying another student's
subject id reaches the same `where: { id, userId }` clause and matches nothing,
whether it came from a link, a crafted POST, or a script. `e2e/isolation.spec.ts`
asserts this by having one account drive the app with another's ids rather than
by checking that a link is hidden.

### Existing data

Campivo ran single-user before it had login: one `User` row owned everything,
and had no password because nothing needed one. That row is untouched by the
migration and still owns its data — it simply has no way to sign in.

`npm run auth:claim` attaches credentials to it in place:

```bash
npm run auth:claim -- --list          # show the user rows and what each owns
npm run auth:claim -- --user <id> --email you@example.com --password '<pw>'
```

Nothing is created, reassigned or deleted; it sets an email and writes one
`Account` row, so every record already pointing at that user id keeps pointing
at it. The alternative — signing up fresh and repointing the old rows — would
rewrite a foreign key on every row in the database to reach the same place.

### Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | production | Signs session cookies; at least 32 characters and identical across instances. The app refuses to boot without it rather than falling back to a per-cold-start value that would log people out at random. `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | recommended | The canonical origin, e.g. `https://campivo.vercel.app`. Also decides whether cookies are `Secure` — that follows the URL scheme, not `NODE_ENV`, because `next start` is a production build served over plain http and browsers reject `__Secure-` cookies there. |

---

## Timezone

The app's calendar is **Asia/Kolkata**, pinned in code as `APP_TIME_ZONE` in
[`src/lib/date.ts`](src/lib/date.ts). Nothing needs configuring, and there is
deliberately no environment variable for it.

The usual way to do this is the `TZ` variable, but Vercel reserves `TZ` and
will not accept it, so a deployed serverless function runs on UTC. That matters
more than it sounds: between 18:30 UTC and midnight UTC it is already *tomorrow*
in India, so for five and a half hours every single day a UTC host would put
"Today", every countdown, every overdue badge and the timetable's current-day
highlight one day behind what the student sees on their own clock.

So the zone lives in the application instead. Instants — `dueDate`, `examDate`,
`startedAt` — are stored as real timestamps and never rewritten, because a point
in time is the same number everywhere. What is zoned is the *reading* of an
instant as a calendar day, and every one of those routes through `inAppZone()`.
The upshot is that correctness no longer depends on how the process was
launched: a laptop in any zone, CI, and production all agree on what day it is.

The unit suite runs under `TZ=UTC` — production's clock, not the developer's —
so a regression fails on the machine that can still fix it. To check the app
really is host-independent, run it under a few hostile zones:

```bash
VITEST_TZ=Pacific/Kiritimati npx vitest run   # UTC+14
VITEST_TZ=America/Los_Angeles npx vitest run  # UTC-7
VITEST_TZ=Australia/Eucla npx vitest run      # UTC+8:45
```

To move the app to another zone, change that one constant.

---

## How it is put together

```
prisma/
  schema.prisma        the relational schema
  migrations/          committed SQL, applied by db:deploy
  seed.ts              a term of demo data for a fictional student
src/
  app/                 one folder per page, plus loading and error boundaries
  actions/             server actions — every mutation in the app
    types.ts             client-safe result types (forms import these)
    shared.ts            server-only helpers: validation, ownership, errors
  components/
    ui/                  shadcn/ui primitives
    shared/              form dialog, empty states, badges, stat cards
    charts/              Recharts wrappers with one shared chrome
    <feature>/           per-feature components
  lib/
    calculations/        pure, unit-tested arithmetic
    validations/         Zod schemas, shared by forms and actions
    db/                  Prisma client, queries, current user
e2e/                   Playwright: real browser, real database
```

Four ideas hold it together:

**Derived numbers are never stored.** Attendance percentages, weighted subject
scores and study durations are computed from the underlying rows on every read,
by the pure functions in `src/lib/calculations`. A total can therefore never
drift out of step with the history behind it.

**Pages do not touch the database.** Every read goes through
`src/lib/db/queries.ts`, which returns a view model with the arithmetic already
done. Counts come back as `groupBy` aggregates rather than as rows to be counted
in JavaScript, and each page issues a small fixed number of queries.

**Mutations are validated twice and trusted once.** Forms parse with a Zod
schema for instant feedback; the server action re-parses the same schema before
touching the database, and checks that any `subjectId` in the payload actually
belongs to the signed-in student. A crafted request gets the same treatment as
the UI.

**Colour never carries meaning alone.** Status is always paired with a word or
an icon; subject accents identify a subject and never indicate state. The chart
palette is validated for the lightness band, chroma floor, colour-vision
separation and contrast in both light and dark mode.

### Attendance arithmetic

The advice the app gives has to be literally true, so it is computed in integers
— percentages are compared as `attended × 100 ≥ target × conducted` rather than
by dividing first:

- **classes needed** is the smallest `x` with `(A + x) / (C + x) ≥ T`
- **classes you can miss** is the largest `x` with `A / (C + x) ≥ T`

`src/lib/calculations/attendance.test.ts` sweeps every `(attended, conducted)`
pair up to 40 classes against six targets and asserts both that the answer works
and that one fewer (or one more) does not.

### Two kinds of date

Instants (`dueDate`, `examDate`, `startedAt`) are timestamps; calendar dates
(attendance, assessment dates) are `date` columns that Prisma returns at UTC
midnight. `src/lib/date.ts` is the only place that knows the difference, and the
only place that knows which zone the calendar runs on — see
[Timezone](#timezone). All formatting happens on the server and reaches client
components as strings, so there is no clock to disagree about at hydration time.

### Single user, multi-user shaped

There is no login. `src/lib/db/user.ts` resolves the one student row (creating
it on first run) and every query and mutation scopes on the id it returns. Leaf
tables carry `userId` alongside `subjectId`, so adding authentication later
means changing that one file — not the callers, and not the schema.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run auth:claim` | Attach a login to an existing user row (see [Authentication](#authentication)) |
| `npm run build` | `prisma generate` then a production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | Route typegen + `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Unit tests for the calculations (Vitest) |
| `npm run test:e2e` | Browser tests against a build and the real database |
| `npm run db:dev` | Start the bundled local PostgreSQL server |
| `npm run db:create` | Create the database on that server |
| `npm run db:migrate` | Create and apply a migration from schema changes |
| `npm run db:deploy` | Apply committed migrations (production) |
| `npm run db:seed` | Load the demo data |
| `npm run db:reset` | Drop, re-migrate and re-seed |
| `npm run db:studio` | Prisma Studio |

## Testing

`npm test` covers the arithmetic: attendance targets and recovery maths,
weighted and unweighted subject scores, grade bands, study durations across
midnight, weekly totals, and the merged deadline stream.

`npm run test:e2e` covers what only exists once it is wired together — every
page rendering without a console error or hydration warning, assignment and task
CRUD end to end, attendance recording being idempotent, server-side validation
surfacing in the dialog, dark mode, and no horizontal overflow at 390px.
