# Workspace — مدير المزرعة (Poultry Farm Manager)

## Overview

This project is a full-stack poultry farm management system designed to optimize farm operations and boost profitability. It features two distinct web frontends (Arabic and Swedish) that share a single API backend, all managed within a pnpm workspace monorepo. The system aims to provide comprehensive financial and production intelligence, leveraging advanced analytics, AI-powered insights, and computer vision for enhanced decision-making. Key capabilities include real-time financial tracking, anomaly detection, predictive forecasting, intelligent task management, and detailed performance analysis.

## User Preferences

I prefer iterative development, where we focus on one feature or module at a time. Please ask for my approval before making any major architectural changes or implementing new features. I value clear, concise explanations and prefer to be involved in key design decisions.

## System Architecture

The system is structured as a pnpm monorepo, facilitating shared code and consistent development across multiple applications.

**UI/UX Decisions:**
- **Arabic Web App (`artifacts/poultry-manager`):** RTL layout, uses Tajawal/Cairo fonts, and a warm earthy color palette (primary: `#B85C2A`, background: `#F7F0E6`, sidebar: `#1A1208`).
- **Swedish Web App (`artifacts/poultry-manager-sv`):** LTR layout, uses Inter font, and the same warm earthy color palette.
- Both frontends utilize `shadcn/ui` for consistent componentry and responsiveness.
- **Login Pages:** Feature localized designs (Arabic RTL, Swedish LTR) with a shared chicken logo.
- **Role-based Navigation:** Admin-only features are clearly marked and accessible based on user roles.

**Technical Implementations:**
- **Frontend Framework:** React with Vite.
- **Backend Framework:** Express 5.
- **Monorepo Tool:** pnpm workspaces.
- **Type-checking:** TypeScript 5.9.
- **Build Tool:** esbuild (CJS bundle).
- **API Codegen:** Orval, generating API hooks and Zod schemas from an OpenAPI specification (`lib/api-spec/openapi.yaml`).
- **Authentication:** Session-based with username/password (bcrypt hashing), user roles (`admin`, `worker`), and PostgreSQL storage for sessions.
- **Security:** Helmet for security headers, rate limiting (100 req/min general, 10 login attempts/15 min), CORS for all origins, httpOnly/sameSite/secure session cookies, Zod for input validation, parameterized queries via Drizzle ORM, and audit logging.
- **Multi-language Support:** Full localization for Arabic and Swedish across both frontends and intelligent reports.

**Feature Specifications & System Design Choices:**

- **Finance & Production Intelligence:**
    - Live data polling for real-time updates.
    - **Anomaly Detection:** A 7-rule deterministic engine to detect critical issues like loss, margin alerts, and trend declines.
    - **Cost Intelligence:** Calculates key metrics such as cost per bird/day, profit per bird, and ROI%.
    - **Predictive Engine:** Uses linear regression for monthly income/expense/profit forecasts.
    - **UI Components:** `LiveBadge`, `AnomalyStrip`, `MetricTile` for compact displays, `Sparkline` for mini-charts, and `ComposedChart` for combined data visualization.
    - **Reporting:** Comprehensive P&L statements, smart alerts, and detailed breakdowns.

- **Intelligence System (Context-Aware 7-Point Analysis):**
    - **Context Engine (`context-engine.ts`):** Aggregates daily farm data (transactions, notes, tasks, flocks) to build `DaySnapshot` objects and compute 7-day averages and temporal changes. It performs deterministic change detection for significant deviations.
    - **Intelligence Engine (`intelligence-engine.ts`):** Generates a 7-point analysis report based on farm context, covering current state, historical comparison, quantified changes, root cause hypotheses, risk evaluation, immediate actions, and consequences of inaction. Outputs are localized to Arabic/Swedish.
    - **Frontend Hub (`precision-analysis.tsx`):** Provides an interactive interface for the intelligence report, including risk gauges, active alerts, and ranked action cards, with a feedback loop.

- **Computer Vision AI System:**
    - **Architecture:** 3-layer design (Vision, Intelligence, Decision) for analyzing farm images.
    - **Vision Layer:** Pixel-level analysis for density, activity, cleanliness, lighting, and injury risk using a 4x3 spatial grid.
    - **Intelligence Layer:** Rules-based engine for crowding detection, anomaly root cause analysis, and risk scoring (weighted metrics).
    - **Decision Layer:** Generates prioritized recommendations with timeframes and predictive alerts.
    - **Metrics:** Stores `visual_metrics` (JSONB) per image, including `densityScore`, `crowdingScore`, `activityLevel`, `healthScore`, `injuryRisk`, `riskScore`, and `estimatedBirdCount`.

- **Daily Notes:** Text journal with categories and a smart AI parser that extracts transactions, hatching cycles, flocks, and tasks from Arabic/Swedish free text.

- **AI Analysis (Admin-only):**
    - Multi-dimensional scoring (Environment, Biological, Operations, Data Quality).
    - Anomaly detection using statistical analysis and scientific thresholds.
    - Trend analysis, predictive analytics, and actionable recommendations with confidence percentages.
    - Disease keyword detection and data quality assessment.
    - Chat mode for context-aware expert replies.

- **Daily Plan (Admin-only):**
    - AI-generated daily schedule based on farm data.
    - Dynamic task slots, risk level indicators, and daily tips.
    - Interactive checklist and progress bar.

- **Data Models:** PostgreSQL database schema includes `flocks`, `tasks`, `hatching_cycles`, `goals`, `users`, `daily_notes`, and `activity_logs` tables, with relevant indexes for performance.

## External Dependencies

- **Database:** PostgreSQL with Drizzle ORM.
- **AI Integrations:**
    - **OpenAI GPT-4o-mini Vision:** Accessed via Replit AI Integrations proxy for farm photo analysis.
- **Object Storage:**
    - **Google Cloud Storage:** Accessed via Replit sidecar proxy for storing farm photos under `/objects/uploads/`.
- **Weather API:** Open-Meteo (used in Decision Logic Layer for live weather data).

## Recent Updates (April 2026 — Latest)

- **ExplainTip Component (`src/components/ExplainTip.tsx`):** Reusable "?" icon that opens a bottom drawer with bilingual (AR/SV) explanation. Props: `titleAr`, `titleSv`, `textAr`, `textSv`, `size` (xs/sm/md), `className`. Uses `<span role="button">` to avoid nested button issues. Escape-closable.
- **ExplainTip on Analytics page (`/analytics`):** Added to Income/Expenses/Net Profit/Today KPIs, Health Score, Smart Alerts, Period Comparison, 7-Day Chart.
- **ExplainTip on Brain page (`/brain`):** Added to Health Score Ring, 4 Quick KPIs (Income/Expenses/Profit/Birds), Audit Panel header, and ALL 8 memory sections (Financial, Feed, Flock, Hatching, Tasks, Goals, Notes, Monthly Trend). `Section` component extended with `explainTitleAr/Sv` and `explainAr/Sv` props.
- **ExplainTip on Farm-Lab page (`/farm-lab`):** Added to Overall Score ring title, Risk Level badge, Financial Trend badge, Profit Margin, and all 6 dimension score bars (Financial, Production, Operations, Goals, Hatching, Total). `getDimensions()` returns explain props per dimension.
- **Navigation renamed for clarity:** `nav.aiAdvanced` → "مستشار المخاطر/Riskrådgivare", `nav.aiPrecision` → "تقرير الأداء/Prestationsrapport". Added `nav.*.desc` subtitle keys for all 14 nav items.
- **Layout.tsx:** 2-line nav items showing name + description subtitle for all navigation entries.
- **Live Decision Engine UI (Brain page):** Added "محرك القرار الحي / Live Beslutmotor" section to `/brain` page. Renders after audit panel. Features: gradient header card (red/amber/green based on `overallStatus`), collapsible body with weather strip (emoji + temp + humidity + wind), Arabic/Swedish summary text, danger/warning factor cards with urgency badges (فوري/راقب/منخفض), good-factors summary, decision score + live weather attribution footer. Polls `GET /api/ai/decision` every 30 seconds via `DECISION_INTERVAL` interval.
- **Humidity constants corrected everywhere:** `ai-engine.ts`, `advanced-ai-engine.ts`, `ai.ts`, `intelligence-engine.ts`, `decision-logic.ts`, and Swedish `hatching.tsx` — incubation phase 50–55% (opt 52), lockdown phase 70–75% (opt 72).
- **Brain page SQL fixes:** All 9 broken queries in `routes/brain.ts` repaired (FROM/WHERE clauses, UNION aliases, streak query simplified).

## Recent Updates (April 2026)

- **Real-Time Analytics Page (`/analytics`):** New dashboard with 5-second live polling. Features AnimatedNum counters, LivePulse indicator, 4 KPI cards, period comparison (today/week/month), 7-day bar chart, monthly area chart, expense pie chart, category progress bars, QuickAddForm (collapsible, category grid, feed qty/unit), feed analysis panel, health score, smart alerts, and recent transactions with delete.
- **Analytics API (`/api/analytics/live` + `/api/analytics/summary`):** Server-side SQL aggregations for KPIs, monthly trends, feed analysis, category breakdown, 7-day data, top records, and alert triggers.
- **Finance Module v4.1:** Complete with HHI/Pearson clickable drill-down modals, EMA(α=0.35), Z-Score(threshold 1.8), Cash Runway, Profit Velocity, Linear Regression, Cumulative P&L, period-vs-period delta.
- **i18n Fixes:** `nav.analytics` translation added; "السيرفر" corrected to "الخادم" in both i18n.ts and app.ts; WhatsApp link fixed to `wa.me`.
- **Navigation:** Analytics route added to App.tsx and Layout.tsx with Activity icon.

## Critical Technical Notes

- `pg` direct import fails in API — use drizzle's `sql` template tag instead.
- `zod` is NOT installed in api-server package.
- Finance uses `ar` boolean (not `t()`) for language checks in inline strings.
- No nested `<button>` inside buttons — InfoTip uses `<span role="button">`, KPI tiles use `<div role="button">`.
- InfoTip must NOT be placed inside clickable `div[role="button"]` cards — it calls stopPropagation() blocking parent events.
- Finance tabs: `dashboard|add|analysis|simulator|transactions|statement`
- Analytics live polling: every 5 seconds (`REFRESH_INTERVAL = 5_000`), live tick counter every 1 second.
- Feed unit parsing: كيلو/كغ→×1, طن/ton→×1000, غرام/gram→÷1000 (used in both analytics.ts backend AND analytics.tsx frontend).
## Production-Grade Smart Input Pipeline (April 2026)

- **New page `/smart-input` (`pages/smart-input.tsx`):** WhatsApp-style chat where worker types daily activity in Arabic/Swedish. Pipeline: type → parse → review (editable cards with toggles + validation badges) → confirm → atomic commit → all dashboards refresh automatically via `queryClient.invalidateQueries()`.
- **Backend split: `POST /api/ai/parse` (no writes, returns actions + per-action validation) + `POST /api/ai/commit` (re-validates server-side, atomic `db.transaction`, returns saved IDs + fingerprint).** Old `/api/ai/smart-analyze` kept for `/notes` backward compat.
- **Strict validator `lib/actionValidator.ts`:** range checks (amount 1–100M, eggs 1–50K, birds 1–200K, temp 30–45°C optimal 37.5–37.8, humidity 10–100% incubation 50–55%), duplicate detection (same date+amount+category+type → warning), logic checks (eggsHatched ≤ eggsSet, no active cycle for hatching_result, future-dated transactions warned), bilingual AR/SV error messages with severity (error blocks / warning advises / info notes).
- **Atomicity:** All inserts wrapped in `db.transaction` — if any action fails the entire commit rolls back, preventing partial writes that could corrupt KPIs.
- **Source-text traceability:** Original text persisted to `daily_notes` inside the same transaction.
- **Nav:** New entry "إدخال ذكي / Smart inmatning" with `MessageSquareText` icon, placed second after Dashboard.

## Finance Module Cleanup (April 2026)

- **Removed HHI (Herfindahl-Hirschman Index) and Pearson Correlation** from `pages/finance.tsx` — they were academically interesting but operationally non-actionable for a single-farm context. Removed from: `GLOSSARY` entries, `pearson()` function, `AdvMetrics` interface (`hhi`, `hhiGrade`, `feedIncomeCorr`), `computeAdvanced()` logic, `generateRecommendations()` "diversify" rec, drill-down branches, the 2-tile UI section (replaced by a richer 3-cell next-month linear-regression prediction card), header subtitle, and file header comment.
- **Income CV stability tile** is now static (no longer mistakenly bound to the deleted `setDrillKey("pearson")`).
