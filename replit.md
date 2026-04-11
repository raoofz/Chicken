# Workspace — مدير المزرعة (Poultry Farm Manager)

## Overview

Full-stack Arabic RTL poultry farm management system. pnpm workspace monorepo with:
- **Web App** (react-vite) at `/` — Arabic RTL dashboard for desktop/browser
- **Mobile App** (expo) at `/mobile/` — Arabic RTL native mobile app (iOS/Android via Expo Go)
- **API Server** (express) — shared backend for both web and mobile

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec at `lib/api-spec/openapi.yaml`)
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
- **User accounts** (all password: `1234`):
  - Admins: `yones` (يونس), `raoof` (رؤوف), `nassar` (ناصر)
  - Workers: `hoobi` (هوبي), `abood` (عبود)
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
| Daily Notes | ✅ | ❌ (hidden + API protected) |

## Features

### Web App (artifacts/poultry-manager)
- **Login page** — Arabic RTL, chicken logo, no default credentials shown
- **Dashboard** — clickable stat cards (navigate to /flocks, /hatching, /tasks, /goals)
- **Flocks** (الدجاجات) — CRUD for chicken groups, age in days (ageDays), AlertDialog for delete
- **Hatching** (دورات التفقيس) — 21-day cycle with 2-phase system:
  - Phase 1 (days 1-18): incubation temp/humidity + time eggs placed (HH:MM)
  - Phase 2 (days 18-21): lockdown temp/humidity + time eggs transferred (HH:MM)
- **Tasks** (مهام اليوم) — daily task management with categories & priorities
- **Goals** (الأهداف) — progress tracking with progress bars
- **Notes** (المذكرات) — daily journal, admin-only
- **AI Insights** (تحليل AI) — admin-only, uses OpenAI gpt-4o for farm analysis
- **Logs** (سجل النشاط) — activity log

### Mobile App (artifacts/poultry-mobile)
- Login screen with username/password fields in Arabic
- All tabs: الرئيسية, الدجاجات, الفقاسة, المهام, الأهداف
- Dashboard shows user name, role badge (مدير/عامل), logout button
- Hatching tab: shows 2-phase system (blue=incubation, orange=lockdown) with progress bar
- Role-based: workers see read-only (no FAB, no delete/edit buttons)
- Pull-to-refresh on all screens

## Design

- **Color palette**: primary `#B85C2A` (terracotta), background `#F7F0E6` (cream), sidebar `#1A1208` (dark brown)
- **RTL throughout**: all layouts use `dir="rtl"`, flexDirection row-reverse
- **Fonts**: Tajawal/Cairo (web), Inter (mobile)
- **Language**: Arabic UI with English field names in DB

## DB Schema

Tables:
- `flocks` — chicken groups (name, breed, count, ageDays, purpose, notes)
- `tasks` — daily tasks (title, category, priority, dueDate, completed)
- `hatching_cycles` — incubation cycles:
  - Phase 1: startDate, setTime (HH:MM), temperature, humidity (days 1-18)
  - Phase 2: lockdownDate, lockdownTime (HH:MM), lockdownTemperature, lockdownHumidity (days 18-21)
- `goals` — farm goals (title, targetValue, currentValue, unit, category)
- `users` — auth users (username, passwordHash, name, role)
- `daily_notes` — daily journal (date, content, authorId, category)
- `activity_logs` — activity history

## API Routes

- `GET /api/auth/me` — current user session
- `POST /api/auth/login` — login with username/password
- `POST /api/auth/logout` — logout
- `GET/POST /api/flocks`, `GET/PUT/DELETE /api/flocks/:id`
- `GET/POST /api/tasks`, `PUT/DELETE /api/tasks/:id`
- `GET/POST /api/hatching-cycles`, `GET/PUT/DELETE /api/hatching-cycles/:id`
- `GET/POST /api/goals`, `PUT/DELETE /api/goals/:id`
- `GET/POST /api/notes` — daily journal (admin-only, requireAdmin middleware)
- `POST /api/ai/analyze` — admin-only AI analysis (OpenAI)
- `GET /api/dashboard/summary` — stats for dashboard
- `GET /api/tasks/today` — tasks for today

## Important Notes

- `confirm()` is blocked in Replit iframe — always use `AlertDialog` from shadcn with `deleteId` state pattern
- Orval hook signature: `useListTasks(params?, options?)` — pass date as first arg: `useListTasks({ date: today }, { query: {...} })`
- Mobile auth stored in AsyncStorage with key `farm_auth_user`
- API base URL for mobile: `EXPO_PUBLIC_DOMAIN` env var via `setBaseUrl()`
- Web app proxies `/api/*` to port 8080 (API server) automatically
- Age for chickens is in days (ageDays), max ~40 days
- Hatching cycle is 21 days total: 18 incubation + 3 lockdown/hatching
