# AGENTS.md

## Cursor Cloud specific instructions

### Architecture

This is a **pnpm monorepo** (TypeScript 5.9, Node.js 22+, pnpm 10+) for FarmX AI — a bilingual (Arabic RTL / Swedish LTR) poultry farm management platform.

| Package | Role |
|---------|------|
| `artifacts/api-server` | Express 5 backend (REST API, auth, AI engines) |
| `artifacts/poultry-manager` | React 19 + Vite 7 frontend (Arabic) |
| `artifacts/poultry-manager-sv` | React 19 + Vite 7 frontend (Swedish, optional) |
| `lib/db` | Drizzle ORM schema + migrations (PostgreSQL 16) |
| `lib/api-spec` | OpenAPI spec + Orval codegen |
| `lib/api-client-react` | Generated React Query hooks |

### Running services

The app does **not** use dotenv. Environment variables must be exported in the shell before running any service.

Required env vars for development:
```
DATABASE_URL=postgresql://farmx:farmx123@localhost:5432/chicken_db
PORT=8080
SESSION_SECRET=dev-session-secret-key-for-local-development-only-32chars
ADMIN_PASSWORD=admin1234
WORKER_PASSWORD=worker1234
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

**Start PostgreSQL:**
```bash
sudo pg_ctlcluster 16 main start
```

**Start API server (port 8080):**
```bash
export DATABASE_URL=postgresql://farmx:farmx123@localhost:5432/chicken_db PORT=8080 SESSION_SECRET=dev-session-secret-key-for-local-development-only-32chars ADMIN_PASSWORD=admin1234 WORKER_PASSWORD=worker1234 NODE_ENV=development ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
pnpm --filter @workspace/api-server run dev
```

The `dev` script automatically runs `drizzle-kit push --force` (DB migration), then `build` (esbuild), then `start`.

**Start frontend (port 5173):**
```bash
PORT=5173 pnpm --filter @workspace/poultry-manager run dev
```

The frontend Vite config **requires** the `PORT` env var even in dev mode. It proxies `/api` to `http://localhost:8080`.

### Verify / lint / build

- `pnpm run verify` — runs codegen check + typecheck + build (the main health check)
- `pnpm run typecheck` — TypeScript check across all packages
- `pnpm run build` — typecheck + recursive build
- No test framework is configured (no vitest/jest/mocha).
- No ESLint configured; only Prettier is present for formatting.

### Seeded users (created on first start if DB is empty)

| Username | Role | Password (from ADMIN_PASSWORD / WORKER_PASSWORD env) |
|----------|------|------------------------------------------------------|
| yones | admin | value of ADMIN_PASSWORD |
| raoof | admin | value of ADMIN_PASSWORD |
| nassar | admin | value of ADMIN_PASSWORD |
| hoobi | worker | value of WORKER_PASSWORD |
| abood | worker | value of WORKER_PASSWORD |

### Gotchas

- The `pnpm-workspace.yaml` has `onlyBuiltDependencies` allowlist; `sharp` and `protobufjs` must be listed there or their postinstall won't run and the API server will fail.
- The workspace uses `minimumReleaseAge: 1440` for supply-chain safety — newly published packages won't install until 1 day old.
- Platform-specific binary overrides in `pnpm-workspace.yaml` exclude everything except linux-x64.
- The API server's esbuild bundle externalizes native packages (sharp, pg-native, etc.) — they must be available in `node_modules` at runtime.
