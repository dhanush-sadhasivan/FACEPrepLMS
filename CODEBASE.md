# Project Architecture & Codebase Guide: FACEPrep LMS & HackerRank Scraper

> **Single Source of Truth for the Entire Codebase**  
> *Note for AI Models & Developers*: Always review this document before making code changes. Whenever any file, API route, database schema, or service configuration is modified, this document **must** be updated accordingly.

---

## 1. System Overview & Architecture

This repository is a unified multi-service platform designed for technical training, contest tracking, and coding performance analytics (HackerRank and LeetCode). It comprises two primary production services alongside database infrastructure:

1. **`lms/`**: A modern full-stack web application built with **Next.js 16 (App Router)**, **React 19**, **TypeScript**, **Supabase (Auth, PostgreSQL, Storage CDN)**, and **SWR**. Provides dashboards, internal training trackers, contest analytics, roadmap management, reports, and administrative tools.
2. **`scraper-service/`**: A standalone **Node.js / Express** background microservice deployed on **Railway**. It uses **Puppeteer** for session authentication and **Axios** for high-throughput, rate-limit-conscious scraping of HackerRank contest questions and user completions. It writes results directly to Supabase and generates pre-calculated CDN cache snapshots.
3. **`archive/`**: Historical and legacy scraper prototypes kept for reference.

### High-Level Architecture Diagram

```
                              ┌───────────────────────────────────┐
                              │           HackerRank              │
                              │  (Contests, Challenges, Progress) │
                              └─────────────────┬─────────────────┘
                                                │
                                       HTTPS (Cookies / API)
                                                │
                                                ▼
┌─────────────────────────┐          ┌───────────────────────┐
│     End Users / UI      │          │   scraper-service     │
│ (Students/Trainers/     │          │  (Node.js + Express)  │
│      Admins)            │          │  Puppeteer Auth Pool  │
└───────────┬─────────────┘          │  3-Tier Progress Sync │
            │                        └──────────┬────────────┘
         Browser                                │
      HTTPS / SWR                               │ Direct Service Role
            │                                   │ DB Writes & Snapshots
            ▼                                   ▼
┌─────────────────────────┐          ┌───────────────────────────┐
│        LMS App          │◄─────────┤   Supabase Cloud / CDN    │
│  (Next.js 16 App Router)│          │  - PostgreSQL Database    │
│  - Dashboard & Roadmaps │          │  - Storage Bucket         │
│  - Internal Training    │          │    ('api-cache' CDN)      │
│  - LeetCode Sync Engine │          │  - pg_cron Auto-Scheduler │
│  - Report Generator     │          │  - Auth & Row-Level Sec   │
└─────────────────────────┘          └───────────────────────────┘
            │                                     ▲
            └─────────────────────────────────────┘
                 SWR + Next.js fetch cache (60s SWR)
```

---

## 2. Directory Structure

```
lucid-pascal/
├── AGENTS.md                   # Workspace agent instructions & sync rules
├── GEMINI.md                   # Gemini workspace rules
├── CODEBASE.md                 # THIS FILE - comprehensive codebase documentation
├── TEST_INFRA.md               # Test architecture, runner specs, and requirement coverage matrix
├── TEST_READY.md               # Test suite readiness declaration and execution summary
├── .agent/
│   └── rules/
│       └── maintain-codebase-doc.md  # Continuous documentation sync rule
│
├── lms/                        # Main LMS Application (Next.js 16 App Router)
│   ├── scripts/                # Automated testing & operational scripts
│   │   ├── run-e2e-tests.mjs   # Comprehensive E2E test suite (Tiers 1-4, R1-R5)
│   │   ├── run-security-tests.mjs # Standalone Security Test Suite (6 Tiers, 52 Tests)
│   │   └── challenger2-security-stress.mjs # Empirical PRNG, Constant-Time, CSV & SSRF Stress Harness
│   ├── app/                    # Next.js App Router root
│   │   ├── (dashboard)/        # Authenticated dashboard layout & pages
│   │   │   ├── admin/          # Admin-only portals (users, helpdesk, roadmaps)
│   │   │   ├── contests/       # Contest listings, details, auto-scrape config
│   │   │   ├── courses/        # Course catalog & assignment views
│   │   │   ├── dashboard/      # Main KPI dashboard (leaderboard, stats)
│   │   │   ├── groups/         # Batch & cohort management
│   │   │   ├── internal-training/ # IT Day plans, calendars, question checks
│   │   │   ├── notifications/  # User notifications & broadcast announcements
│   │   │   ├── profile/        # User profile & handle configurations
│   │   │   ├── reports/        # Analytics export (Excel/CSV) & summaries
│   │   │   ├── roadmaps/       # Topic-based learning paths
│   │   │   └── skills/         # Skills & LeetCode profile tracker
│   │   ├── api/                # Backend API routes (REST endpoints)
│   │   │   ├── access-requests/# Contest access requests
│   │   │   ├── admin/          # Admin operations (users, roadmaps, questions)
│   │   │   ├── cache/          # CDN cache revalidation & trigger endpoints
│   │   │   ├── contests/       # Contest CRUD & detail retrieval
│   │   │   ├── groups/         # Group CRUD and membership
│   │   │   ├── internal-training/ # IT attendance, disputes, question clicks, day plans
│   │   │   ├── leetcode/       # LeetCode public GraphQL sync & lookup
│   │   │   ├── notifications/  # Notification read/unread & announcements
│   │   │   ├── questions/      # Question metadata management
│   │   │   ├── reports/        # Dynamic report queries
│   │   │   ├── scrape/         # Scraper triggers, status proxies, auto-cron
│   │   │   ├── support-tickets/# Profile change support tickets
│   │   │   ├── trainer/        # Trainer courses, todos, roadmaps, IT check
│   │   │   └── users/          # User management, bulk import, validation
│   │   ├── login/              # Login screen & password reset flow
│   │   ├── globals.css         # Global styling & CSS custom properties
│   │   ├── layout.tsx          # Root HTML layout with providers
│   │   └── page.tsx            # Root redirect (to /dashboard)
│   ├── components/             # Reusable UI components
│   │   ├── CollapsibleSection.tsx # Collapsible section with smooth transitions & persistence
│   │   ├── GlobalFloatingTodo.tsx  # Floating sticky note todo widget with multiline wrapping & full note visibility
│   │   ├── GlobalSupportModal.tsx # Global helpdesk support ticket modal
│   │   ├── ITAttendanceModal.tsx  # Internal training attendance modal
│   │   ├── NotificationBell.tsx   # Realtime notification center trigger
│   │   ├── Pagination.tsx         # Reusable paginated data table controller
│   │   ├── PresenceProvider.tsx   # Realtime user online presence
│   │   ├── SessionManager.tsx     # Session activity watcher
│   │   ├── Sidebar.tsx            # Collapsible role-based navigation sidebar
│   │   ├── ThemeProvider.tsx      # Dark / light theme provider
│   │   ├── Toast.tsx              # Application toast alerts
│   │   └── TopBar.tsx             # Header bar with user profile & controls
│   ├── lib/                    # Shared libraries, utilities, and services
│   │   ├── cdn-cache.ts        # Supabase Storage CDN caching & revalidation
│   │   ├── contest-analytics.ts# RPC data mappers for contest statistics
│   │   ├── email.ts            # Resend email notification service
│   │   ├── it-calendar.ts      # Working days, holidays, & calendar calculator
│   │   ├── it-day-counter.ts   # IT attendance, location & active day counting
│   │   ├── leetcode.ts         # LeetCode GraphQL client, problem list & profile parser
│   │   ├── leetcode-sync.ts    # Reusable contest solve syncer for LeetCode participants
│   │   ├── roadmap-analytics.ts# Topic & milestone completion calculator
│   │   ├── security.ts         # Cryptographic PRNG password generator, timing-safe string comparison, and CSV sanitization
│   │   ├── supabase/           # Supabase client singletons:
│   │   │   ├── client.ts       # Browser client (@supabase/ssr)
│   │   │   ├── server.ts       # Server-side client with request cookies
│   │   │   ├── admin.ts        # Service role client (bypasses RLS)
│   │   │   └── middleware.ts   # Session refresh & route protection
│   │   ├── swr-hooks.ts        # SWR data fetching hooks
│   │   ├── types.ts            # TypeScript definitions for the entire app
│   │   └── utils.ts            # Formatting & general helper functions
│   ├── supabase/               # Database migrations and baseline schema
│   │   ├── schema.sql          # Primary database DDL & RLS policies
│   │   └── migrations/         # Incremental SQL migration scripts
│   ├── middleware.ts           # Next.js edge route protection middleware
│   └── package.json            # Dependencies: Next.js 16, React 19, Supabase
│
├── scraper-service/            # HackerRank Scraper Microservice (Node.js/Express)
│   ├── src/
│   │   ├── auth.js             # Puppeteer login & cookie pool manager
│   │   ├── cdnPublisher.js     # Uploads JSON snapshots to Supabase Storage
│   │   ├── challengesScraper.js# Fetches contest questions & details
│   │   ├── hackerrank.js       # Axios HTTP client for HackerRank API calls
│   │   ├── jobStore.js         # In-memory job progress tracking store
│   │   ├── progressScraper.js  # 3-tier fallback progress scraping engine
│   │   ├── supabaseClient.js   # Supabase client with service role key
│   │   └── routes/             # Express API routes
│   │       ├── challenges.js   # POST /scrape/challenges
│   │       ├── progress.js     # POST /scrape/progress
│   │       └── status.js       # GET /scrape/status/:jobId
│   ├── Dockerfile              # Docker container setup for Railway deployment
│   ├── server.js               # Express server entry point & auth guard
│   └── package.json            # Dependencies: Express, Puppeteer, Axios
│
└── archive/                    # Deprecated / Archived code
    └── railway-scraper/        # Early prototype scripts
```

---

## 3. LMS Application Details (`lms/`)

### 3.1 Tech Stack & Libraries
- **Framework**: Next.js 16.3.0 (App Router), React 19.2.8, TypeScript 5.
- **Data & State**: SWR 2.5.1 (stale-while-revalidate client-side data fetching).
- **Backend / Database**: Supabase (`@supabase/ssr` 0.12.4, `@supabase/supabase-js` 2.112.3).
- **Files & Data Processing**: `papaparse` (CSV import/export), `xlsx` (Excel report generation).
- **Transactional Email**: `resend` (access request approvals, system notifications).
- **Styling**: Modular CSS files paired with components/pages (`*.css`), global variables in `globals.css`.

### 3.2 Authentication & Authorization Model
- **User Roles (`UserRole`)**:
  - `admin`: Full administrative access (user management, global configs, bulk import, roadmaps, contest scraping).
  - `manager`: Management access (group management, contest management, scraper triggers, access requests).
  - `trainer`: Standard learner/trainer role (participating in contests, internal training tracker, solving challenges, viewing personal roadmaps).
- **Route Guarding**:
  - `middleware.ts` runs on all requests (except static assets and `_next`), checking Supabase session validity. Unauthenticated requests are redirected to `/login`.
  - In `app/(dashboard)/layout.tsx`, the user's role is queried from `public.users` and passed down to `DashboardLayoutClient`.
  - Forced Password Reset: Users with `must_change_password: true` in `user_metadata` are forced to change their password via a blocking modal on first login.
- **Supabase Clients in `lib/supabase/`**:
  - `client.ts`: Uses `createBrowserClient` for browser-side React components.
  - `server.ts`: Uses `createServerClient` reading cookies for Server Components and Server Actions.
  - `admin.ts`: Uses `createClient` with `SUPABASE_SERVICE_ROLE_KEY`. **Must only be used in secure API routes on the server** to bypass Row-Level Security (RLS) for admin operations and batch syncs.

### 3.3 Core Feature Modules

#### A. Dashboard (`/dashboard`)
- Displays overall cohort statistics: total participants, total challenges solved, average scores.
- Renders the Global Leaderboard with performance filters (by group, team, or contest).
- Powered by Supabase Storage Smart CDN caching (`getCachedGlobalLeaderboard()`) for instant loading without running heavy aggregate SQL queries on every page hit.

#### B. Internal Training (`/internal-training`)
- Purpose: Tracks daily guided training programs for new trainees/trainers.
- **Interactive IT Attendance Toggle & Location Tracking (`ITAttendanceToggle.tsx`, `ITCheckInModal.tsx`, `ITDisputeModal.tsx`)**:
  - Replaces rigid button checks with an interactive state toggle.
  - **Toggle ON (Check In)**: Prompts trainer for today's training location (`Coimbatore-office`, `Chennai-office`, `Vijayawada-office`, `Hyderabad-office`, `Work from Home`, or `Outstation`). Unlocks the day's curriculum and challenge questions.
  - **Toggle OFF (Dispute)**: Prompts trainer for a reason, creates an `it_attendance_disputes` support ticket, and flags attendance as `⏳ Pending Review` (while keeping the IT day counted until resolved).
  - **Manager / Admin Resolution (`/admin/helpdesk`)**: Managers review and approve disputes (which decrements `it_days_logged` and adjusts global count) or decline disputes with audit feedback.
- **Calendar & Working Days Calculation (`lib/it-calendar.ts`)**:
  - Supports custom working day configurations (e.g., Monday through Friday).
  - Automatically calculates target calendar dates for Day 1, Day 2, etc., skipping weekends and excluded days.
  - Handles day extension requests (`ITTrainerProgress.extended_days`).
- **Question Verification & Completion**:
  - Distinguishes between HackerRank problems and custom problem links.
  - Trainees click to launch the problem (logged in `it_question_completions.clicked_at`).
  - Completions are marked either automatically via scraper results (`hr_solved`) or manually by trainers (`is_completed`).
- **Overview Table for Managers (`/api/internal-training/trainer-overview` & `TrainerOverviewTable.tsx`)**:
  - Summarizes each trainee's current day, total days, completed questions, pending questions, attendance count (`it_days_count`), location, and online status.
  - Standardized with reusable `<Pagination />` component providing numeric page buttons, configurable items-per-page (`pageSizeOptions={[10, 25, 50, 100]}`), responsive range indicators, and automatic page reset to 1 on query, filter, or page size changes.
  - Fully hardened with null-safe search predicates covering `full_name`, `emp_id`, `team`, `roadmap_title`, `email`, `location.type`, and `location.detail`, as well as null-guarded avatar gradients, initials, and numeric sorting comparators.

#### C. Contests (`/contests`)
- Lists active, upcoming, and past HackerRank contests.
- Allows admins/managers to:
  - Add new contests using a HackerRank contest slug.
  - Scrape and populate contest challenges (`/api/scrape/challenges`).
  - Manually trigger progress scrape for a contest (`/api/scrape/trigger`).
  - Configure automated scraping via `AutoScrapeScheduler` and `AutoScrapeConfigModal`.
  - Tag and organize contest questions into topics via `ManageTopicsModal`.

#### D. Topic Roadmaps (`/roadmaps` & `/admin/roadmaps`)
- Structured learning paths containing ordered topics, milestones, resources, and practice questions.
- Can be directly linked to a HackerRank contest (`contest_id`).
- Admins can create and edit roadmaps (`DayPlanTab.tsx`); trainees can mark topics complete and track overall progress.
- **Admin Day Plan Question Picker Modal (`DayPlanTab.tsx`)**: Slices large question catalogs with pagination state (`pickerPage`, `pickerPageSize`, `<Pagination />`), null-safe title/contest/domain filtering, and automatic page resetting on search/domain changes to prevent DOM overflow.

#### E. Skills & LeetCode Integration (`/skills` & `/api/leetcode/*`)
- Allows users to link their LeetCode username or profile URL (`parseLeetcodeUsername`).
- `/api/leetcode/sync`: Queries LeetCode's public GraphQL API (`https://leetcode.com/graphql`) to fetch:
  - Total solved count, broken down by difficulty (Easy, Medium, Hard).
  - Global ranking and contest rating.
  - Submission calendar heatmap.
  - Stores data in `leetcode_user_stats`.
- `/api/leetcode/problem-lookup`: Validates individual LeetCode problems and fetches metadata (difficulty, acceptance rate, tags).

#### F. Reports & Analytics (`/reports`)
- Comprehensive export module for managers and admins across Contests, Internal Training, Team Benchmarks, Topic Roadmaps, and Inactivity Audits.
- **Internal Training & Attendance Tab (`it-attendance`)**:
  - Live data population via `get_it_trainer_overview` RPC with automatic resilient in-app fallback in `/api/reports`.
  - Fully tracks trainer name, employee ID, team, assigned IT roadmap title, current day, total days, check-in date, location (office name or WFH with detail), solved progress count, completion percentage, backlog status (`pending_questions_count`), and IT days count.
  - Multi-criteria filtering by Date range, Team, Roadmap, and Search query (matching names, IDs, roadmaps, teams, and location text).
  - Summary KPI cards displaying Total Trainers, Completed, On Track, In Backlog, Location Split (Office vs WFH), and Avg Completion %.
  - Complete full-fidelity CSV and Excel export (`getFormattedExportData`) including Check-In Date, Location, and Backlog metrics.
- Exports contest performance, participant rankings, submission status, and attendance data into formatted Excel (`.xlsx`) or CSV (`.csv`) files using `xlsx` and `papaparse`.

#### G. Notification & Announcements System (`/notifications`)
- Realtime bell indicator (`NotificationBell.tsx`) displaying unread notifications.
- Supports types: `access_request`, `contest_assigned`, `access_approved`, `access_denied`, `system`, and `announcement`.
- Admin broadcast feature to send announcements to all users or specific groups.

### 3.4 Smart CDN Caching & Minimization System (`lib/cdn-cache.ts`)
To maintain high responsiveness under heavy traffic while protecting trainee privacy, the LMS avoids running expensive aggregation queries on every dashboard load and ensures public snapshots are strictly minimized:
- Pre-aggregated JSON files (`leaderboard.json` and `contest-{contestId}.json`) are uploaded directly to the Supabase Storage bucket `api-cache`.
- **Public Data Minimization**: CDN snapshot payloads are stripped of all internal database UUIDs (`id`, `user_id`), email addresses, and employee identifiers (`emp_id`). Public consumers receive only display-safe attributes (`rank`, `name`, `team`, `score`, `solved`, and optional sanitized question progress).
- `it_trainer_overview.json` is excluded from the public CDN bucket to preserve internal training roster privacy.
- Frontend reads from the public CDN URL using Next.js `fetch` with `revalidate: 60` (stale-while-revalidate) and dynamic cache-busting timestamp parameter (`?t=${Date.now()}`).
- **Self-Healing Fallback**: If a CDN file returns 404, `getCachedGlobalLeaderboard()` triggers a background generation (`generateAndUploadCdnSnapshots()`) using stored RPC functions.
- `/api/cache/refresh`: Admin endpoint to force snapshot generation on demand using constant-time timing-safe key authentication.

### 3.5 Automated Scraper Scheduler & Concurrency Control (`app/api/scrape/auto-cron/*`)
- Triggered on a recurring schedule (every 30 minutes) via Supabase `pg_cron` or external scheduler.
- **Enforcement Rules**:
  - Restricts execution to working hours: **10:00 to 18:00 IST**.
  - Checks allowed weekdays configured in `auto_scrape_config` (e.g., Monday through Friday).
  - Sequentially triggers contests with a 5-second buffer to prevent CPU/network spikes.
  - **Atomic Concurrency Mutex**: Uses PostgreSQL conditional atomic updates (`UPDATE auto_scrape_schedules SET is_running = true WHERE id = ... AND (is_running = false OR is_running IS NULL)`) to eliminate TOCTOU race conditions between simultaneous cron ticks.

### 3.6 Comprehensive Security & Hardening Architecture (Requirements R1–R6)

#### 3.6.1 Authentication, Session Management & Identity Security (Requirement R1)
- **Cryptographic PRNG Passwords (`lib/security.ts`)**: Replaced non-cryptographic `Math.random()` with `generateSecureTempPassword()` using `crypto.randomBytes(8).toString('hex') + 'A1!'` (19-character high-entropy passwords satisfying uppercase, digit, and symbol complexity).
- **Password Reset Role Hierarchy (`app/api/users/[id]/reset-password`)**: Managers are strictly prohibited from resetting Admin passwords (returning `403 Forbidden`). Only Admins can reset Admin passwords.
- **Role Escalation Protection**: Single user creation (`POST /api/users`), bulk user import (`POST /api/users/bulk`), and user patching (`PATCH /api/users/[id]`) restrict `role` modification and Admin account creation strictly to authenticated callers with `role === 'admin'`.
- **Identity Self-Update Protection (`app/api/users/me`)**: Standard users can update display preferences (`full_name`, `team`, `manager`), but cannot modify `role`, `emp_id`, or audit metadata.
- **Cookie Security**: Session cookies in `@supabase/ssr` enforce `HttpOnly; Secure; SameSite=Lax` attributes across all browser and server contexts.

#### 3.6.2 API Route Authorization, BOLA/IDOR & PII Projection Rules (Requirement R2)
- **Universal Session Verification**: Every route utilizing `getAdminClient()` first verifies `supabase.auth.getUser()` and returns `401 Unauthorized` for missing or invalid sessions.
- **BOLA & Function-Level Authorization**:
  - Public validation endpoints (`/api/users/validate-leetcode`, `/api/users/validate-hackerrank`) require authentication; duplicate errors return generic messages to prevent user directory harvesting.
  - LeetCode contest batch sync (`POST /api/leetcode/sync` with `contestId`) requires Admin or Manager privileges, preventing trainers from triggering mass sync jobs.
  - User deletion (`DELETE /api/users/[id]`) and admin routes (`/api/admin/*`) are restricted exclusively to Admins.
- **PII & Management Metadata Projection Rules (OWASP API3:2023)**:
  - `GET /api/users`: Standard trainers querying user listings receive sanitized records with other users' `emp_email`, `emp_id`, and `manager` omitted.
  - `GET /api/support-tickets` & `GET /api/internal-training/attendance/dispute`: Responses returned to trainers have confidential `admin_notes`, resolver UUID (`resolved_by`), and internal `resolver` profile details stripped.
- **Scraper Status Scrubbing (`GET /api/scrape/status`)**: Progress responses return strictly sanitized job metadata (`jobId`, `status`, `progress`, `total`, `solved`), omitting session cookies (`_hr_session`), API tokens, and internal service URLs.
- **Database Error Sanitization**: All 56 API route handlers catch blocks log diagnostic details server-side only, returning generic user-safe error messages (e.g. `{ error: 'Failed to update contest' }`), preventing disclosure of PostgreSQL schema, table names, or error codes (`PGRST`, `42P01`, `23505`).
- **Timing-Safe Service Authentication**: All internal service endpoints (`/api/scrape/ingest`, `/api/cache/refresh`, `/api/scrape/auto-cron`, `/api/scrape/revalidate`) validate keys using `safeTimingCompare()` (`crypto.timingSafeEqual`) and fail closed on empty secrets.
- **Scraper Microservice Fail-Closed Guard (`scraper-service/server.js`)**: Middleware fails closed with `401 Unauthorized` if `API_KEY` is unset or empty, protecting all scraping routes from unauthenticated public exposure.

#### 3.6.3 Database Row-Level Security (RLS) & Stored Procedure Hardening (Requirement R3)
- **Hardened `public.users` RLS**: Dropped permissive policies; standard users can query only their own profile (`auth.uid() = id`), while Admins and Managers can query all users. Self-updates are enforced with a strict `WITH CHECK` preventing self-escalation of `role`, `emp_id`, `it_days_count`, and `last_it_check_date`.
- **Attendance Forgery Prevention (`public.it_trainer_progress`, `it_question_completions`, `user_roadmap_progress`)**: Mutations (`INSERT`, `UPDATE`, `DELETE`) are restricted strictly to Admins, Managers, and the service role, forcing all attendance actions through authenticated server API endpoints.
- **Ticket & Dispute Row Ownership (`public.support_tickets`, `public.it_attendance_disputes`)**: SELECT and INSERT are scoped to row owner (`auth.uid() = user_id`); UPDATE is restricted to Admins and Managers.
- **Stored Procedure Security (`SET search_path = public, pg_temp`)**: Applied search path lockdown to all 6 RPC stored procedures (`get_contest_analytics`, `get_roadmap_analytics`, `get_it_trainer_overview`, `get_user_performance_profile`, `get_global_leaderboard`, `get_contest_leaderboard_rpc`), revoked `EXECUTE` from `anon`/`PUBLIC`, and enforced internal caller role authorization checks.
- **Storage Bucket Policy (`api-cache`)**: Public read allows SELECT on pre-computed JSON snapshots; mutations (`INSERT`, `UPDATE`, `DELETE`) are restricted strictly to `service_role`.

#### 3.6.4 Input Validation, SSRF, CSV Formula Injection & Security Headers (Requirement R4)
- **Global Security Headers (`next.config.ts`)**: Configured `headers()` applying `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy`, `X-XSS-Protection: 1; mode=block`, and `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- **Edge Cache-Control (`lib/supabase/middleware.ts`)**: Injects `Cache-Control: no-store, no-cache, must-revalidate, private` on all `/api/*` and authenticated requests.
- **SSRF & Open Redirect Prevention (`lib/security.ts`, `api/internal-training/redirect`)**: `isSafeRedirectUrl()` enforces `https:` protocol, verifies hostnames against an allowlist (`hackerrank.com`, `leetcode.com`, `github.com`, `faceprep.in`), and rejects loopback (`127.0.0.1`, `::1`, `localhost`), cloud metadata (`169.254.169.254`), and private IPv4 ranges (`10.x`, `172.16-31.x`, `192.168.x`).
- **Identifier Validation (`isValidIdentifier`)**: Validates usernames, problem slugs, and contest IDs against `/^[a-zA-Z0-9_-]+$/` before constructing LeetCode GraphQL queries.
- **CSV & Excel Formula Injection Defense (CWE-1236)**: `sanitizeCsvCell()` and `sanitizeExportData()` in `ReportsHubClient.tsx` and `users/bulk` prepend a single quote (`'`) to strings starting with dangerous formula characters (`=`, `+`, `-`, `@`, `\t`, `\r`). Maximum payload size limit of 500 records is enforced on bulk user import.
- **Mass Assignment Defense**: `POST /api/contests` and `PATCH /api/questions/[id]` strictly allowlist acceptable body fields and discard injected system/audit columns.

#### 3.6.5 Secrets Management, CDN Snapshot Minimization & Concurrency Controls (Requirement R5)
- **Server-Only Secrets**: `SUPABASE_SERVICE_ROLE_KEY`, `RAILWAY_API_KEY`, `SCRAPER_INGEST_API_KEY`, `RESEND_API_KEY`, and `HACKERRANK_PASSWORD_*` are never imported into `'use client'` components or prefixed with `NEXT_PUBLIC_`.
- **Scraper & Sync Rate Limiting (`lib/rate-limiter.ts`)**: In-memory rate-limiter enforces a 60-second cooldown per contest and per user on `POST /api/scrape/trigger` and `POST /api/leetcode/sync`, returning `429 Too Many Requests` with `Retry-After` headers.
- **Atomic Cron Lock (`app/api/scrape/auto-cron`)**: Conditional database updates prevent concurrent cron workers from launching duplicate scraper batches.

#### 3.6.6 Automated Security Regression Test Harness (`scripts/run-security-tests.mjs`) (Requirement R6)
- **Standalone Security Runner**: Zero-dependency ESM test runner executing 52 security test assertions across all 6 tiers with 100% pass rate.
- **Execution Command**: `npm run test:security` or `node scripts/run-security-tests.mjs`.

---

## 4. Scraper Service Details (`scraper-service/`)

### 4.1 Purpose & Standalone Deployment
The scraper service is an isolated Express.js service containerized with Docker and deployed on Railway. It handles the heavy lifting of logging into HackerRank, interacting with HackerRank's private API endpoints, and syncing data back to Supabase.

### 4.2 API Endpoints
All endpoints (except `/health`) require the `x-api-key` header matching the `API_KEY` environment variable.

| Method | Route | Description |
|---|---|---|
| `GET` | `/health` | Healthcheck returning `{ status: 'ok', ts: ... }` |
| `POST` | `/scrape/challenges` | Synchronously fetches contest challenges and writes to Supabase `questions` |
| `POST` | `/scrape/progress` | Asynchronously starts a user progress scrape job; returns `{ jobId }` |
| `GET` | `/scrape/status/:jobId` | Polls the status, percent completion, and logs of an active or finished job |

### 4.3 Multi-Credential Account Pool (`src/auth.js`)
To avoid HackerRank rate limits and account locks when scraping contests with dozens or hundreds of trainees:
- The service supports multiple HackerRank admin credentials (`HACKERRANK_EMAIL_1`, `HACKERRANK_PASSWORD_1`, `HACKERRANK_EMAIL_2`, etc.).
- Puppeteer launches headless Chromium, enters credentials, solves basic session requirements, captures session cookies (`_hr_session`), and closes the browser immediately.
- The pool partitions the user list among the active credentials, multiplying overall throughput while staying within HackerRank thresholds.

### 4.4 3-Tier Fallback Scraping Strategy (`src/progressScraper.js`)
For each contest user, the scraper applies a 3-tier resolution strategy:
1. **Tier 1: Contest Leaderboard API (Bulk)**: Fast fetch of the contest's full leaderboard. If the user appears with complete challenge breakdown, progress is parsed in bulk.
2. **Tier 2: User Contest Submissions API**: If leaderboard data is incomplete or truncated, queries the specific user's contest submission history endpoint.
3. **Tier 3: Per-Challenge Last Resort**: If specific submissions are missing, checks individual challenge submission records.
- Concurrency: Processes batches of 5 users concurrently per credential.
- Direct Writes: Inserts/upserts records directly into `public.progress` in Supabase using the service role client.
- Post-Job CDN Snapshot: Upon completion, immediately invokes `cdnPublisher.js` to upload fresh `leaderboard.json` and `contest-{id}.json` to Supabase Storage.

---

## 5. Database Schema & Data Models

### 5.1 Core Tables (`supabase/schema.sql`)
- **`users`**: Extends `auth.users`. Contains `emp_id`, `full_name`, `email`, `emp_email`, `team`, `manager`, `hackerrank_id`, `leetcode_id`, `role` (`admin` | `manager` | `trainer`).
- **`groups`**: Cohort / batch groupings created by managers or admins.
- **`group_members`**: Join table mapping `group_id` to `user_id`.
- **`contests`**: Contest records with `title`, `hackerrank_slug`, `start_date`, `end_date`, `last_scraped_at`.
- **`contest_assignments`**: Assigns contests to entire groups or specific teams.
- **`questions`**: Problems belonging to a contest. Columns include `slug`, `title`, `domain`, `hackerrank_url`, `max_score`, `difficulty`, `order_index`, `is_enabled`.
- **`progress`**: Stores trainee problem performance. Columns include `contest_id`, `user_id`, `question_id`, `status` (`solved` | `attempted` | `unattempted`), `score`, `max_score`, `last_submission_at`.
- **`access_requests`**: Trainee requests to access specific contests (`pending` | `approved` | `denied`).
- **`notifications`**: User alert notifications with read/unread tracking.

### 5.2 Extended & Module Tables (`supabase/migrations/*`)
- **`roadmaps` & `user_roadmap_progress`**: Hierarchical topic roadmaps, milestones, and trainee completion tracking (`02_trainer_flow.sql`, `03_contest_roadmaps.sql`).
- **`courses` & `course_assignments`**: Multi-week curriculum with weekly syllabi.
- **`trainer_todos`**: Personal trainer task checklist (`GlobalFloatingTodo.tsx`).
- **`it_roadmap_configs`**: Working days and extension defaults for internal training (`04_internal_training.sql`).
- **`it_day_plans` & `it_day_questions`**: Daily training curriculum and associated problems.
- **`it_trainer_progress` & `it_question_completions`**: Trainee day tracking, link click timestamps, and problem completions (`location` field added in `10_it_attendance_location_and_disputes.sql`).
- **`it_attendance_disputes`**: Trainer attendance disputes when toggling OFF an IT day, with reason, check-in date, location at check-in, status (`pending`, `resolved`, `rejected`), resolver audit trail, and admin notes (`10_it_attendance_location_and_disputes.sql`).
- **`leetcode_user_stats`**: Cached LeetCode profile stats, difficulty breakdowns, contest ratings, and submission calendars (`04_leetcode_support.sql`).
- **`auto_scrape_config` & `auto_scrape_schedules`**: Auto-scrape timing, allowed days, and contest schedules (`20260824_auto_scrape_scheduler.sql`).
- **`12_fix_analytics_and_rpc_integrity.sql`**: Consolidated idempotent migration adding missing columns to `questions` (`is_enabled`, `url`, `topic`), `users` (`leetcode_id`, `it_days_count`, `last_it_check_date`, `updated_by`, `updated_at`), `contests` (`platform`), `it_trainer_progress` (`it_days_logged`, `last_check_in_date`, `location`), unique constraint on `questions(contest_id, slug)`, and high-performance composite indexes.
- **`13_fix_it_trainer_overview_rpc.sql`**: Eliminates the flawed `OR COALESCE(p.score, 0) > 0` condition from `get_it_trainer_overview()` RPC to ensure 100% strict solve parity with the in-app API fallback logic.
- **`14_fix_it_trainer_overview_date_cast.sql`**: Date cast fix for PostgreSQL operator compatibility, universal location exposure, and progress-enrolled trainer resolution in `get_it_trainer_overview()`.
- **`15_security_hardening_rls_rpc.sql`**: Comprehensive Database Row-Level Security (RLS) and RPC Stored Procedure hardening (Requirement R3):
  - `public.users`: Replaced permissive SELECT `USING (true)` and UPDATE policies with hardened policies. Standard users can only read their own profile; admins/managers can read all users. Standard users can update only contact fields with strict `WITH CHECK` preventing self-escalation of `role`, `emp_id`, `it_days_count`, or `last_it_check_date`. Admins/managers manage all user records.
  - `public.it_trainer_progress`: Blocked direct attendance forging by restricting all mutations (INSERT/UPDATE/DELETE) strictly to Admins and Managers (trainers record attendance via authenticated service-role API).
  - `public.it_question_completions` & `public.user_roadmap_progress`: Scoped SELECT to self or admin/manager and restricted direct mutations to admins/managers.
  - `public.support_tickets` & `public.it_attendance_disputes`: Enforced user ownership on INSERT (`auth.uid() = user_id`) and restricted UPDATE (status, admin_notes, resolved_by) strictly to Admins and Managers.
  - Core Tables (`questions`, `contests`, `roadmaps`, `it_day_plans`, `it_day_questions`, `it_roadmap_config`, `auto_scrape_config`, `auto_scrape_schedules`): Enforced write/delete access strictly to Admins and Managers.
  - RPC Security Hardening: All 6 `SECURITY DEFINER` stored procedures (`get_contest_analytics`, `get_roadmap_analytics`, `get_it_trainer_overview`, `get_user_performance_profile`, `get_global_leaderboard`, `get_contest_leaderboard_rpc`) explicitly configured with `SET search_path = public, pg_temp` to prevent search_path hijacking. Internal administrative RPCs (`get_it_trainer_overview`, `get_user_performance_profile`) revoke `EXECUTE` from `anon` and enforce internal caller role checks (`admin` or `manager`).
  - Storage Bucket Security: Storage policies on `api-cache` restricted to read-only for public/authenticated users and write/delete restricted to `service_role`.

---

## 6. Environment Variables Configuration

### LMS (`lms/.env.local`)
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous API key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role secret (server-only, bypasses RLS) |
| `RAILWAY_SCRAPER_URL` | Base URL of the deployed scraper service (e.g. `https://scraper.up.railway.app` or `http://localhost:3001`) |
| `RAILWAY_API_KEY` | Shared secret key sent in `x-api-key` header to authenticate scraper calls |
| `SCRAPER_INGEST_API_KEY` | Secret key for scraper to push ingest payloads to LMS |
| `RESEND_API_KEY` | Resend API key for automated transactional emails |
| `RESEND_FROM_EMAIL` | Sender email address (e.g. `noreply@faceprep.ed`) |

### Scraper Service (`scraper-service/.env`)
| Variable | Description |
|---|---|
| `PORT` | Local service port (default `3001`) |
| `API_KEY` | Shared secret for incoming `x-api-key` header |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key for direct PostgreSQL writes |
| `HACKERRANK_EMAIL_1` | HackerRank account 1 username/email |
| `HACKERRANK_PASSWORD_1` | HackerRank account 1 password |
| `HACKERRANK_EMAIL_2` | (Optional) HackerRank account 2 for credential pooling |
| `HACKERRANK_PASSWORD_2` | (Optional) HackerRank account 2 password |

---

## 7. Development & Deployment Workflows

### 7.1 Local Development

#### Running LMS:
```bash
cd lms
npm install
npm run dev
# App will run on http://localhost:3000
```

#### Running Scraper Service:
```bash
cd scraper-service
npm install
npm run dev
# Service will run on http://localhost:3001
```

### 7.2 Railway Deployment (`scraper-service`)
1. In Railway, configure root directory as `scraper-service`.
2. Ensure Dockerfile build is selected.
3. Configure all environment variables in Railway dashboard (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `API_KEY`, `HACKERRANK_EMAIL_*`, `HACKERRANK_PASSWORD_*`).
4. Set `RAILWAY_SCRAPER_URL` and `RAILWAY_API_KEY` in the LMS production environment to match the Railway deployment.

### 7.3 Vercel Deployment (`lms`)
1. In Vercel, set root directory to `lms`.
2. Framework preset: **Next.js**.
3. Supply all environment variables specified in Section 6.

---

## 8. Living Changelog & Project Updates

| Date | Author / Agent | Summary of Changes |
|---|---|---|
| 2026-09-01 | Challenger 2 (Empirical Verification) | **Empirical Platform Regression & Security Stress Testing (VERDICT: APPROVE)**: Executed automated platform regression tests (`lms/scripts/run-e2e-tests.mjs` — 102/102 tests passing across 14 suites with 0 failures), automated security invariant tests (`lms/scripts/run-security-tests.mjs` — 52/52 tests passing across 6 tiers with 0 failures), and empirical security stress harness (`lms/scripts/challenger2-security-stress.mjs` — 95/95 checks passing). Validated PRNG password entropy (1,000 iterations, 0 collisions, Chi-Square = 23.74 < 37.7), constant-time string comparison (`safeTimingCompare` fail-closed invariant for empty strings and invalid types), CSV formula injection sanitization (`sanitizeCsvCell`/`sanitizeCsvRow`), SSRF and open redirect defenses (`isSafeRedirectUrl` blocking loopback, AWS/GCP metadata `169.254.169.254`, private subnets, subdomain suffix evasion, and malicious schemes), and identifier validation. Full assessment logged in `.agents/challenger_2/handoff.md`. Files: `lms/scripts/challenger2-security-stress.mjs`, `CODEBASE.md`. |
| 2026-09-01 | Implementation Worker (Milestone 6) | **Automated Security Regression Test Harness, TypeScript Check & Documentation Sync (Requirement R6)**: (1) **Standalone Security Regression Test Harness (`lms/scripts/run-security-tests.mjs`)**: Implemented standalone, zero-dependency ESM test runner covering 52 test assertions across all 6 hardened security tiers (Tier 1: Auth & Session Security, Tier 2: API Route Authorization & BOLA/IDOR, Tier 3: Service Keys & Database RLS, Tier 4: Error Sanitization & Headers, Tier 5: Input Validation & SSRF, Tier 6: CDN Minimization & Concurrency) with 100% pass rate. (2) **NPM Scripts Integration (`package.json`)**: Added `"test:security": "node scripts/run-security-tests.mjs"` for quick developer execution. (3) **TypeScript Compilation Verification**: Verified `npx tsc --noEmit` exits cleanly with 0 compilation errors across the entire codebase. (4) **Documentation Synchronization (`CODEBASE.md` & `TEST_READY.md`)**: Fully updated Section 3 (Engineering & Security Conventions) with architecture breakdown (3.6.1 through 3.6.6) and created `TEST_READY.md` tracking test runner readiness and coverage matrices. Files: `lms/scripts/run-security-tests.mjs`, `lms/package.json`, `CODEBASE.md`, `TEST_READY.md`. |
| 2026-09-01 | Implementation Worker (Milestone 5) | **Secrets Management, CDN Snapshot Minimization & DoS Controls (Requirement R5)**: (1) **Client-Side Secrets Audit**: Verified that `SUPABASE_SERVICE_ROLE_KEY`, `RAILWAY_API_KEY`, `SCRAPER_INGEST_API_KEY`, `RESEND_API_KEY`, and `HACKERRANK_PASSWORD_*` are never imported into `'use client'` components or prefixed with `NEXT_PUBLIC_`. (2) **CDN Snapshot Data Minimization (`lms/lib/cdn-cache.ts`, `scraper-service/src/cdnPublisher.js`)**: Sanitized `leaderboard.json` and `contest_{id}.json` public CDN snapshots to only include display-safe fields (`rank`, `name`, `team`, `score`, `solved`), strictly excluding `emp_id`, emails, and internal UUIDs (`id`, `user_id`). Disabled `it_trainer_overview.json` publishing to public `api-cache` bucket. (3) **Scraper Trigger Rate Limiting & Cooldown Protection (`lms/lib/rate-limiter.ts`, `lms/app/api/scrape/trigger/route.ts`, `lms/app/api/leetcode/sync/route.ts`)**: Built in-memory cooldown utility enforcing 60s cooldown per contest and per caller on scrape triggers and LeetCode sync, returning 429 Too Many Requests on rapid spam. (4) **Atomic Concurrency Lock for Auto-Scrape Cron (`lms/app/api/scrape/auto-cron/route.ts`)**: Replaced non-atomic check with conditional atomic SQL update (`is_running = true WHERE id = ... AND (is_running = false OR is_running IS NULL)`), eliminating TOCTOU cron race conditions. (5) **Automated Test Suite Expansion (`scripts/run-e2e-tests.mjs`)**: Added Tier 1: R5 test cases (`T1.R5.01` through `T1.R5.04`). Files: `lms/lib/rate-limiter.ts`, `lms/lib/cdn-cache.ts`, `scraper-service/src/cdnPublisher.js`, `lms/app/api/scrape/trigger/route.ts`, `lms/app/api/leetcode/sync/route.ts`, `lms/app/api/scrape/auto-cron/route.ts`, `lms/app/(dashboard)/dashboard/TopPerformersWidget.tsx`, `lms/app/(dashboard)/contests/[id]/page.tsx`, `lms/app/(dashboard)/contests/[id]/TrainerDetailModal.tsx`, `lms/scripts/run-e2e-tests.mjs`, `CODEBASE.md`. |
| 2026-09-01 | Implementation Worker (Milestone 2) | **API Route Authorization, BOLA, Excessive Data Exposure & Error Sanitization across all 56 routes (Requirement R2)**: (1) **Public Validation Routes Hardening (`api/users/validate-leetcode/route.ts`, `api/users/validate-hackerrank/route.ts`)**: Added session authentication (`supabase.auth.getUser()`) returning 401 for unauthenticated calls; stripped `full_name` and `email` from duplicate handle errors in `validate-leetcode` to prevent user directory harvesting. (2) **LeetCode Contest Batch Sync Guard (`api/leetcode/sync/route.ts`)**: Enforced Admin/Manager role check on Case 2 (`contestId`), returning 403 Forbidden for standard trainers. (3) **Excessive Data Exposure Elimination (`api/support-tickets/route.ts`, `api/internal-training/attendance/dispute/route.ts`)**: Omitted confidential `admin_notes`, `resolved_by`, and `resolver` profile objects for standard trainers. (4) **Constant-Time Service Key Guards (`api/cache/refresh/route.ts`, `api/scrape/ingest/route.ts`, `api/scrape/auto-cron/route.ts`, `api/scrape/revalidate/route.ts`)**: Integrated `safeTimingCompare` from `@/lib/security` and eliminated empty-string bypasses. (5) **Scraper Microservice Fail-Closed Auth Guard (`scraper-service/server.js`)**: Added fail-closed check returning 401 when `API_KEY` is unset/empty and implemented timing-safe key comparison. (6) **Universal Database Error Sanitization across all 56 API Routes**: Systematically inspected and sanitized all 56 route handlers under `lms/app/api/**`, ensuring all raw database errors/schema names/PostgREST codes are logged server-side and replaced with generic user-facing error messages. (7) **Automated Test Suite Expansion (`scripts/run-e2e-tests.mjs`)**: Added test cases `T1.R2.01` through `T1.R2.06` covering public validation, contest sync BOLA, data exposure, constant-time keys, scraper fail-closed auth, and DB error sanitization. All 13 test suites (98/98 tests) and `npx tsc --noEmit` pass with 0 errors. Files: all 56 route handlers in `lms/app/api/**`, `scraper-service/server.js`, `lms/scripts/run-e2e-tests.mjs`, `CODEBASE.md`. |
| 2026-09-01 | Implementation Worker (Milestone 4) | **Input Validation, Injection, XSS, SSRF & HTTP Response Headers Security (Requirement R4)**: (1) **Global HTTP Security Headers (`next.config.ts`)**: Added `headers()` async configuration applying global security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy`, `X-XSS-Protection`, `Permissions-Policy`) to all application routes (`/:path*`). (2) **Edge Middleware Cache-Control & Security Headers (`lib/supabase/middleware.ts`)**: Injected `Cache-Control: no-store, no-cache, must-revalidate, private` and `X-Content-Type-Options: nosniff` on all `/api/*` and authenticated requests. (3) **SSRF & Open Redirect Protection (`lib/security.ts`, `app/api/internal-training/redirect/route.ts`, `lib/leetcode.ts`)**: Implemented `isSafeRedirectUrl()` and `isValidIdentifier()`; added mandatory auth check and hostname/private-IP validation on `GET /api/internal-training/redirect`; enforced strict alphanumeric/hyphen regex validation (`/^[a-zA-Z0-9_-]+$/`) on LeetCode handles, problem slugs, and list IDs before issuing GraphQL queries. (4) **CSV & Excel Formula Injection Defense (CWE-1236) (`ReportsHubClient.tsx`, `app/api/users/bulk/route.ts`, `lib/utils.ts`)**: Added `sanitizeExportData` in `ReportsHubClient.tsx` escaping formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) in CSV and Excel exports; added 500-user payload limit in `POST /api/users/bulk`; enhanced `sanitizeField` in `lib/utils.ts` to strip leading formula prefixes. (5) **Mass Assignment Protection (`app/api/contests/route.ts`, `app/api/questions/[id]/route.ts`)**: Implemented strict field allowlisting and platform/slug validation on contest creation and question updates. (6) **Verification**: Verified zero TypeScript errors with `npx tsc --noEmit` and all 92 platform tests passing with 0 failures in `scripts/run-e2e-tests.mjs`. Files: `lms/next.config.ts`, `lms/lib/supabase/middleware.ts`, `lms/lib/security.ts`, `lms/lib/leetcode.ts`, `lms/lib/utils.ts`, `lms/app/api/internal-training/redirect/route.ts`, `lms/app/(dashboard)/reports/ReportsHubClient.tsx`, `lms/app/api/users/bulk/route.ts`, `lms/app/api/contests/route.ts`, `lms/app/api/questions/[id]/route.ts`, `lms/scripts/test-m4-security.mjs`, `CODEBASE.md`. |
| 2026-09-01 | Implementation Worker (Milestone 1) | **Authentication, Session Management & Identity Security Hardening (Requirement R1)**: (1) **Shared Security Utility Module (`lib/security.ts`)**: Built and exported `generateSecureTempPassword()` using `crypto.randomBytes(8).toString('hex') + 'A1!'` (replacing predictable `Math.random()`), `safeTimingCompare(a, b)` using constant-time `crypto.timingSafeEqual` with buffer length validation, and `sanitizeCsvCell(val)` escaping CSV formula prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`) with single quotes to prevent CSV formula injection (CWE-1236). (2) **Password Reset Role Hierarchy Enforcement (`app/api/users/[id]/reset-password/route.ts`)**: Enforced role hierarchy checking the target user's role; prevented Managers from resetting Admin passwords (returning 403 Forbidden). Replaced `Math.random()` with `generateSecureTempPassword()` and sanitized all catch block and auth error responses. (3) **Role Escalation Protection on User Creation & Bulk Import (`app/api/users/route.ts`, `app/api/users/bulk/route.ts`)**: Enforced that only Admins can create or assign Admin accounts (rejecting Manager attempts with 403 Forbidden or skip error). Replaced `Math.random()` with `generateSecureTempPassword()` and sanitized error responses. (4) **Admin-Only Role Modification & Deletion (`app/api/users/[id]/route.ts`)**: In PATCH handler, restricted `role` field mutation exclusively to Admins (`caller.role === 'admin'`). In DELETE handler, restricted user deletion strictly to Admins (returning 403 Forbidden for Managers). Sanitized error responses. (5) **Profile Identity Write Protection (`app/api/users/me/route.ts`)**: Prevented self-role escalation and modification of `emp_id` and audit fields; sanitized error responses. (6) **Automated Test Suite Expansion (`scripts/run-e2e-tests.mjs`)**: Added test cases `T1.SEC.01` through `T1.SEC.06` verifying cryptographically secure passwords, timing-safe comparisons, CSV formula injection sanitization, password reset role hierarchy, user creation role escalation protection, and admin-only deletion/role modification. Files: `lms/lib/security.ts`, `lms/app/api/users/[id]/reset-password/route.ts`, `lms/app/api/users/route.ts`, `lms/app/api/users/bulk/route.ts`, `lms/app/api/users/[id]/route.ts`, `lms/app/api/users/me/route.ts`, `lms/scripts/run-e2e-tests.mjs`, `CODEBASE.md`. |
| 2026-09-01 | Implementation Worker (Milestone 3) | **Database Row-Level Security (RLS) & RPC Function Hardening (Requirement R3)**: (1) **`public.users` RLS Policy Hardening (`supabase/migrations/15_security_hardening_rls_rpc.sql`, `supabase/schema.sql`)**: Dropped permissive `USING (true)` SELECT and `USING (auth.uid() = id)` UPDATE policies. Implemented hardened SELECT policy (`Users can read own profile` for self, `Admins and managers can read all users` for elevated roles) and hardened UPDATE policy (`Users can update own contact info` with strict `WITH CHECK` preventing self-escalation of `role`, `emp_id`, `it_days_count`, and `last_it_check_date`). (2) **`public.it_trainer_progress` Attendance Forgery Prevention**: Replaced `FOR ALL` user policy with read-only self access (`Users read own it_trainer_progress or admin manager read all`) and restricted all mutations (INSERT/UPDATE/DELETE) strictly to Admins and Managers (`Admins and managers can manage it_trainer_progress`), forcing trainer attendance writes through authenticated service-role API endpoints. (3) **Support Tickets & IT Disputes Isolation (`public.support_tickets`, `public.it_attendance_disputes`)**: Enforced trainer row ownership on INSERT (`auth.uid() = user_id`) and restricted UPDATE permissions (`status`, `admin_notes`, `resolved_by`) strictly to Admins and Managers. (4) **Core Tables Write Protection (`questions`, `contests`, `roadmaps`, `it_day_plans`, `it_day_questions`, `it_roadmap_config`, `auto_scrape_config`, `auto_scrape_schedules`)**: Enforced strict Admin and Manager write/delete policies. (5) **RPC `SECURITY DEFINER` Search Path & Access Hardening**: Added `SET search_path = public, pg_temp` to all 6 stored procedures (`get_contest_analytics`, `get_roadmap_analytics`, `get_it_trainer_overview`, `get_user_performance_profile`, `get_global_leaderboard`, `get_contest_leaderboard_rpc`). Revoked `EXECUTE` from `anon` across all RPCs and added internal caller role checks in `get_it_trainer_overview()` (admin/manager only) and `get_user_performance_profile()` (self or admin/manager only). (6) **Supabase Storage `api-cache` Bucket Hardening**: Reconfigured bucket policies to ensure read-only access for public/authenticated snapshots and restricted write/delete access strictly to `service_role`. Files: `lms/supabase/migrations/15_security_hardening_rls_rpc.sql`, `lms/supabase/schema.sql`, `CODEBASE.md`. |
| 2026-09-01 | Reviewer 4 (Adversarial Improvement Round 4) | **TypeScript Compilation Fix & Production Build Verification (`app/api/reports/route.ts`)**: (1) **TypeScript Parameter Annotation Fix (`app/api/reports/route.ts`)**: Added explicit `string[]` and `(rmId: string)` typing to `roadmapIds` and its mapping callbacks in `handleITAttendanceReport`, resolving `TS7006: Parameter 'rmId' implicitly has an 'any' type` under strict TypeScript compilation. (2) **Zero-Error Typecheck & Turbopack Production Build**: Verified `npx tsc --noEmit` exits with 0 errors and `npm run build` generates optimized production build across all 53 application routes. (3) **Full Regression Suite Verification (`scripts/run-e2e-tests.mjs`)**: Verified all 11 test suites and 86/86 test cases pass with 0 failures. Files: `lms/app/api/reports/route.ts`, `CODEBASE.md`. |
| 2026-09-01 | Reviewer 3 (Adversarial Improvement Round 3) | **Adversarial Verification, Multi-Source Assignment Resolution, & Export Robustness**: (1) **Internal Training Multi-Source Assignment Resolution (`app/(dashboard)/internal-training/page.tsx`)**: Extended `assignedRoadmapIds` resolution to query `it_trainer_progress` for the authenticated trainer in addition to direct and group assignments, ensuring complete parity across the dashboard, stored procedures, and analytics APIs. (2) **Unified Table & Badge Location Parsing (`TrainerOverviewTable.tsx`, `ITAttendanceToggle.tsx`, `ITDayStatus.tsx`)**: Centralized safe JSON string detection and parsing across trainer cohort tables, active location stat cards, and check-in badges. (3) **Dispute Resolution Global Sync Parity (`app/api/internal-training/attendance/dispute/[id]/route.ts`)**: Synchronized `users.it_days_count` directly to the maximum of all remaining `it_trainer_progress.it_days_logged` records upon dispute approval. (4) **Export Serializer Clean Evaluation (`ReportsHubClient.tsx`)**: Hardened location string construction in CSV/Excel export formatter. (5) **Automated Test Suite Expansion (`scripts/run-e2e-tests.mjs`)**: Added test cases `T1.IT.15` (multi-source assignment resolution), `T1.IT.16` (table location parsing resilience), and `T1.IT.17` (multi-roadmap dispute global sync), bringing total test suite to 86/86 passing tests with 0 failures. Files: `lms/app/(dashboard)/internal-training/page.tsx`, `lms/app/(dashboard)/internal-training/TrainerOverviewTable.tsx`, `lms/app/(dashboard)/internal-training/ITAttendanceToggle.tsx`, `lms/app/(dashboard)/internal-training/ITDayStatus.tsx`, `lms/app/api/internal-training/attendance/dispute/[id]/route.ts`, `lms/app/(dashboard)/reports/ReportsHubClient.tsx`, `lms/scripts/run-e2e-tests.mjs`, `CODEBASE.md`. |
| 2026-09-01 | Reviewer 2 (Adversarial Improvement Round 2) | **Adversarial Hardening for Internal Training, Database RPCs, Location Shapes, & Reports Hub**: (1) **Database RPC Progress Enrollment & Check-In Coalescing (`supabase/migrations/14_fix_it_trainer_overview_date_cast.sql`, `supabase/schema.sql`)**: Enhanced `get_it_trainer_overview()` to include progress-enrolled trainers via `UNION SELECT itp.roadmap_id, itp.user_id FROM public.it_trainer_progress itp` and coalesced `tm.last_check_in_date` with `at.user_last_check_date` for both `last_it_check_date` and `is_it_counted_today`, ensuring 100% parity with in-app calculation and preventing missing check-ins when records only exist on the `users` table. (2) **Trainer Overview Fallback ISO Timestamp Date Slicing (`app/api/internal-training/trainer-overview/route.ts`)**: Fixed `isCountedToday` evaluation from strict equality to prefix slicing (`lastCheckIn.slice(0, 10) === today`), ensuring ISO timestamp strings (e.g. `'2026-09-01T10:00:00Z'`) evaluate correctly as today's check-in. (3) **Multi-Format Location Resilience (`app/api/reports/route.ts`, `app/(dashboard)/reports/ReportsHubClient.tsx`, `app/(dashboard)/internal-training/TrainerOverviewTable.tsx`, `ITAttendanceToggle.tsx`, `ITDayStatus.tsx`)**: Upgraded location parsing across reports API, CSV/Excel export serializers, table renderers, and attendance toggles to safely handle stringified JSON (`'{"type":"...","detail":"..."}'`), custom keys (`office_name`, `wfh_reason`), plain strings, nulls, and undefined without throwing or rendering blank. (4) **Attendance Dispute Check-In Timestamp Prefix Matching & Global Sync (`app/api/internal-training/attendance/dispute/[id]/route.ts`)**: Used `slice(0, 10)` prefix matching on `check_in_date` when approving disputes, cleanly clearing check-in timestamps and synchronizing `users.it_days_count` with remaining `it_trainer_progress.it_days_logged`. (5) **Test Suite Expansion (`scripts/run-e2e-tests.mjs`)**: Added test cases `T1.IT.11` (ISO timestamp prefix matching), `T1.IT.12` (JSON location resilience), `T1.IT.13` (multi-roadmap dispute resolution & global sync), and `T1.IT.14` (complete Reports Hub IT export schema parity). Files: `lms/supabase/migrations/14_fix_it_trainer_overview_date_cast.sql`, `lms/supabase/schema.sql`, `lms/app/api/internal-training/trainer-overview/route.ts`, `lms/app/api/reports/route.ts`, `lms/app/(dashboard)/reports/ReportsHubClient.tsx`, `lms/app/(dashboard)/internal-training/TrainerOverviewTable.tsx`, `lms/app/(dashboard)/internal-training/ITAttendanceToggle.tsx`, `lms/app/(dashboard)/internal-training/ITDayStatus.tsx`, `lms/app/api/internal-training/attendance/dispute/[id]/route.ts`, `lms/scripts/run-e2e-tests.mjs`, `CODEBASE.md`. |
| 2026-09-01 | Reviewer (Adversarial Improvement) | **Adversarial Review & Defect Fixes for Internal Training & Reports Hub**: (1) **Trainer Overview In-App Fallback Hardening (`app/api/internal-training/trainer-overview/route.ts`)**: Selected `it_days_count, last_it_check_date` from `users` table and updated in-app fallback resolution to fall back to `u.it_days_count` and `u.last_it_check_date`, ensuring trainers without prior `it_trainer_progress` records maintain accurate attendance count and check-in date. Included `trainerProgressList` members directly into `roadmapTrainersMap` to avoid dropping active trainees. (2) **Trainer Overview Location String & Object Compatibility (`app/(dashboard)/internal-training/TrainerOverviewTable.tsx`)**: Upgraded search filter and table location rendering to safely support both plain string and structured object locations (`{ type, detail }`), preventing `undefined` property access and search failures. (3) **Reports Hub IT Attendance Numeric Day Count & Date Bounds Fix (`app/api/reports/route.ts`)**: Used nullish coalescing (`??`) for `currentDay`, `extensionCount`, `extendedDays`, and `itDaysCount` to preserve `0` values rather than erroneously forcing `1`; made `filters.endDate` inclusive through `23:59:59.999Z` when provided as a date string; enriched location KPI counts to check both `locationType` and `locationDisplay`. (4) **ISO Date Truncation in Reports Table & Exports (`app/(dashboard)/reports/ReportsHubClient.tsx`)**: Cleanly extracted ISO date substrings for consistent table and CSV/Excel check-in date displays. (5) **SQL Safe Date Cast Resilience (`supabase/migrations/14_fix_it_trainer_overview_date_cast.sql`, `supabase/schema.sql`)**: Updated date comparison to `LEFT(tm.last_check_in_date::text, 10) = CURRENT_DATE::text` for universal compatibility across Postgres timestamp, date, and text columns. (6) **Test Suite Expansion (`scripts/run-e2e-tests.mjs`)**: Added `T1.IT.08` (in-app fallback roadmap trainer mapping), `T1.IT.09` (string vs object location parsing), and `T1.IT.10` (nullish coalescing day 0 preservation). Files: `lms/app/api/internal-training/trainer-overview/route.ts`, `lms/app/(dashboard)/internal-training/TrainerOverviewTable.tsx`, `lms/app/api/reports/route.ts`, `lms/app/(dashboard)/reports/ReportsHubClient.tsx`, `lms/supabase/migrations/14_fix_it_trainer_overview_date_cast.sql`, `lms/supabase/schema.sql`, `lms/scripts/run-e2e-tests.mjs`, `CODEBASE.md`. |
| 2026-09-01 | Implementation Specialist | **Fix Internal Training Data Correctness & Reports Hub Integration**: (1) **PostgreSQL RPC Date Cast Fix & Migration 14 (`supabase/migrations/14_fix_it_trainer_overview_date_cast.sql`, `migrations/13_fix_it_trainer_overview_rpc.sql`, `supabase/schema.sql`)**: Fixed date casting type mismatch (`operator does not exist: text = date`) in `get_it_trainer_overview()` by casting `tm.last_check_in_date::text = CURRENT_DATE::text`, preventing runtime query failures regardless of column type; exposed `tm.location` across all overview records. (2) **Reports Hub IT Attendance Integration & Resilient Fallback (`app/api/reports/route.ts`)**: Updated `handleITAttendanceReport` to include full resilient in-app fallback when RPC is unavailable or returns empty; enriched report rows with trainer name, emp ID, team, roadmap title, current day, total days, check-in date (`lastCheckInDate`), location type and detail (`locationDisplay`), questions completed, total questions, backlog status (`pendingQuestions`), and synchronized `itDaysCount`; added summary KPIs for Backlog and Location Split (Office vs WFH). (3) **Reports Hub UI & Export Parity (`app/(dashboard)/reports/ReportsHubClient.tsx`)**: Rendered Backlog count badge (`⚠️ N Qs` / `✓ Clear`), Location badge with office/WFH icon and tooltip, and Check-In Date in table columns and KPI cards; updated CSV and Excel export (`getFormattedExportData`) with complete IT tracking columns including `Check-In Date` and `Location`. (4) **Multi-Roadmap Attendance Synchronization (`lib/it-day-counter.ts`, `app/api/internal-training/attendance/route.ts`)**: Synchronized `users.it_days_count` to maintain consistency with `it_trainer_progress.it_days_logged`. (5) **Automated E2E Tests (`scripts/run-e2e-tests.mjs`)**: Added `T1.IT.05` (Reports Hub in-app fallback), `T1.IT.06` (IT Attendance export formatting with Check-In Date and Location), and `T1.IT.07` (RPC safe date casting). Files: `lms/supabase/migrations/14_fix_it_trainer_overview_date_cast.sql`, `lms/supabase/migrations/13_fix_it_trainer_overview_rpc.sql`, `lms/supabase/schema.sql`, `lms/lib/it-day-counter.ts`, `lms/app/api/reports/route.ts`, `lms/app/api/internal-training/trainer-overview/route.ts`, `lms/app/(dashboard)/reports/ReportsHubClient.tsx`, `lms/scripts/run-e2e-tests.mjs`, `CODEBASE.md`. |
| 2026-08-29 | Worker 2 (Milestone 2) | **Table & Modal List Pagination & UI Robustness (Milestone 2)**: (1) **Trainer Overview Table Pagination (`app/(dashboard)/internal-training/TrainerOverviewTable.tsx`)**: Replaced custom inline pagination with standard `<Pagination />` component featuring numeric page buttons, Prev/Next navigation, configurable page size (`pageSizeOptions={[10, 25, 50, 100]}`), and automatic `setCurrentPage(1)` reset on query/filter/pageSize changes. Hardened search predicate against `null`/`undefined` fields (`full_name`, `emp_id`, `team`, `roadmap_title`, `email`, `location.type`, `location.detail`). Guarded `getAvatarGradient`, `getInitials`, and numeric/progress sorting comparators. (2) **Admin Day Plan Question Picker Pagination (`app/(dashboard)/admin/roadmaps/[id]/edit/DayPlanTab.tsx`)**: Added modal pagination state (`pickerPage`, `pickerPageSize`), automatic reset effect on filters/domain/day, null-safe challenge search, array slicing `paginatedPickerQuestions`, and integrated `<Pagination />` to prevent DOM overflow on large question catalogs. (3) **Automated Regression Test Suites (`scripts/run-e2e-tests.mjs`)**: Added Tier 1 `R2-IT` (Pagination Engine, numeric buttons, page size selector, search reset, modal pagination) and `R3-IT` (Null-safe search, empty states, avatar safety, sorting comparators) suites. All 11 suites (73/73 tests) and TypeScript checks pass with 0 errors. Files: `lms/app/(dashboard)/internal-training/TrainerOverviewTable.tsx`, `lms/app/(dashboard)/admin/roadmaps/[id]/edit/DayPlanTab.tsx`, `lms/scripts/run-e2e-tests.mjs`, `CODEBASE.md`. |
| 2026-08-29 | Worker 1 (Milestone 1) | **Internal Training Data Audit & Persistence Integrity (Milestone 1)**: (1) **Attendance Auto-Creation (`app/api/internal-training/attendance/route.ts`)**: Fixed silent progress drop bug when manual attendance adjustment is made (`increment`, `decrement`, `set`). If `it_trainer_progress` does not exist, auto-creates it with `started_at = today, current_day = targetCount, it_days_logged = targetCount, last_check_in_date = today, extended_days = 0, extension_count = 0`, and syncs global `users.it_days_count` and `users.last_it_check_date`. (2) **Self-Healing Attendance Robustness (`lib/it-day-counter.ts`)**: In `recordITAttendance`, auto-creates missing `it_trainer_progress` record instead of throwing an unhandled exception. (3) **Strict Completion & Solve Check (`app/api/internal-training/day-plan/[roadmapId]/trainer/route.ts`)**: Queried `max_score` alongside `question_id, status, score` and enforced canonical `isRecordSolved(hr)` and portal-click gating (`hasClickedFromPortal && (isHackerRankSolved || isManuallyCompleted)`), preventing partial scores from falsely marking problems completed. (4) **SQL RPC Parity Migration (`supabase/migrations/13_fix_it_trainer_overview_rpc.sql` & `supabase/schema.sql`)**: Updated `get_it_trainer_overview()` to eliminate `OR COALESCE(p.score, 0) > 0`, achieving 100% parity with the in-app API fallback. (5) Added R1-IT regression tests in `scripts/run-e2e-tests.mjs`. Files: `lms/app/api/internal-training/attendance/route.ts`, `lms/lib/it-day-counter.ts`, `lms/app/api/internal-training/day-plan/[roadmapId]/trainer/route.ts`, `lms/supabase/migrations/13_fix_it_trainer_overview_rpc.sql`, `lms/supabase/schema.sql`, `lms/scripts/run-e2e-tests.mjs`, `CODEBASE.md`. |
| 2026-08-29 | Antigravity Agent | **Eliminate Cross-Tab State Leaks with AbortController & Tab-Keyed Payloads (`ReportsHubClient.tsx` & `api/reports/route.ts`)**: (1) Resolved in-flight race condition where slower initial `contests` API requests completed after switching to `roadmaps`, overwriting table data with contest records. Added `AbortController` request cancellation on tab/filter switch and added guard discarding mismatched `data.reportType`. (2) Isolated client state with `tabPayloads` keyed per `ReportDomain`. (3) Added `cache: 'no-store'` to client fetch and configured `Cache-Control: no-store, no-cache, must-revalidate` on all API report responses. Files: `lms/app/(dashboard)/reports/ReportsHubClient.tsx`, `lms/app/api/reports/route.ts`. |
| 2026-08-29 | Antigravity Agent | **Fix Team Benchmarks Top Performer & Scoring (`api/reports/route.ts`)**: Resolved critical calculation defect where `handleTeamsReport` queried `progress` without pagination (clipping at PostgREST 1,000-row limit across 15,114 progress rows) and summed un-deduplicated multiple attempts. Integrated high-performance `get_global_leaderboard` RPC and paginated fallback with `MAX(score)` deduplication and deterministic 3-tier tie breaking (`score DESC, solved DESC, full_name ASC`). Team DSA now correctly displays Akshaya T (3,286 pts) and Team FOP correctly displays Divya Chandrika T (1,960 pts). Files: `lms/app/api/reports/route.ts`. |
| 2026-08-29 | Antigravity Agent | **Fix Topic Roadmaps Tab in Reports Hub (`ReportsHubClient.tsx` & `api/reports/route.ts`)**: (1) Resolved state leak in `ReportsHubClient.tsx` where previous tab rows (87 contest rows) persisted and rendered under the Topic Roadmaps tab with blank titles and `/` progress upon tab switching. (2) Enhanced `handleRoadmapsReport` in `api/reports/route.ts` to include `contest_assignments` matching `rm.contest_id`, include all enrolled trainers regardless of prior progress status, and safely use optional chaining for progress timestamps. Files: `lms/app/(dashboard)/reports/ReportsHubClient.tsx`, `lms/app/api/reports/route.ts`. |
| 2026-08-29 | Antigravity Agent | **Fix Next.js Slug Conflict (`'id' !== 'userId'`)**: Resolved Next.js App Router dynamic segment collision by unifying `lms/app/api/users/[userId]/profile` into `lms/app/api/users/[id]/profile/route.ts` with backward-compatible parameter handling. Both `npm run dev` and `npm run build` now compile cleanly across all 53 routes. Files: `lms/app/api/users/[id]/profile/route.ts`. |
| 2026-08-29 | Antigravity Agent | **Fix SQL Syntax Error in Migration 12 (`12_fix_analytics_and_rpc_integrity.sql`)**: Fixed SQL syntax ordering in `get_user_performance_profile` RPC where `LEFT JOIN public.progress` was placed after the `WHERE` clause instead of before it. Verified clean execution across all RPCs. Files: `lms/supabase/migrations/12_fix_analytics_and_rpc_integrity.sql`. |
| 2026-08-29 | Orchestrator (Gen 2) & Workers | **Milestone 4: CDN & SWR Cache Synchronization (PASSED)**: (1) **Edge Cache Bypass**: Updated `getCdnStorageUrl` (`lms/lib/cdn-cache.ts`) to append dynamic cache-busting timestamp parameter `?t=${Date.now()}` and set `cacheControl: '0'` across all snapshot uploads in `cdn-cache.ts` and `scraper-service/src/cdnPublisher.js`. (2) **Contest Progress Deduplication**: Deduplicated contest progress rows per `user_id:question_id` (taking highest score, strict solve check, and latest submission timestamp) in `cdn-cache.ts` and `cdnPublisher.js` before aggregation, eliminating multi-attempt score inflation. (3) **Complete Revalidation**: Expanded `/api/scrape/revalidate`, `/api/cache/refresh`, and `/api/scrape/ingest` to invalidate all dependent paths (`/dashboard`, `/contests`, `/roadmaps`, `/reports`, `/internal-training`) and Next.js tags (`leaderboard`, `global-stats`, `contests`, `roadmaps`, `roadmap-analytics`, `internal-training`, `it-overview`). (4) **Question Toggle Invalidation**: Updated `PATCH /api/questions/[id]` to regenerate CDN snapshots and bust Next.js tags immediately upon updating `is_enabled`. (5) **SWR Lifecycle & Polling**: Exported `mutateAllTrainerData()` from `lms/lib/swr-hooks.ts`, optimized deduping intervals to 1 min / 30s, and added background job polling in `roadmaps/page.tsx`. Files: `lms/lib/cdn-cache.ts`, `scraper-service/src/cdnPublisher.js`, `lms/app/api/scrape/revalidate/route.ts`, `lms/app/api/cache/refresh/route.ts`, `lms/app/api/scrape/ingest/route.ts`, `lms/app/api/questions/[id]/route.ts`, `lms/lib/swr-hooks.ts`, `lms/app/(dashboard)/roadmaps/page.tsx`. |
| 2026-08-29 | Orchestrator (Gen 2) & Workers | **Milestone 3: Roadmaps, IT Attendance & Reports Hub (PASSED)**: (1) **Roadmap Completion Calculation**: Refactored `api/trainer/roadmaps/route.ts` and `reports/page.tsx` to distinguish solved questions from mastered topics, computing completion strictly from unique question IDs and eliminating duplicated/bloated array IDs. (2) **IT Attendance Synchronization**: Updated `api/internal-training/attendance/route.ts` to recalculate global `users.it_days_count` as maximum `it_days_logged` across all assigned roadmaps upon adjustments, preventing cross-roadmap attendance drift. (3) **Reports Hub Date Filters**: Fixed inverted null check `!r.lastSubmissionAt` in `api/reports/route.ts` to strictly enforce date boundaries and exclude inactive trainers from bounded date queries. (4) **Custom Date Boundary Truncation**: Truncated custom end dates to end-of-day `23:59:59.999Z` in `ReportsHubClient.tsx`. (5) **Dense Ranking & Percentiles**: Implemented standard dense ranking for tied participants and assigned 0th percentile to 0-score users in `api/reports/route.ts`. (6) **Reports Export Formatting**: Split min/median/max score distributions into separate numeric columns in `ReportsHubClient.tsx` and included `'Unassigned'` cohort in `meta.availableTeams`. Files: `lms/app/api/trainer/roadmaps/route.ts`, `lms/app/(dashboard)/reports/page.tsx`, `lms/app/api/internal-training/attendance/route.ts`, `lms/app/api/reports/route.ts`, `lms/app/(dashboard)/reports/ReportsHubClient.tsx`. |
| 2026-08-29 | Orchestrator (Gen 2) & Workers | **Milestone 2: Contest Analytics, Leaderboard & Dashboard (PASSED)**: (1) **Deterministic 3-Tier Tie-Breaking**: Standardized `(b.score - a.score) || (b.solved - a.solved) || (a.name || '').localeCompare(b.name || '')` uniformly across CDN snapshots (`cdn-cache.ts`, `cdnPublisher.js`), Contest Detail page (`contests/[id]/page.tsx`), Leaderboard table (`LeaderboardTable.tsx`), and Dashboard (`dashboard/page.tsx`). (2) **Metric Clamping & Zero Cohort Guarding**: Clamped all completion percentages strictly within `[0, 100]%` and guarded 0-cohort denominators across `TrainerCompletionAnalytics.tsx`, `TrainerTopicAnalytics.tsx`, `TopicRoadmapsWidget.tsx`, `LeetCodeProgressWidget.tsx`, `AssignedCoursesWidget.tsx`, `contest-analytics.ts`, and `roadmap-analytics.ts`. (3) **IST Activity Heatmap & Deduplication**: Deduplicated distinct question MAX scores and formatted activity calendar dates using `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })` in `user-performance-profile.ts` and `UserProfileClient.tsx`. Files: `lms/lib/cdn-cache.ts`, `scraper-service/src/cdnPublisher.js`, `lms/app/(dashboard)/contests/[id]/page.tsx`, `lms/app/(dashboard)/contests/[id]/LeaderboardTable.tsx`, `lms/app/(dashboard)/dashboard/page.tsx`, `TrainerCompletionAnalytics.tsx`, `TrainerTopicAnalytics.tsx`, `TopicRoadmapsWidget.tsx`, `LeetCodeProgressWidget.tsx`, `AssignedCoursesWidget.tsx`, `contest-analytics.ts`, `roadmap-analytics.ts`, `user-performance-profile.ts`, `UserProfileClient.tsx`. |
| 2026-08-29 | Challenger M1-1 | **Adversarial Stress Testing & Empirical Verification (Milestone 1 - APPROVED)**: Authored and executed dedicated stress test harnesses (`lms/scripts/adversarial-m1-stress.mjs`, `lms/scripts/adversarial-m1-extended.mjs`). Empirically verified canonical `isRecordSolved()` across 33 extreme input variations (partial scores, zero max score, negative scores, null/undefined, NaN, Infinity, floating-point precision). Verified SQL RPC logic models (`get_contest_analytics`, `get_user_performance_profile`, `get_roadmap_analytics`, `get_it_trainer_overview`, `get_global_leaderboard`, `get_contest_leaderboard_rpc`) against Cartesian joins, multi-attempt score deduplication (10,000 progress records), portal-click gating, today check-in location security, empty cohorts, and 3-tier tie-breaking. All 84 adversarial invariant checks passed with zero defects. |
| 2026-08-29 | Worker M1 | **Database Schema, RPC Integrity & TypeScript Solve Standardization (Milestone 1)**: (1) **Database DDL Baseline (`lms/supabase/schema.sql`)**: Updated baseline schema to include all missing columns across `questions` (`is_enabled`, `url`, `topic`), `users` (`leetcode_id`, `it_days_count`, `last_it_check_date`, `updated_by`, `updated_at`), `contests` (`platform`), and `unique(contest_id, slug)` constraint and composite indexes. (2) **Unified SQL Migration (`lms/supabase/migrations/12_fix_analytics_and_rpc_integrity.sql`)**: Created idempotent migration containing the canonical definitions of all 6 stored procedures (`get_contest_analytics`, `get_roadmap_analytics`, `get_it_trainer_overview`, `get_user_performance_profile`, `get_global_leaderboard`, `get_contest_leaderboard_rpc`), eliminating Cartesian joins with relational UNIONs, strictly enforcing full-score solve conditions (`status = 'solved' AND (CASE WHEN max_score > 0 THEN score >= max_score ELSE score > 0 END)`), deduplicating multi-attempt question scores, enforcing portal-click gating (`clicked_at IS NOT NULL`), and establishing 3-tier tie breaking (`score DESC, solved DESC, name ASC`). (3) **Canonical Solve Checker (`lms/lib/utils.ts`)**: Implemented canonical `isRecordSolved()` satisfying Interface Contract 1. (4) **Full TypeScript/JavaScript Standardization**: Replaced divergent inline solve checks across 10 target files (`contest-analytics.ts`, `cdn-cache.ts`, `roadmap-analytics.ts`, `user-performance-profile.ts`, `api/reports/route.ts`, `api/trainer/roadmaps/route.ts`, `api/trainer/skills/route.ts`, `api/internal-training/trainer-overview/route.ts`, `dashboard/page.tsx`, and `scraper-service/src/cdnPublisher.js`). (5) Verified `tsc --noEmit` and `npm test` passing with 0 errors across 58/58 test cases. |
| 2026-08-29 | E2E Test Writer Agent | **Complete Automated E2E Test Suite Implementation (R1-R5)**: Built and published the comprehensive automated requirement-driven end-to-end test suite in `lms/scripts/run-e2e-tests.mjs`, created `TEST_INFRA.md` (test architecture, runner specifications, requirement coverage matrix), created `TEST_READY.md` (readiness declaration, execution metrics, 58/58 passing tests), and added `npm test` script in `lms/package.json`. Tests cover Tier 1 Feature Coverage (R1-R5), Tier 2 Boundary & Corner Cases, Tier 3 Cross-Feature Integration Pipelines, and Tier 4 Real-World Application Workflows with 100% pass rate. Files: `TEST_INFRA.md`, `TEST_READY.md`, `lms/scripts/run-e2e-tests.mjs`, `lms/package.json`, `CODEBASE.md`. |
| 2026-08-29 | Antigravity Agent | **Fix `/users` 404 Route (`app/(dashboard)/users/page.tsx`)**: Created root `/users` server page handler. When accessed directly, automatically redirects Admins and Managers to `/admin/users` (User Management Table) and Trainers to their own performance profile at `/users/[id]`, preventing 404 Not Found errors on root `/users` navigation. Files: `lms/app/(dashboard)/users/page.tsx`. |
| 2026-08-29 | Antigravity Agent | **User Performance Profile Page (`/users/[userId]`) & In-Code Resilient Fallback**: Built a dedicated developer-card-style performance profile for each user. Files: `lms/lib/user-performance-profile.ts`, `lms/supabase/migrations/11_user_performance_profile_rpc.sql`, `lms/app/api/users/[userId]/profile/route.ts`, `lms/app/(dashboard)/users/[userId]/page.tsx`, `lms/app/(dashboard)/users/[userId]/UserProfileClient.tsx`. |
| 2026-08-29 | Antigravity Agent | **Fix Cut Down Lengthy Notes in Floating Todo Widget (`GlobalFloatingTodo.tsx`)**: Resolved issue where lengthy notes were cut off with single-line ellipsis. Files: `lms/components/GlobalFloatingTodo.tsx`. |
| 2026-08-29 | Antigravity Agent | **Comprehensive UI Overhaul & UX Refresh**: Global design tokens, scrollbar normalization, pagination controller, collapsible sections. Files: `app/globals.css`, `app/(dashboard)/dashboard/page.tsx`, `components/Pagination.tsx`, `components/CollapsibleSection.tsx`. |
| 2026-08-29 | Antigravity Agent | **Dashboard LeetCode Progress Widget & Interactive User Detail Analytics Modal**: Fixed column mapping and built user detail analytics modal. Files: `lms/app/(dashboard)/dashboard/LeetCodeProgressWidget.tsx`, `lms/app/(dashboard)/dashboard/page.tsx`. |
| 2026-08-29 | Antigravity Agent | **IT Attendance Toggle, Multi-Location Check-In & Dispute Ticket Workflow**: Location check-ins, dispute tickets, helpdesk dispute management. Files: `lms/app/(dashboard)/internal-training/ITAttendanceToggle.tsx`, `lms/app/(dashboard)/internal-training/ITCheckInModal.tsx`, `lms/app/(dashboard)/internal-training/ITDisputeModal.tsx`, `lms/app/(dashboard)/admin/helpdesk/page.tsx`, `lms/lib/it-day-counter.ts`. |
| 2026-08-29 | Antigravity Agent | **Critical Data Visibility Bug Fixes (3 Critical + 1 Related)**: Fixed updater join, session cookie loss in middleware, prevented progress deletion on contest update. Files: `lms/lib/supabase/middleware.ts`, `lms/app/(dashboard)/admin/users/page.tsx`, `lms/app/api/contests/[id]/route.ts`. |
| 2026-08-28 | Antigravity Agent | **Admin Direct Profile Editing with Audit Trace & Trainer Support Ticket Workflow**. Files: `lms/app/(dashboard)/profile/ProfileDetailsView.tsx`, `lms/app/(dashboard)/profile/AdminDirectEditModal.tsx`, `lms/app/api/support-tickets/[id]/route.ts`. |
| 2026-08-27 | Antigravity Agent | Created comprehensive `CODEBASE.md` system documentation and established workspace auto-sync agent rules (`AGENTS.md`, `GEMINI.md`, `.agent/rules/`). |
