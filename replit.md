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