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
  db/
    registry.ts          Per-session connection registry (one mysql2 pool per
                         signed-in user, idle-swept after 30 min)
    private-host.ts      IP-range guard for SSRF defense
  middleware/            request-id, auth, validate, error-handler, async-handler
  repositories/          Only layer that builds SQL (database/table/row).
                         Pool is constructor-injected — no module globals.
  services/
    factory.ts           Request-scoped service container — resolves the pool
                         from the session and wires repos into services
    *.service.ts         Business logic, system-DB guards, column existence checks
  routes/                Thin handlers; each call goes through services(req)
  app.ts                 Express composition (helmet, cors, session, rate-limit)
  main.ts                Entry point — starts the registry's idle sweep,
                         graceful shutdown on SIGINT/SIGTERM
```

**Security upgrades over the original:**

- All values pass through `mysql2` placeholders. All identifiers (db / table / column names) pass through a strict allowlist (`^[A-Za-z_][A-Za-z0-9_]*$`, ≤ 64 chars) before being backtick-quoted. The original concatenated user input directly into SQL.
- Real session-based auth via `express-session` with a signed, httpOnly cookie — replaces the global `logged` boolean that broke under concurrency.
- **Per-session MySQL pools.** Each user opens their own pool keyed by session id; credentials live in the pool object on the server, never in the session cookie.
- **Connect to any MySQL.** Login takes `host`, `port`, `user`, `password`, optional `database`, and a TLS toggle — works against local installs, AWS RDS, PlanetScale, TiDB Cloud, Aiven, etc. TLS connects with `rejectUnauthorized: true`.
- **SSRF guard.** Set `BLOCK_PRIVATE_HOSTS=true` for internet-facing deployments; the registry resolves the host through DNS and rejects `127/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16`, `::1`, `fe80::/10`, `fc00::/7`.
- **Connection caps.** Max 50 concurrent pools; 5 connections per user; 10s connect timeout; 30 min idle sweep.
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
#    For internet-facing deployments also set:
#      BLOCK_PRIVATE_HOSTS=true
#      CROSS_SITE_COOKIES=true   (if web and api are on different origins)

# 3. Install dependencies
npm install

# 4. Start MySQL (skip if you already have one running on :3306)
docker compose -f docker-compose.dev.yml up -d

# 5. Start api + web in parallel (watch mode)
npm run dev
```

Then open **http://localhost:4200**. The login form takes:

- **Host** — `127.0.0.1` for local, or any reachable hostname (PlanetScale, RDS, TiDB Cloud, …)
- **Port** — defaults to `3306` (TiDB Cloud uses `4000`)
- **User** / **Password**
- **Database** (optional) — connect scoped to a specific schema
- **Use TLS** — required by most hosted MySQL providers

Click a preset chip (Local MySQL, PlanetScale, TiDB Cloud, AWS RDS) to auto-fill the host/port/TLS combo.

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
- **"connection failed: Access denied"** — wrong user/password for that host. The API forwards MySQL's exact error.
- **"host resolves to a blocked range"** — `BLOCK_PRIVATE_HOSTS=true` is rejecting a private/loopback IP. Set it to `false` for local dev.
- **"connection expired — please sign in again"** — the api restarted; the in-memory pool is gone but your cookie isn't. Just sign in again.
- **"connection failed: self signed certificate"** — uncheck "Use TLS" or use a provider that issues a CA-signed cert.
- **`npm install` errors with EACCES on `node_modules`** — leftover root-owned `node_modules.old` from the original Docker build. Run `sudo rm -rf node_modules.old` to clear it.

### Public-deployment safety checklist

Don't deploy this open to the internet. If you must (e.g. interview demo), at minimum:

- `BLOCK_PRIVATE_HOSTS=true` to block SSRF to internal addresses
- `CROSS_SITE_COOKIES=true` if web and api live on different origins (HTTPS only)
- `RATE_LIMIT_MAX` cranked low and `RATE_LIMIT_WINDOW_MS` raised to limit brute-force
- A scoped MySQL user (not `root`) on the demo database, granted only what's needed
- Consider an IP allowlist in front of the api (Cloudflare Access, etc.)

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
