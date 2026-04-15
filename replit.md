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
- **Validation**: manual inline validation (zod not installed in api-server), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec at `lib/api-spec/openapi.yaml`)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Computer Vision AI System (Industry-Level)

Built at `artifacts/api-server/src/lib/visionEngine.ts`:

### 3-Layer Architecture
1. **Vision Layer** — Sharp pixel-level analysis (4×3 grid = 12 spatial zones)
   - Chicken density estimation per zone (warm pixel clustering)
   - Activity level (entropy + contrast)
   - Floor cleanliness (dark spot analysis)
   - Lighting score and uniformity
   - Injury risk detection (red spike ratio)

2. **Intelligence Layer** — Rules-based correlation engine
   - Crowding detection (Gini coefficient of density distribution)
   - Root cause analysis for each anomaly
   - Risk scoring (weighted combination: crowding 25%, health 25%, injury 20%, floor 15%, lighting 15%)
   - Operational insights (not just descriptions): crowding → ventilation issue, low activity → disease/heat

3. **Decision Layer** — Prioritized actions + predictions
   - Urgent/high/medium/low priority recommendations with timeframes
   - Predictive alerts ("within 24-48h, if no action...")
   - Temporal comparison vs. historical baseline (7 days)

### Key Metrics (stored per image as `visual_metrics` JSONB)
- `densityScore`, `crowdingScore`, `activityLevel`, `healthScore`
- `injuryRisk`, `floorCleanliness`, `lightingScore`, `lightingUniformity`
- `riskScore` (0-100 overall), `estimatedBirdCount`
- `gridData` (4×3 grid with density/activity/cleanliness/lighting per zone)

### API Endpoints
- `POST /api/notes/images/save` — upload + trigger CV analysis
- `POST /api/notes/images/:id/analyze` — re-run analysis
- `GET /api/notes/images/report?period=weekly|daily&date=YYYY-MM-DD` — aggregate report

### Test Data (seeded)
- 1200 Ross 308 broilers (قطيع ماكينة الرئيسي أ)
- 600 Cobb 500 broilers (قطيع ماكينة الرئيسي ب)
- 600 chicks (قطيع الصيصان الجديد)
- 5 completed hatching cycles with full production data

## AI Integrations
- **OpenAI GPT-4o-mini Vision**: via Replit AI Integrations proxy (env: `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`)
- Used for farm photo analysis in `/api/notes/images/:id/analyze`
- Analyzes images for bird health, incubator conditions, alerts, and recommendations in Arabic

## Object Storage
- **Google Cloud Storage** via Replit sidecar proxy at `http://127.0.0.1:1106`
- Bucket: `replit-objstore-0ec7f8df-f3b4-4257-850a-d104cf6d3b87`
- Env: `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS`
- Farm photos stored under `/objects/uploads/`
- Served via: `GET /api/notes/images/file/:objectPath`

## Farm Photo Monitoring (new)
- `note_images` table: stores image metadata, AI analysis, tags, alerts, confidence
- `/api/notes/images` — CRUD endpoints
- `/api/notes/images/upload-url` — presigned GCS upload URL
- `/api/notes/images/save` — save record + trigger async AI vision analysis
- `/ai` route (frontend) → now shows **Photo Monitoring Hub** (مراقبة بالصور)
- `/notes` route → shows **Daily Notes** (ملاحظات يومية) with photo upload tab

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
- **Daily Plan** (الخطة اليومية الذكية) — admin-only, AI-generated daily schedule:
  - Reads farm data (flocks, cycles, tasks, notes) and builds a time-ordered plan from 05:30-20:00
  - Dynamic slots based on active hatching cycles, overdue/today tasks, vaccination needs
  - Risk level indicator (critical/high/medium/low) from future risk analysis
  - Daily tip from veterinary knowledge base
  - Interactive checklist — mark tasks done as you progress through the day
  - Progress bar showing completion percentage
  - API: `POST /api/ai/daily-plan`
  - Page: `artifacts/poultry-manager/src/pages/daily-plan.tsx`

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
