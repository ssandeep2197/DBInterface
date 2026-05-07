# DBInterface

A self-hosted MySQL admin UI — sign in with your MySQL root password, browse databases, manage tables, and edit rows from a clean web UI. Originally a single-file Node script; rebuilt as a TypeScript Nx monorepo with a layered Express API and a React + Vite frontend.

```
┌──────────────┐   cookies + JSON    ┌──────────────────┐    mysql2 pool    ┌──────────┐
│  React (web) │ ─────────────────▶  │  Express (api)   │ ────────────────▶ │  MySQL   │
│  Vite + RQ   │                     │  TS, layered     │                   │   8.x    │
└──────────────┘                     └──────────────────┘                   └──────────┘
```

## Stack

| Layer           | Choice                                                                  |
| --------------- | ----------------------------------------------------------------------- |
| Monorepo        | Nx 18 with npm workspaces                                               |
| Language        | TypeScript 5 (strict)                                                   |
| API             | Express 4, helmet, cors, express-session, express-rate-limit, pino     |
| DB              | mysql2 (promise + pool), parameterized queries, identifier allowlist    |
| Validation      | Zod (shared schemas in `libs/shared`)                                   |
| API docs        | OpenAPI 3.1 + Swagger UI at `/api/docs`                                 |
| Frontend        | React 18, Vite 5, React Router, TanStack Query                          |
| Tests           | Vitest + supertest                                                       |
| Tooling         | ESLint, Prettier, EditorConfig, GitHub Actions                          |
| Container       | Multi-stage Dockerfiles, docker-compose with MySQL                      |

## Repo layout

```
apps/
  api/        Express + TypeScript API (routes → services → repositories)
  web/        React + Vite SPA
libs/
  shared/     Zod schemas + types shared by api and web
docker/       Dockerfiles + nginx config for the web build
.github/      CI workflow
```

### `apps/api`

Layered, easy to test:

```
src/
  config/env.ts          Zod-validated env vars (fail fast on misconfig)
  lib/
    logger.ts            pino with pretty transport in dev, redaction always on
    http-error.ts        Typed HttpError thrown by services/routes
    sql.ts               quoteIdent / quoteRef — only place identifiers go to SQL
    openapi.ts           OpenAPI spec served at /api/docs
  db/pool.ts             mysql2 connection pool
  middleware/            request-id, auth, validate, error-handler, async-handler
  repositories/          Only layer that builds SQL (database/table/row)
  services/              Business logic, system-DB guards, column existence checks
  routes/                Thin handlers wired with Zod validators
  app.ts                 Express composition (helmet, cors, session, rate-limit)
  main.ts                Entry point — graceful shutdown on SIGINT/SIGTERM
```

**Security upgrades over the original:**

- All values pass through `mysql2` placeholders. All identifiers (db / table / column names) pass through a strict allowlist (`^[A-Za-z_][A-Za-z0-9_]*$`, ≤ 64 chars) before being backtick-quoted. The original concatenated user input directly into SQL.
- Real session-based auth via `express-session` with a signed, httpOnly, sameSite cookie — replaces the global `logged` boolean that broke under concurrency.
- `helmet`, `cors` (origin-locked, credentialed), `express-rate-limit`, request IDs, structured pino logs with sensitive-field redaction.
- System databases (`mysql`, `information_schema`, …) are explicitly guarded against destructive ops.

### `apps/web`

```
src/
  api/          Typed fetch client + endpoint helpers
  components/   AppShell, RequireAuth, Modal
  hooks/        useSession (TanStack Query)
  pages/        LoginPage, DatabasesPage, TablesPage, TableDetailPage
  styles/       global.css (dark theme)
```

### `libs/shared`

Zod schemas (`createTableSchema`, `insertRowSchema`, …) and the `sqlIdentifier` validator that both sides import. Means the same rule that guards the SQL layer is also enforced by the form on the way in.

## Steps to run

### Prerequisites

- Node.js ≥ 20.10 and npm ≥ 10
- A MySQL 8 instance (either your local install, or use the Docker one below)
- macOS / Linux / WSL

### Option 1 — local dev (recommended)

Run api and web on the host, MySQL in Docker.

```bash
# 1. Clone and enter the repo
git clone <repo-url> dbinterface
cd dbinterface

# 2. Configure environment
cp .env.example .env
#    Edit .env and set at minimum:
#      SESSION_SECRET   — any 32+ char random string
#      MYSQL_PASSWORD   — your MySQL root password (leave empty if none)

# 3. Install dependencies
npm install

# 4. Start MySQL (skip if you already have one running on :3306)
docker compose -f docker-compose.dev.yml up -d

# 5. Start api + web in parallel (watch mode)
npm run dev
```

Then open **http://localhost:4200** in your browser and sign in with your MySQL root password.

| Service        | URL                                |
| -------------- | ---------------------------------- |
| Web UI         | http://localhost:4200              |
| API            | http://localhost:8082              |
| API docs       | http://localhost:8082/api/docs     |
| Health check   | http://localhost:8082/health       |

### Option 2 — full stack in Docker

Builds api and web images and runs everything (MySQL + api + nginx-served web) in containers.

```bash
cp .env.example .env
docker compose up --build
```

| Service  | URL                    |
| -------- | ---------------------- |
| Web UI   | http://localhost:8080  |
| API      | http://localhost:8082  |

### Run individual targets

```bash
npm run api        # only the api (port 8082)
npm run web        # only the web (port 4200)
npm test           # all vitest suites
npm run typecheck  # tsc --noEmit on every project
npm run lint       # eslint across the monorepo
npm run build      # build both apps to dist/
```

### Stopping

`Ctrl-C` in the terminal running `npm run dev`. If processes survive (e.g. detached), `lsof -ti :8082 :4200 | xargs kill`.

### Troubleshooting

- **"SESSION_SECRET must be at least 32 chars"** — the api fails fast on a missing or short secret. Fix `.env` and restart.
- **"Pool is closed" after login** — restart the api; you're likely on a stale build before the per-query `getPool()` fix.
- **`npm install` errors with EACCES on `node_modules`** — leftover root-owned `node_modules.old` from the original Docker build. Run `sudo rm -rf node_modules.old` to clear it.
- **MySQL port conflict on 3306** — either stop your local MySQL or change `MYSQL_PORT` in `.env`.

## Scripts

| Command              | What it does                           |
| -------------------- | -------------------------------------- |
| `npm run dev`        | Run api + web in watch mode            |
| `npm run api`        | Run only the api                       |
| `npm run web`        | Run only the web                       |
| `npm run build`      | Build both apps via Nx                 |
| `npm test`           | Run all vitest suites                  |
| `npm run lint`       | ESLint across the monorepo             |
| `npm run typecheck`  | tsc --noEmit on every project          |
| `npm run format`     | Prettier (write)                       |

## Architecture decisions

- **Nx + npm workspaces** instead of a single package — lets the React app import the same Zod schemas the API validates against, with no copy-paste drift.
- **Repository / Service / Route layering** — repositories are the only layer that builds SQL, services hold rules (system-DB guards, column existence), routes are thin Zod-validated handlers. Each layer is independently testable.
- **`quoteIdent` is the single point of trust for identifiers.** mysql2 placeholders cover values; nothing else goes near user input.
- **Session auth, not JWT.** This is a desktop-class admin tool with one user; sessions are simpler and rotate cleanly on logout.
- **Fail-fast env validation.** `loadEnv()` parses `process.env` through Zod at startup — a missing `SESSION_SECRET` crashes the API immediately with a readable message.

## Roadmap

- [ ] Per-user MySQL credentials (instead of a single root login)
- [ ] CSV / SQL import + export
- [ ] Cell-level type-aware editors (date pickers, JSON, blobs)
- [ ] Saved queries with parameterized inputs
- [ ] Audit log of mutating operations
