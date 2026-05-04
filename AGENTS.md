# AGENTS.md

## Cursor Cloud specific instructions

### Overview
FarmX AI is a pnpm workspace monorepo for an AI-powered poultry farm management platform (bilingual Arabic RTL / Swedish LTR). Key packages:
- **`@workspace/api-server`** — Express 5 backend (port from `$PORT` env var, default 8080)
- **`@workspace/poultry-manager`** — React 19 + Vite 7 frontend (Arabic RTL)
- **`@workspace/db`** — Drizzle ORM schema + PostgreSQL connection

### Prerequisites
- **Node.js 22+**, **pnpm 10.33.2** (via corepack), **PostgreSQL 16**
- PostgreSQL must be running with database `chicken_db` available before starting the API

### Service startup

**PostgreSQL** — start before anything else:
```bash
pg_ctlcluster 16 main start
```

**API server** (builds first, pushes DB schema, then starts):
```bash
PORT=8080 DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/chicken_db \
  SESSION_SECRET=dev-only-insecure-secret-for-local-development-min-32-chars \
  ADMIN_PASSWORD=admin123 WORKER_PASSWORD=worker123 NODE_ENV=development \
  pnpm --filter @workspace/api-server run dev
```

**Frontend dev server** (Vite requires `PORT` env var — this is the *Vite dev port*, not the API port):
```bash
PORT=5173 pnpm --filter @workspace/poultry-manager run dev
```
The Vite config auto-proxies `/api` requests to `http://localhost:8080`.

### Gotchas
- The Vite config in `poultry-manager` **throws** if `PORT` env var is unset in non-production mode. Always export `PORT=5173` (or desired port) before starting the frontend.
- `pnpm --filter @workspace/api-server run dev` executes `drizzle-kit push --force` (DB schema sync) then builds and starts. It needs `DATABASE_URL` set.
- Default dev credentials seeded at startup: admin = `yones`/`admin123`, worker = `hoobi`/`worker123`.
- `sharp` and `protobufjs` have ignored build scripts (controlled by `pnpm-workspace.yaml` `onlyBuiltDependencies`). Image-upload features may not work without them, but the rest of the app runs fine.

### Commands reference
See `package.json` scripts. Key commands:
- **Install**: `pnpm install --frozen-lockfile`
- **Typecheck**: `pnpm run typecheck`
- **Build all**: `pnpm run build`
- **Full verify**: `pnpm run verify` (check generated code + typecheck + build)
- **Run tests**: `pnpm test`
- **DB push**: `DATABASE_URL=... pnpm run db:push`
