# 🐔 FarmX AI — نظام إدارة مزارع الدواجن الذكي

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-20+-green?logo=node.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)
![pnpm](https://img.shields.io/badge/pnpm-workspace-orange?logo=pnpm)

**Enterprise-grade AI-powered poultry farm management platform**  
Bilingual Arabic/Swedish · Real-time intelligence · Production-hardened

</div>

---

## 📋 Overview

FarmX AI is a full-stack monorepo application for managing poultry farms with integrated artificial intelligence, real-time analytics, and smart decision support. It supports both Arabic (RTL) and Swedish (LTR) interfaces.

### Key Capabilities

| Domain | Features |
|--------|----------|
| 🧠 **AI Brain Orchestrator** | Unified multi-engine analysis with real-time SSE streaming |
| 🌾 **Feed Intelligence** | Per-flock FCR vs breed benchmark, cost-per-egg, efficiency scoring |
| 🥚 **Egg Production** | Production tracking, hatching cycle management, live incubation tracker |
| 💰 **Financial Intelligence** | Transaction tracking, domain-based categorization (SSOT), anomaly detection |
| 📋 **Operations Center** | Task management, activity logs, daily notes with AI smart-extraction |
| 🔬 **Farm Lab** | Vision engine (camera analysis), precision metrics, causal inference |
| 📊 **Analytics** | 7-rule anomaly detection, linear regression forecasting, dashboard KPIs |
| 🔐 **Security** | RBAC, session auth, bcrypt passwords, rate limiting, Helmet CSP |

---

## 🏗 Architecture

```
workspace/
├── artifacts/
│   ├── api-server/          # Node.js / Express 5 / TypeScript backend
│   │   ├── src/
│   │   │   ├── app.ts       # Express app, CORS, session, Helmet
│   │   │   ├── index.ts     # Server entry, port management
│   │   │   ├── routes/      # REST API routes + RBAC guards
│   │   │   ├── lib/         # AI engines, business logic
│   │   │   └── middlewares/ # Auth middleware
│   │   └── dist/            # Compiled output (generated)
│   └── poultry-manager/     # React 19 + Vite frontend
│       └── src/
│           ├── pages/       # Route-level page components
│           ├── components/  # Shared UI components
│           └── contexts/    # Auth, Language, Theme contexts
├── lib/
│   ├── db/                  # Drizzle ORM schema + migrations
│   ├── api-spec/            # OpenAPI spec (openapi.yaml)
│   └── api-client-react/    # Generated React Query hooks (Orval)
└── pnpm-workspace.yaml
```

---

## 🔐 Security Model

- **Authentication**: Session-based (express-session + PostgreSQL store)
- **Passwords**: bcrypt with 12 salt rounds; minimum 8 characters enforced
- **Roles**: `admin` (full access) · `worker` (limited write access)
- **API Guards**: `requireAuth` on all API routes; `requireRole("admin")` on sensitive operations
- **Rate Limiting**: Login limited to 10 attempts / 15 min; API limited to 100 req / min
- **Headers**: Helmet with Content Security Policy enabled in production
- **Sessions**: `httpOnly`, `secure` (in production), `sameSite: lax`

---

## ⚙️ Environment Variables

Create a `.env` file (never commit it — it's in `.gitignore`):

```env
# Required
PORT=8080
DATABASE_URL=postgresql://user:password@host:5432/dbname
SESSION_SECRET=your-strong-random-secret-min-32-chars

# Optional — used for initial user seeding
ADMIN_PASSWORD=your-admin-password-min-8-chars
WORKER_PASSWORD=your-worker-password-min-8-chars

# Optional — production CORS (comma-separated list of allowed origins)
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

> **⚠️ In production**: `SESSION_SECRET` is required — the app will exit with an error if missing.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 14+

### Install

```bash
pnpm install
```

### Database Setup

```bash
pnpm --filter @workspace/db run db:push
```

### Development

```bash
# Start API server (port from $PORT env var)
pnpm --filter @workspace/api-server run dev

# Start frontend
pnpm --filter @workspace/poultry-manager run dev
```

### Production Build

```bash
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start
```

---

## 🚂 Deployment (Railway / Render / Fly.io)

**Build Command:**
```bash
pnpm install && pnpm --filter @workspace/api-server run build
```

**Start Command:**
```bash
pnpm --filter @workspace/api-server run start
```

**Required Environment Variables** (set in your deployment platform):
- `PORT`
- `DATABASE_URL`
- `SESSION_SECRET`
- `NODE_ENV=production`
- `ALLOWED_ORIGINS=https://yourdomain.com`

---

## 🧩 AI Engines

| Engine | File | Purpose |
|--------|------|---------|
| Brain Orchestrator | `brain-orchestrator.ts` | Unified analysis coordinator |
| Feed Cost Engine | `feed-cost-engine.ts` | Per-flock FCR + cost intelligence |
| Intelligence Engine | `intelligence-engine.ts` | Context-aware farm report |
| Advanced AI Engine | `advanced-ai-engine.ts` | Multi-dimensional scoring |
| Precision Engine | `precision-engine.ts` | Statistical anomaly detection |
| Vision Engine | `visionEngine.ts` | Camera image pixel analysis |
| Note Smart Parser | `noteSmartParser.ts` | Free-text → structured data |
| Context Engine | `context-engine.ts` | Daily DaySnapshot aggregation |

---

## 👥 User Roles

| Role | Access |
|------|--------|
| `admin` | Full access to all features, AI engines, system diagnostics, user management |
| `worker` | Daily operations: flocks, tasks, activity logs, notes, hatching, feed viewing |

---

## 📁 API Reference

All routes are prefixed with `/api/`. Authentication required unless noted.

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/login` | Public | Authenticate user |
| POST | `/api/auth/logout` | Auth | End session |
| GET | `/api/auth/me` | Auth | Current user info |
| GET | `/api/flocks` | Auth | List all flocks |
| GET | `/api/transactions` | Auth | Financial transactions |
| GET | `/api/tasks` | Auth | Task list |
| GET | `/api/notes` | Auth | Daily notes |
| GET | `/api/brain/analyze` | Auth | Brain orchestrator analysis |
| GET | `/api/feed-intelligence/summary` | Auth | Feed cost summary |
| POST | `/api/ai/smart-analyze` | Auth | Parse free-text note → data |
| GET | `/api/validate/integrity` | Admin | Data integrity audit |
| POST | `/api/ai/analyze-farm` | Admin | Advanced AI farm analysis |
| GET | `/api/diagnostics` | Admin | System diagnostics |

---

## 📄 License

Private — All rights reserved.
