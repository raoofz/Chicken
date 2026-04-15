# Workspace — مدير المزرعة (Poultry Farm Manager)

## Overview

Full-stack poultry farm management system with two web frontends sharing one API backend. pnpm workspace monorepo with:
- **Arabic Web App** (react-vite) at `/` — Arabic RTL dashboard (`artifacts/poultry-manager`)
- **Swedish Web App** (react-vite) at `/poultry-manager-sv/` — Swedish LTR dashboard (`artifacts/poultry-manager-sv`)
- **API Server** (express) — shared backend for all apps

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

- **Session-based** auth with username/password (bcrypt hashing)
- **Sessions**: Stored in PostgreSQL via `connect-pg-simple` (table auto-created)
- **Users table**: `users` (serial id, username, passwordHash, name, role)
- **Roles**: `admin` (full access) and `worker` (limited access)
- **Default users** (password: 1234): yones/يونس (admin), raoof/رؤوف (admin), nassar/نصار (admin), hoobi/هوبي (worker), abood/عبود (worker)
- **Auth routes**: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password`
- **Frontend**: `AuthContext.tsx` with login/logout/useAuth hook; protected routes in App.tsx

## Security

- **Helmet**: Security headers (HSTS, X-Content-Type-Options, X-Frame-Options, etc.)
- **Rate Limiting**: 100 requests/minute general, 10 login attempts per 15 minutes
- **CORS**: All origins allowed with credentials
- **Session cookies**: httpOnly, sameSite=lax, secure in production
- **Input validation**: Zod schemas on all API routes, type/length checks on auth inputs
- **Audit logging**: Failed login attempts, password changes, and logouts logged via Pino
- **Parameterized queries**: Drizzle ORM prevents SQL injection
- **Database indexes**: On created_at, due_date, status, completed, date, author_id, username

## Features

### Web App (artifacts/poultry-manager)
- **Login page** — Username/password with Arabic RTL design
- **Dashboard** — clickable stat cards (navigate to /flocks, /hatching, /tasks, /goals)
- **Flocks** (الدجاجات) — CRUD for chicken groups, age in days (ageDays), AlertDialog for delete
- **Hatching** (دورات التفقيس) — 21-day cycle with 2-phase system:
  - Phase 1 (days 1-18): incubation temp/humidity + time eggs placed (HH:MM)
  - Phase 2 (days 18-21): lockdown temp/humidity + time eggs transferred (HH:MM)
- **Tasks** (مهام اليوم) — daily task management with categories & priorities
- **Goals** (الأهداف) — progress tracking with progress bars
- **Notes** (المذكرات) — daily journal (admin-only)
- **Sidebar** — Role badge (admin/worker), WhatsApp group button
- **Logs** (سجل النشاط) — activity log
- **Settings** — account info, role display, change password, logout
- **Language switcher** — AR/SV toggle in sidebar and mobile header
- **AI Analysis** (محرك التحليل الذكي) — admin-only, professional expert analysis engine:
  - Reads raw DB objects directly (not text parsing)
  - Multi-dimensional scoring: Environment (35%), Biological (35%), Operations (20%), Data Quality (10%)
  - Anomaly detection with statistical analysis (z-scores, standard deviation)
  - Scientific thresholds from poultry encyclopedia (temperature, humidity, hatch rates)
  - Trend analysis comparing historical vs current cycles
  - Predictive analytics with confidence levels and timeframes
  - Actionable recommendations with reason, impact, and confidence percentage
  - Disease keyword detection in notes
  - Data quality assessment
  - Chat mode: context-aware expert replies based on actual farm data
  - Engine file: `artifacts/api-server/src/lib/ai-engine.ts`

### Swedish Web App (artifacts/poultry-manager-sv)
- **Login page** — Swedish LTR, same chicken logo, "Gårdsförvaltare" title
- **Dashboard** — Swedish labels, same clickable stat cards
- **All pages translated**: Flockar, Kläckning, Uppgifter, Mål, AI-analys, Anteckningar, Aktivitetslogg, Inställningar
- **Auth errors** show Swedish messages
- **Layout**: Sidebar on LEFT (LTR), Inter font, same warm earthy palette
- **Role-based navigation**: Admin-only items labeled with badge

## Design

- **Color palette**: primary `#B85C2A` (terracotta), background `#F7F0E6` (cream), sidebar `#1A1208` (dark brown)
- **Arabic app**: RTL, `dir="rtl"`, fonts Tajawal/Cairo
- **Swedish app**: LTR, `dir="ltr"`, font Inter
- **Shared**: Same color palette, same component library (shadcn/ui), same API backend

## DB Schema

Tables:
- `flocks` — chicken groups (name, breed, count, ageDays, purpose, notes)
- `tasks` — daily tasks (title, category, priority, dueDate, completed)
- `hatching_cycles` — incubation cycles with 2-phase system
- `goals` — farm goals (title, targetValue, currentValue, unit, category)
- `users` — auth users (serial id, username, passwordHash, name, role)
- `daily_notes` — daily journal (date, content, authorName, category)
- `activity_logs` — activity history

Indexes on: created_at, due_date, status, completed, date, author_id, username

## API Routes

- `POST /api/auth/login` — login with username/password
- `POST /api/auth/logout` — destroy session
- `GET /api/auth/me` — current user info
- `POST /api/auth/change-password` — change password
- `GET/POST /api/flocks`, `GET/PUT/DELETE /api/flocks/:id`
- `GET/POST /api/tasks`, `PUT/DELETE /api/tasks/:id`
- `GET/POST /api/hatching-cycles`, `GET/PUT/DELETE /api/hatching-cycles/:id`
- `GET/POST /api/goals`, `PUT/DELETE /api/goals/:id`
- `GET/POST /api/notes`, `DELETE /api/notes/:id` — admin only
- `POST /api/ai/analyze` — AI farm analysis (admin-only, uses OpenAI)
- `GET /api/dashboard/summary` — stats for dashboard
- `GET /api/tasks/today` — tasks for today

All data routes require authentication (session-based `requireAuth` middleware).

## Important Notes

- `confirm()` is blocked in Replit iframe — always use `AlertDialog` from shadcn with `deleteId` state pattern
- Orval hook signature: `useListTasks(params?, options?)` — pass date as first arg
- Web app proxies `/api/*` to port 8080 (API server) automatically
- Age for chickens is in days (ageDays), max ~40 days
- Hatching cycle is 21 days total: 18 incubation + 3 lockdown/hatching
