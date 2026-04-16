# Workspace — مدير المزرعة (Poultry Farm Manager)

## Overview

This project is a full-stack poultry farm management system designed to optimize farm operations and boost profitability. It features two distinct web frontends (Arabic and Swedish) that share a single API backend, all managed within a pnpm workspace monorepo. The system aims to provide comprehensive financial and production intelligence, leveraging advanced analytics, AI-powered insights, and computer vision for enhanced decision-making. Key capabilities include real-time financial tracking, anomaly detection, predictive forecasting, intelligent task management, and detailed performance analysis, ultimately aiming to improve farm efficiency and financial outcomes.

## User Preferences

I prefer iterative development, where we focus on one feature or module at a time. Please ask for my approval before making any major architectural changes or implementing new features. I value clear, concise explanations and prefer to be involved in key design decisions.

## System Architecture

The system is structured as a pnpm monorepo, facilitating shared code and consistent development across multiple applications.

**UI/UX Decisions:**
- **Localizations:** Separate Arabic (RTL) and Swedish (LTR) web applications (`artifacts/poultry-manager` and `artifacts/poultry-manager-sv`).
- **Typography:** Arabic uses Tajawal/Cairo fonts; Swedish uses Inter font.
- **Color Scheme:** A warm earthy palette (primary: `#B85C2A`, background: `#F7F0E6`, sidebar: `#1A1208`) is consistently applied across both frontends.
- **Component Library:** Both frontends utilize `shadcn/ui` for responsive and consistent componentry.
- **Role-based Access:** Features and navigation are access-controlled based on user roles (e.g., `admin`, `worker`).

**Technical Implementations:**
- **Frontend:** React with Vite.
- **Backend:** Express 5.
- **Monorepo Management:** pnpm workspaces.
- **Language & Type Checking:** TypeScript 5.9.
- **Build Tool:** esbuild (CJS bundle).
- **API Generation:** Orval for generating API hooks and Zod schemas from an OpenAPI specification (`lib/api-spec/openapi.yaml`).
- **Authentication:** Session-based with bcrypt-hashed credentials and PostgreSQL for session storage. Supports `admin` and `worker` roles.
- **Security:** Helmet for headers, rate limiting, CORS for all origins, secure httpOnly/sameSite session cookies, Zod for input validation, parameterized queries via Drizzle ORM, and audit logging.
- **Multi-language Support:** Full localization for Arabic and Swedish across frontends and reports.

**Feature Specifications & System Design Choices:**
- **Finance & Production Intelligence:** Real-time data polling, a 7-rule deterministic anomaly detection engine, cost intelligence metrics (cost per bird/day, profit per bird, ROI%), and a linear regression-based predictive engine for financial forecasting. Includes various UI components for data visualization and reporting.
- **Intelligence System:** A context-aware 7-point analysis using a `Context Engine` to aggregate daily farm data into `DaySnapshot` objects and an `Intelligence Engine` to generate localized reports covering current state, historical comparison, root causes, risks, and recommended actions.
- **Computer Vision AI System:** A 3-layer architecture (Vision, Intelligence, Decision) for analyzing farm images. The Vision Layer performs pixel-level analysis for metrics like density, activity, and injury risk. The Intelligence Layer uses a rules-based engine for anomaly detection and risk scoring. The Decision Layer generates prioritized recommendations and alerts. Stores `visual_metrics` as JSONB.
- **Daily Notes:** A text journal with categories, featuring an AI parser that extracts transactions, hatching cycles, flocks, and tasks from free-text entries in Arabic/Swedish.
- **AI Analysis (Admin-only):** Provides multi-dimensional scoring, statistical anomaly detection, trend analysis, predictive analytics, actionable recommendations, disease keyword detection, and a chat mode for expert replies.
- **Daily Plan (Admin-only):** AI-generated daily schedules, dynamic task slots, risk indicators, and daily tips with an interactive checklist.
- **Data Models:** PostgreSQL database schema includes tables for `flocks`, `tasks`, `hatching_cycles`, `goals`, `users`, `daily_notes`, and `activity_logs`, with appropriate indexing.
- **Smart Input Pipeline:** A WhatsApp-style chat interface (`/smart-input`) for workers to input daily activities. The backend processes these inputs through a parse-review-confirm-commit pipeline, ensuring server-side validation and atomic database transactions. Includes a strict `actionValidator` for range checks, duplicate detection, and logic checks, with bilingual error messages.
- **Farm Domains (SSOT):** A central `farmDomains.ts` module defines all transaction categories, domain partitions (e.g., `feed`, `egg`, `health`), bilingual labels, and classification logic. Ensures consistency across transaction processing and AI parsing.
- **DB Schema Updates:** `transactions` table includes a `domain` column auto-populated from `farmDomains`. `activity_logs` table includes a `task_id` FK, linking activities to tasks and automatically marking tasks as completed.
- **Egg Classification Fix:** Rewritten `noteSmartParser.ts` to use `farmDomains` SSOT, correctly prioritizing egg purchase classification over hatching cycle detection to prevent misclassification.
- **Real-Time Incubation Live Tracker:** A component in `pages/hatching.tsx` that displays the progress of incubation cycles in real-time with phase-specific coloring and markers.
- **Daily Operations Center (`/operations`):** A new page with tabs for Overview, Tasks, and Activity Log. Features KPI strips, overdue task alerts, smart task-activity linking (auto-completes tasks when linked activities are created), and immediate task completion toggles.
- **Activity Logs/Transactions Route Enhancements:** Routes updated to accept `taskId` for activity logs, auto-complete linked tasks, support DELETE, and auto-populate/validate the `domain` column for transactions based on `farmDomains`.

## External Dependencies

- **Database:** PostgreSQL (with Drizzle ORM).
- **AI Integrations:** OpenAI GPT-4o-mini Vision (via Replit AI Integrations proxy).
- **Object Storage:** Google Cloud Storage (via Replit sidecar proxy for farm photos).
- **Weather API:** Open-Meteo (for live weather data in decision logic).