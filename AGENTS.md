# AGENTS.md

## Cursor Cloud specific instructions

### Overview

FarmX AI is a pnpm monorepo (pnpm 10+, Node.js 22+) with:
- **API server** (`artifacts/api-server`) — Express 5 / TypeScript backend on port 8080
- **Frontend** (`artifacts/poultry-manager`) — React 19 / Vite 7 app (Arabic RTL)
- **Database** — PostgreSQL 16 (managed via Drizzle ORM in `lib/db`)

### Starting services

1. **PostgreSQL**: `sudo pg_ctlcluster 16 main start` (already running after VM setup)
2. **API server**: requires `.env` at workspace root (see `.env.example`), then:
   ```bash
   source .env && export PORT DATABASE_URL SESSION_SECRET ADMIN_PASSWORD WORKER_PASSWORD ALLOWED_ORIGINS NODE_ENV
   pnpm --filter @workspace/api-server run dev
   ```
   The `dev` script runs `drizzle-kit push --force`, builds with esbuild, then starts the server.
3. **Frontend**: `PORT=5173 pnpm --filter @workspace/poultry-manager run dev`
   - The frontend vite config **requires** a `PORT` env var in non-production mode.
   - It proxies `/api` requests to `http://localhost:8080`.

### Key gotchas

- The `.env` file must exist at workspace root with at least `DATABASE_URL`, `PORT`, `SESSION_SECRET`. See `.env.example`.
- User seeding happens on API server startup. If old password hashes exist from a prior state, delete rows from the `users` table and restart the server to re-seed with current `ADMIN_PASSWORD`/`WORKER_PASSWORD` values.
- Default dev credentials: username `yones` (admin), password from `ADMIN_PASSWORD` in `.env` (default: `admin123`).
- `pnpm install` may warn about ignored build scripts for `protobufjs` and `sharp`. These are listed in `pnpm-workspace.yaml` `onlyBuiltDependencies` or can be ignored for dev — the app runs without them (sharp is only needed for image processing features).
- The `pnpm run verify` command runs codegen checks + typecheck + build — use it as a pre-commit sanity check.

### Standard commands (see `package.json` scripts)

| Task | Command |
|------|---------|
| Install deps | `pnpm install --frozen-lockfile` |
| Typecheck | `pnpm run typecheck` |
| Full verify | `pnpm run verify` |
| Build all | `pnpm run build` |
| DB schema push | `pnpm run db:push` |
| Codegen (OpenAPI) | `pnpm run codegen` |
