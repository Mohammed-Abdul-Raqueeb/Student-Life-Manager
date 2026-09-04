# Student Life Manager

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

`npm run db:dev` prints a connection string like
`postgres://postgres:postgres@localhost:51214/template1`. Copy it into `.env`
with the database name changed to `studentlife`:

```
DATABASE_URL="postgres://postgres:postgres@localhost:51214/studentlife?sslmode=disable"
TZ="Asia/Kolkata"
```

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
2. Set `DATABASE_URL` to it, and `TZ` to the student's timezone — serverless
   hosts default to UTC, and every "today" and "days remaining" figure in the
   app is evaluated in the server's zone.
3. Deploy. `npm run build` runs `prisma generate` first, and `postinstall`
   regenerates the client on the build machine.
4. Apply migrations once with `npm run db:deploy` (from CI or a dev machine
   pointed at the production URL). The app never migrates itself at runtime.

No secret is hardcoded anywhere; `.env` is gitignored and `.env.example`
documents every variable.

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

### Timezone

Instants (`dueDate`, `examDate`, `startedAt`) are timestamps; calendar dates
(attendance, assessment dates) are `date` columns that Prisma returns at UTC
midnight. `src/lib/date.ts` is the only place that knows the difference. All
formatting happens on the server and reaches client components as strings, so
there is no clock to disagree about at hydration time.

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
