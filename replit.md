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

## Authentication

- **Session-based** via express-session + bcrypt
- **Default admin**: `admin` / `admin123`  
- **Default worker**: `worker` / `worker123`
- Session stored in DB, session secret in `SESSION_SECRET` env var
- Auth routes: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- Web app: `AuthContext.tsx` wraps all pages; login redirects to dashboard
- Mobile app: `AuthContext.tsx` with AsyncStorage persistence; `AuthGuard` in `_layout.tsx`

## Role-Based Access

| Feature | Admin (مدير) | Worker (عامل) |
|---|---|---|
| View all data | ✅ | ✅ |
| Add/Edit/Delete records | ✅ | ❌ (read-only) |
| AI Analysis page | ✅ | ❌ (hidden) |
| Daily Notes | ✅ | ✅ |

## Features

### Web App (artifacts/poultry-manager)
- **Login page** — Arabic RTL, chicken logo, shows default credentials
- **Dashboard** — stats cards (chickens, flocks, hatching rate), today's tasks
- **Flocks** (الدجاجات) — CRUD for chicken groups, AlertDialog for delete confirmation
- **Hatching** (دورات التفقيس) — manage incubation cycles with progress tracking
- **Tasks** (مهام اليوم) — daily task management with categories & priorities
- **Goals** (الأهداف) — progress tracking with progress bars
- **Notes** (المذكرات) — daily journal with date navigation
- **AI Insights** (تحليل AI) — admin-only, uses OpenAI gpt-4o for farm analysis
- **Role-based UI** — admin sees full CRUD; worker sees read-only views

### Mobile App (artifacts/poultry-mobile)
- Login screen with username/password fields in Arabic
- All tabs: الرئيسية, الدجاجات, الفقاسة, المهام, الأهداف
- Dashboard shows user name, role badge (مدير/عامل), logout button
- Role-based: workers see read-only (no FAB, no delete/edit buttons)
- Pull-to-refresh on all screens

## Design

- **Color palette**: primary `#B85C2A` (terracotta), background `#F7F0E6` (cream), sidebar `#1A1208` (dark brown)
- **RTL throughout**: all layouts use `dir="rtl"`, flexDirection row-reverse
- **Fonts**: Tajawal/Cairo (web), Inter (mobile)
- **Language**: Arabic UI with English field names in DB

## DB Schema (packages/db/src/schema.ts)

Tables:
- `flocks` — chicken groups (name, breed, count, ageWeeks, purpose, notes)
- `tasks` — daily tasks (title, category, priority, dueDate, completed)
- `hatchingCycles` — incubation cycles (batchName, eggsSet, eggsHatched, startDate, status)
- `goals` — farm goals (title, targetValue, currentValue, unit, category)
- `users` — auth users (username, passwordHash, name, role)
- `dailyNotes` — daily journal (date, content, authorId)

## API Routes

- `GET /api/auth/me` — current user session
- `POST /api/auth/login` — login with username/password
- `POST /api/auth/logout` — logout
- `GET/POST /api/flocks`, `GET/PATCH/DELETE /api/flocks/:id`
- `GET/POST /api/tasks`, `GET/PATCH/DELETE /api/tasks/:id`
- `GET/POST /api/hatching-cycles`, `GET/PATCH/DELETE /api/hatching-cycles/:id`
- `GET/POST /api/goals`, `GET/PATCH/DELETE /api/goals/:id`
- `GET/POST /api/daily-notes` — journal by date
- `POST /api/ai/analyze` — admin-only AI analysis (OpenAI)
- `GET /api/dashboard/summary` — stats for dashboard
- `GET /api/dashboard/today-tasks` — tasks for today

## Important Notes

- `confirm()` is blocked in Replit iframe — always use `AlertDialog` from shadcn with `deleteId` state pattern
- Orval hook signature: `useListTasks(params?, options?)` — pass date as first arg: `useListTasks({ date: today }, { query: {...} })`
- Mobile auth stored in AsyncStorage with key `farm_auth_user`
- API base URL for mobile: `EXPO_PUBLIC_DOMAIN` env var via `setBaseUrl()`
- Web app proxies `/api/*` to port 8080 (API server) automatically
