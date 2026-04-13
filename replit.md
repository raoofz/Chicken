# Workspace — مدير المزرعة (Poultry Farm Manager)

## Overview

Full-stack poultry farm management system with two web frontends sharing one API backend. pnpm workspace monorepo with:
- **Arabic Web App** (react-vite) at `/` — Arabic RTL dashboard (`artifacts/poultry-manager`)
- **Swedish Web App** (react-vite) at `/poultry-manager-sv/` — Swedish LTR dashboard (`artifacts/poultry-manager-sv`)
- **Mobile App** (expo) at `/mobile/` — Arabic RTL native mobile app (iOS/Android via Expo Go)
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

- **Replit Auth** via OpenID Connect (OIDC) with PKCE
- **Auth library**: `openid-client` on server, `@workspace/replit-auth-web` on frontend
- **Sessions**: Stored in `sessions` postgres table (sid, sess JSON, expire)
- **Users**: Upserted to `auth_users` table on first login (id, email, firstName, lastName, profileImageUrl)
- **Auth middleware**: `authMiddleware.ts` resolves session from cookie (`sid`) or `Authorization: Bearer <sid>` header
- **Auth routes**: `GET /api/auth/user`, `GET /api/login`, `GET /api/callback`, `GET /api/logout`
- **Mobile auth**: `POST /api/mobile-auth/token-exchange`, `POST /api/mobile-auth/logout`
- **Frontend**: `AuthContext.tsx` wraps `@workspace/replit-auth-web`'s `useAuth()` hook; login redirects to Replit OIDC
- **All authenticated users have full access** (no admin/worker role distinction with Replit Auth)
- Old `users` table (serial int, username/password) remains in DB but is no longer used

## Features

### Web App (artifacts/poultry-manager)
- **Login page** — Single "Login" button that redirects to Replit OIDC
- **Dashboard** — clickable stat cards (navigate to /flocks, /hatching, /tasks, /goals)
- **Flocks** (الدجاجات) — CRUD for chicken groups, age in days (ageDays), AlertDialog for delete
- **Hatching** (دورات التفقيس) — 21-day cycle with 2-phase system:
  - Phase 1 (days 1-18): incubation temp/humidity + time eggs placed (HH:MM)
  - Phase 2 (days 18-21): lockdown temp/humidity + time eggs transferred (HH:MM)
- **Tasks** (مهام اليوم) — daily task management with categories & priorities
- **Goals** (الأهداف) — progress tracking with progress bars
- **Notes** (المذكرات) — daily journal (auth-protected)
- **Sidebar** — WhatsApp group button (green, `WHATSAPP_GROUP_URL` constant in Layout.tsx)
- **Logs** (سجل النشاط) — activity log
- **Settings** — account info + logout
- **Language switcher** — AR/SV toggle in sidebar and mobile header

### Mobile App (artifacts/poultry-mobile)
- Login screen with username/password fields in Arabic
- All tabs: الرئيسية, الدجاجات, الفقاسة, المهام, الأهداف
- Dashboard shows user name, role badge (مدير/عامل), logout button + WhatsApp group button
- Hatching tab: shows 2-phase system (blue=incubation, orange=lockdown) with progress bar
- Pull-to-refresh on all screens
- WhatsApp button (`WHATSAPP_GROUP_URL` constant in `app/(tabs)/index.tsx`)

### Swedish Web App (artifacts/poultry-manager-sv)
- **Login page** — Swedish LTR, same chicken logo, "Gårdsförvaltare" title
- **Dashboard** — Swedish labels, same clickable stat cards
- **All pages translated**: Flockar, Kläckning, Uppgifter, Mål, Anteckningar, Aktivitetslogg, Inställningar
- **Auth errors** show Swedish messages (not Arabic backend errors)
- **Layout**: Sidebar on LEFT (LTR), Inter font, same warm earthy palette

## Design

- **Color palette**: primary `#B85C2A` (terracotta), background `#F7F0E6` (cream), sidebar `#1A1208` (dark brown)
- **Arabic app**: RTL, `dir="rtl"`, fonts Tajawal/Cairo
- **Swedish app**: LTR, `dir="ltr"`, font Inter
- **Shared**: Same color palette, same component library (shadcn/ui), same API backend

## DB Schema

Tables:
- `flocks` — chicken groups (name, breed, count, ageDays, purpose, notes)
- `tasks` — daily tasks (title, category, priority, dueDate, completed)
- `hatching_cycles` — incubation cycles:
  - Phase 1: startDate, setTime (HH:MM), temperature, humidity (days 1-18)
  - Phase 2: lockdownDate, lockdownTime (HH:MM), lockdownTemperature, lockdownHumidity (days 18-21)
- `goals` — farm goals (title, targetValue, currentValue, unit, category)
- `users` — legacy auth users (serial id, username, passwordHash, name, role) — NOT USED
- `auth_users` — Replit Auth users (varchar id, email, firstName, lastName, profileImageUrl)
- `sessions` — OIDC sessions (sid, sess JSON, expire)
- `daily_notes` — daily journal (date, content, authorName, category)
- `activity_logs` — activity history

## API Routes

- `GET /api/auth/user` — current authenticated user (or null)
- `GET /api/login` — begin OIDC login flow
- `GET /api/callback` — OIDC callback
- `GET /api/logout` — clear session + OIDC logout
- `POST /api/mobile-auth/token-exchange` — mobile auth code exchange
- `POST /api/mobile-auth/logout` — mobile session logout
- `GET/POST /api/flocks`, `GET/PUT/DELETE /api/flocks/:id`
- `GET/POST /api/tasks`, `PUT/DELETE /api/tasks/:id`
- `GET/POST /api/hatching-cycles`, `GET/PUT/DELETE /api/hatching-cycles/:id`
- `GET/POST /api/goals`, `PUT/DELETE /api/goals/:id`
- `GET/POST /api/notes` — daily journal (requireAuth middleware)
- `DELETE /api/notes/:id` — delete note (requireAuth)
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
