# College Course Registration

A student-facing course registration system built with TypeScript, Express, PostgreSQL, Prisma, Passport Local, and server-rendered EJS pages.

The interface is intentionally plain: HTML tables, forms, and a small amount of CSS. There is no client-side framework.

## Features

- Student login with email and password
- Passport Local authentication
- HttpOnly session cookie backed by a PostgreSQL session store
- Semester course catalog with:
  - course code and title
  - credits
  - faculty, room, and schedule
  - prerequisites
  - available seats and waitlist count
- Multi-course selection
- Server-side registration validation:
  - prerequisite completion
  - available seats
  - duplicate registration
  - per-semester credit limit
- Waitlist option for full courses
- All-or-nothing registration confirmation
- Confirmation page with registered course details
- Registration history and academic record
- Seed data with students, courses, prerequisites, and a full course for waitlist testing

## Stack

- **Runtime:** Node.js + TypeScript
- **Server:** Express 5
- **Views:** EJS
- **Database:** PostgreSQL
- **ORM:** Prisma 6
- **Auth:** Passport Local + `express-session`
- **Session store:** `connect-pg-simple`
- **Password hashing:** `bcryptjs`
- **Validation:** Zod
- **Tests:** Vitest
- **Deployment:** Vercel serverless function + Neon PostgreSQL

## Getting started

### Requirements

- Node.js 20 or newer
- PostgreSQL

Install dependencies:

```bash
npm install
```

### Database

Create a database and copy the environment file:

```bash
cp .env.example .env
```

The example URL assumes a PostgreSQL role and database:

```text
DATABASE_URL="postgresql://college:college_dev_password@localhost:5432/college_registration?schema=public"
DATABASE_URL_UNPOOLED="postgresql://college:college_dev_password@localhost:5432/college_registration?schema=public"
```

`DATABASE_URL` is used by the app and Prisma Client. `DATABASE_URL_UNPOOLED` is used by Prisma migrations. For local PostgreSQL, both can point at the same database.

Create them if needed:

```sql
CREATE ROLE college LOGIN PASSWORD 'college_dev_password';
CREATE DATABASE college_registration OWNER college;
```

If your local PostgreSQL server uses peer/ident authentication, adjust `pg_hba.conf` or use a project-local cluster instead.

#### Project-local PostgreSQL cluster

A local cluster is useful when you do not want to change the system PostgreSQL configuration. This repository was developed with one on port `55432`:

```bash
initdb -D .pgdata --auth=trust --username="$USER" --no-locale --encoding=UTF8
pg_ctl -D .pgdata -o "-p 55432 -k /tmp" -l .pgdata/server.log start
createdb -h 127.0.0.1 -p 55432 -U "$USER" college_registration
```

Use this `.env` value:

```text
DATABASE_URL="postgresql://YOUR_USER@127.0.0.1:55432/college_registration?schema=public"
DATABASE_URL_UNPOOLED="postgresql://YOUR_USER@127.0.0.1:55432/college_registration?schema=public"
```

Stop the local cluster with:

```bash
pg_ctl -D .pgdata stop
```

The `session` table is created by the `session_table` migration and is used by `connect-pg-simple`. It is also represented in the Prisma schema so migrations do not treat it as an unknown table.

### Migrate and seed

```bash
npm run db:migrate
npm run db:seed
```

The seed script is idempotent and can be run again safely.

### Run

```bash
npm run dev
```

Open <http://localhost:3000>.

For a production-style build:

```bash
npm run build
npm start
```

## Deploying to Vercel with Neon

The app runs on Vercel as a Node.js serverless function (`api/index.ts`) and stores data in Neon PostgreSQL.

### 1. Create the Neon database

Create a project in the [Neon console](https://console.neon.tech), then copy both connection strings:

- **Pooled** connection string — the host contains `-pooler`
- **Direct** connection string — the host does not contain `-pooler`

Use the pooled URL for the app and the direct URL for migrations:

```text
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connection_limit=1"
DATABASE_URL_UNPOOLED="postgresql://USER:PASSWORD@ep-xxxx.REGION.aws.neon.tech/neondb?sslmode=require"
```

`pgbouncer=true` and `connection_limit=1` are important for Prisma when running behind Neon's pooled endpoint. The session store uses the same pooled URL with a small per-instance pool.

### 2. Apply migrations and seed

Run these locally with the Neon URLs:

```bash
DATABASE_URL="..." DATABASE_URL_UNPOOLED="..." npm run db:deploy
DATABASE_URL="..." DATABASE_URL_UNPOOLED="..." npm run db:seed
```

Use `db:deploy`, not `db:migrate`, against Neon. The seed creates the demo students and courses. The demo password is public, so replace the seed or create real accounts before storing real student data.

### 3. Configure Vercel

Import the Git repository in Vercel, or use the CLI:

```bash
npx vercel
```

Add these environment variables in the Vercel project settings:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string |
| `DATABASE_URL_UNPOOLED` | Neon direct connection string |
| `SESSION_SECRET` | Random string, at least 32 characters |

Generate a session secret with:

```bash
openssl rand -hex 32
```

Set the variables for Production. Use a separate Neon development branch for Preview deployments rather than sharing production data.

Vercel sets `NODE_ENV=production` automatically. The app then uses secure session cookies, so access it over the Vercel HTTPS URL.

### 4. Deploy

```bash
npx vercel --prod
```

Or push to the connected Git branch. Vercel runs `npm run build`, which generates Prisma Client before compiling the app.

### Vercel notes

- `api/index.ts` exports the Express app as a serverless handler. `src/server.ts` remains the entry point for local or long-running hosting.
- `vercel.json` rewrites requests to the function and includes `views/` and `public/` in the function bundle.
- The `session` table is created by the Prisma migration; `connect-pg-simple` does not create it at runtime.
- Prisma includes the `rhel-openssl-3.0.x` query engine for the Vercel Node runtime.
- The session store and Prisma Client are cached across warm serverless invocations to reduce connection churn.
- The PostgreSQL session pool is attached to Vercel's lifecycle with `attachDatabasePool`.
- Node's address-selection attempt timeout is raised to at least 2 seconds to accommodate cross-region connections; the pool has a 10-second connection timeout.
- Neon's pooled endpoint is required for production; direct connections can be exhausted quickly by serverless scaling.

### Linked Neon project

`neon.ts` preserves the PostgreSQL-only setup and existing Passport login; Neon Auth is not enabled. The local `.neon` link is gitignored. To reconcile services and refresh credentials in `.env`:

```bash
npx neon@latest deploy
npm run db:deploy
```

Neon writes `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct); Prisma uses those names without a manually maintained `DIRECT_URL` alias. Neither `.env` nor `.env.local` should be committed. Migrations and normal app queries require outbound access to PostgreSQL port 5432.

## Demo accounts

All demo students use the password `Student123!`.

| Student | Email | Scenario |
| --- | --- | --- |
| Alice Morgan | `alice@college.edu` | Has completed CS101 and MATH101; can register for several courses |
| Bob Chen | `bob@college.edu` | Missing the CS101 prerequisite for CS102 |
| Carol Diaz | `carol@college.edu` | Holds the last seat in ART101 |

ART101 has a capacity of 1, so Alice can use it to test the waitlist flow.

## Registration rules

A registration is checked on the review page and checked again inside the confirmation transaction:

1. The semester must be open.
2. Every selected course must belong to the open semester.
3. The student must not already be enrolled or waitlisted in the same offering.
4. Every prerequisite must appear in the student's completed courses.
5. A seat must be available, unless the student chose to join the waitlist.
6. Current enrolled credits plus new enrolled credits must not exceed the semester limit.
7. Waitlisted courses do not count toward the credit limit.
8. Missing prerequisites block both enrollment and waitlisting.

Confirmation is all-or-nothing. If any selected course still has an error, nothing is written. Full courses with the waitlist option selected are accepted as waitlist entries.

Seat assignment runs in a serializable transaction with row-level locks on the selected offerings. This prevents two students from taking the last seat concurrently.

## Routes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Redirect to courses or login |
| `GET` | `/login` | Login form |
| `POST` | `/login` | Passport Local login |
| `POST` | `/logout` | Destroy session |
| `GET` | `/courses` | Course catalog and selection form |
| `POST` | `/courses/select` | Save the selection draft in the session |
| `GET` | `/registration/review` | Validate and review the draft |
| `POST` | `/registration/confirm` | Revalidate and register |
| `GET` | `/registrations` | Registration history |
| `GET` | `/registrations/:id` | Registration details |
| `GET` | `/records` | Completed courses and registration history |

## Project structure

```text
api/
  index.ts               Vercel serverless entry point
prisma/
  schema.prisma
  seed.ts
  migrations/
public/
  courses.js
  styles.css
src/
  app.ts                 Express app setup
  server.ts              HTTP server and shutdown handling
  auth/passport.ts       Passport Local strategy
  config/env.ts          Environment validation
  db.ts                  Prisma client
  middleware/            Auth, CSRF, flash
  routes/                Auth, courses, registration, records
  services/              Catalog, validation, registration, records
  session.ts             PostgreSQL session store
  types/                 Express and session type augmentation
  utils/
tests/
  registration.test.ts
vercel.json              Vercel function and rewrite configuration
views/
  partials/
  login.ejs
  courses.ejs
  review.ejs
  registrations.ejs
  confirmation.ejs
  records.ejs
  404.ejs
  error.ejs
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the server with `tsx watch` |
| `npm run build` | Generate Prisma Client and compile TypeScript to `dist/` |
| `npm start` | Run the compiled server |
| `npm run typecheck` | Type-check without emitting |
| `npm test` | Run Vitest tests |
| `npm run db:migrate` | Create/apply development migrations |
| `npm run db:deploy` | Apply existing migrations |
| `npm run db:seed` | Seed demo data |
| `npm run db:reset` | Reset the database and reseed |
| `npm run db:studio` | Open Prisma Studio |

## Security notes

- Passwords are hashed with bcrypt.
- Session IDs are stored in PostgreSQL; the browser receives only an HttpOnly cookie.
- Session IDs are regenerated after login.
- Cookies use `SameSite=Lax` and `Secure` in production. Production deployments must use HTTPS; use `NODE_ENV=development` for local HTTP.
- POST requests require a per-session CSRF token.
- All protected pages use authentication middleware.
- Registration details are scoped to the signed-in student.
- Helmet is enabled.
- Prisma parameterizes database queries.

## Scope notes

- Student-facing only; there is no admin UI.
- Terms, courses, offerings, prerequisites, and completed courses are managed through the seed/database.
- Waitlists show a position but do not auto-promote. There is no drop-course flow.
- The active semester is the most recent term with `registrationOpen = true`.
- The default credit limit is 18 and is stored per term.
