# Workspace — مدير المزرعة (Poultry Farm Manager)

## Overview

Full-stack Arabic RTL poultry farm management system. pnpm workspace monorepo with:
- **Web App** (react-vite) at `/` — Arabic RTL dashboard for desktop/browser
- **Mobile App** (expo) at `/mobile/` — Arabic RTL native mobile app (iOS/Android via Expo Go)
- **API Server** (express) — shared backend for both web and mobile
- User's farm: 127 chickens in 2 groups (10 at 40 weeks, 117 at 22 weeks), 400 eggs in hatching cycle day 21

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
