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
├── .agent/
│   └── rules/
│       └── maintain-codebase-doc.md  # Continuous documentation sync rule
│
├── lms/                        # Main LMS Application (Next.js 16 App Router)
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
- **Overview Table for Managers (`/api/internal-training/trainer-overview`)**:
  - Summarizes each trainee's current day, total days, completed questions, pending questions, attendance count (`it_days_count`), location, and online status.

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
- Admins can create and edit roadmaps; trainees can mark topics complete and track overall progress.

#### E. Skills & LeetCode Integration (`/skills` & `/api/leetcode/*`)
- Allows users to link their LeetCode username or profile URL (`parseLeetcodeUsername`).
- `/api/leetcode/sync`: Queries LeetCode's public GraphQL API (`https://leetcode.com/graphql`) to fetch:
  - Total solved count, broken down by difficulty (Easy, Medium, Hard).
  - Global ranking and contest rating.
  - Submission calendar heatmap.
  - Stores data in `leetcode_user_stats`.
- `/api/leetcode/problem-lookup`: Validates individual LeetCode problems and fetches metadata (difficulty, acceptance rate, tags).

#### F. Reports & Analytics (`/reports`)
- Comprehensive export module for managers and admins.
- Exports contest performance, participant rankings, submission status, and attendance data into formatted Excel (`.xlsx`) or CSV (`.csv`) files using `xlsx` and `papaparse`.

#### G. Notification & Announcements System (`/notifications`)
- Realtime bell indicator (`NotificationBell.tsx`) displaying unread notifications.
- Supports types: `access_request`, `contest_assigned`, `access_approved`, `access_denied`, `system`, and `announcement`.
- Admin broadcast feature to send announcements to all users or specific groups.

### 3.4 Smart CDN Caching System (`lib/cdn-cache.ts`)
To maintain high responsiveness under heavy traffic, the LMS avoids running expensive aggregation queries on every dashboard load:
- Pre-aggregated JSON files (`leaderboard.json` and `contest-{contestId}.json`) are uploaded directly to the Supabase Storage bucket `api-cache`.
- Frontend reads from the public CDN URL using Next.js `fetch` with `revalidate: 60` (stale-while-revalidate).
- **Self-Healing Fallback**: If a CDN file returns 404, `getCachedGlobalLeaderboard()` triggers a background generation (`generateAndUploadCdnSnapshots()`) using stored RPC functions.
- `/api/cache/refresh`: Admin endpoint to force snapshot generation on demand.

### 3.5 Automated Scraper Scheduler (`app/api/scrape/auto-cron/*`)
- Triggered on a recurring schedule (every 30 minutes) via Supabase `pg_cron` or external scheduler.
- **Enforcement Rules**:
  - Restricts execution to working hours: **10:00 to 18:00 IST**.
  - Checks allowed weekdays configured in `auto_scrape_config` (e.g., Monday through Friday).
  - Sequentially triggers contests with a 5-second buffer to prevent CPU/network spikes.
  - Includes concurrent lock guards (`is_running`) to prevent overlapping scraper jobs.

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

### 5.3 Stored Procedures & Database Functions (RPCs)
- **`get_global_leaderboard()`**: Aggregates top performers across all contests for the dashboard.
- **`get_contest_analytics(contest_uuid)`**: Returns score distributions, problem completion percentages, and student averages.
- **`get_contest_leaderboard_rpc(contest_uuid)`**: Fast indexed retrieval of contest leaderboards.

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
| 2026-08-29 | Antigravity Agent | **User Performance Profile Page (`/users/[userId]`) & In-Code Resilient Fallback**: Built a dedicated developer-card-style performance profile for each user. (1) **Resilient Fetcher & Fallback (`lib/user-performance-profile.ts`)**: Built `getUserPerformanceProfile(targetUserId)` which attempts the fast Postgres RPC first and automatically falls back to direct queries across `users`, `leetcode_user_stats`, `progress`, `contests`, `questions`, `contest_assignments`, and `group_members` if the RPC is unapplied or encounters schema errors, ensuring 100% reliable data loading. (2) **Supabase RPC `get_user_performance_profile()`** (`supabase/migrations/11_user_performance_profile_rpc.sql`): Corrected table relationships (`contest_assignments` team/group join without non-existent `user_id` column, removed `is_enabled` filter). (3) **API Route `GET /api/users/[userId]/profile`** with role-based access — trainers can only fetch their own profile, admins/managers can fetch any user. (4) **New page `app/(dashboard)/users/[userId]/page.tsx`** (server component) + **`UserProfileClient.tsx`** (client): Hero card with avatar, name, platform handle links, admin edit button; 4-stat summary grid (Problems Solved, Total Score, Contests Joined, LC Rating); batch-bounded GitHub-style activity heatmap; LeetCode stats with stacked difficulty bar; expandable per-contest problem table (status badge, score, last submission, problem link). (5) **`/profile` now redirects** to `/users/[id]` instead of rendering the old static profile page. (6) **Navigation entry points** added: Admin Users table (name is now a link), TrainerDetailModal header ("View Full Profile →" button), TopPerformersWidget cards and modal rows (clickable → profile), LeetCodeProgressWidget user modal ("View Full Profile →" button). Files: `lms/lib/user-performance-profile.ts`, `lms/supabase/migrations/11_user_performance_profile_rpc.sql`, `lms/app/api/users/[userId]/profile/route.ts`, `lms/app/(dashboard)/users/[userId]/page.tsx`, `lms/app/(dashboard)/users/[userId]/UserProfileClient.tsx`, `lms/app/(dashboard)/users/[userId]/page.css`, `lms/app/(dashboard)/profile/page.tsx`, `lms/app/(dashboard)/admin/users/UserTable.tsx`, `lms/app/(dashboard)/contests/[id]/TrainerDetailModal.tsx`, `lms/app/(dashboard)/dashboard/TopPerformersWidget.tsx`, `lms/app/(dashboard)/dashboard/LeetCodeProgressWidget.tsx`. |
| 2026-08-29 | Antigravity Agent | **Fix Cut Down Lengthy Notes in Floating Todo Widget (`GlobalFloatingTodo.tsx`)**: Resolved issue where lengthy notes were cut off and truncated with single-line ellipsis (`whiteSpace: 'nowrap'` and `textOverflow: 'ellipsis'`). (1) Replaced single-line nowrap truncation with responsive multiline wrapping (`wordBreak: 'break-word'`, `overflowWrap: 'anywhere'`, `whiteSpace: 'pre-wrap'`, `lineHeight: 1.45`), rendering entire lengthy notes cleanly without cutting off text. (2) Aligned checklist checkboxes and action buttons to `align-items: flex-start` with pinned dimensions so multiline content wraps cleanly without squishing controls. (3) Added full note tooltip (`title={displayText}`) and secondary description rendering if present. (4) Upgraded single-line input to an auto-wrapping `textarea` supporting Shift+Enter for newlines and Enter to submit. (5) Expanded floating card dimensions to `min(420px, calc(100vw - 32px))` and `min(580px, calc(100vh - 120px))` for responsive viewport adaptation. Files: `lms/components/GlobalFloatingTodo.tsx`. |
| 2026-08-29 | Antigravity Agent | **Comprehensive UI Overhaul & UX Refresh**: (1) **Global Design Tokens & Spacing Scale (`globals.css`)**: Established 4px-based spacing scale (`--space-1` through `--space-12`), cross-browser thin scrollbar styling (`::-webkit-scrollbar` + `scrollbar-width`), global focus accessibility rings (`:focus-visible`), modern gradient surface tokens (`--gradient-card`, `--gradient-surface`, `--gradient-subtle`), and semantic status badge classes (`.status-solved`, `.status-attempted`, `.status-unattempted`, `.status-pending`). (2) **Scrollbar & Overflow Normalization**: Removed custom conflicting WebKit/Firefox scrollbar declarations across `internal-training/page.css`, `courses/page.css`, `admin/roadmaps/new/page.css`, and `reports/reports.css`, added `scrollbar-gutter: stable` to `Sidebar.css`, and wrapped all wide tables in `.table-scroll-container` to prevent horizontal blowouts on mobile and small viewports. (3) **Universal Paginated Tables & Data Reduction**: Created reusable `<Pagination />` controller (`Pagination.tsx`, `Pagination.css`) with page navigation, ellipsis windowing, results count, and items-per-page selector; integrated into Contest Leaderboard (`LeaderboardTable.tsx`) at 10 items/page default. (4) **Padding Consistency & Card Normalization**: Normalized table `th`/`td` padding to `var(--space-3) var(--space-4)`, eliminated double-padding in `contests/[id]/edit/edit.css`, `internal-training/page.css`, and `not-found.css`, and transitioned all cards and panels globally across `contests`, `groups`, `courses`, `roadmaps`, `skills`, `admin/helpdesk`, `admin/users`, and `profile` to sleek `var(--gradient-card)` surfaces. (5) **Collapsible Dashboard Modules**: Created reusable `<CollapsibleSection />` component (`CollapsibleSection.tsx`, `CollapsibleSection.css`) with animated chevrons, smooth transitions, and persistent `localStorage` memory, grouping Dashboard stats, contests, and learning modules into expandable sections. (6) **Visual Polish & Collision Fixes**: Fixed hardcoded hex colors in `Toast.css` and `admin/helpdesk/page.css`, corrected camelCase CSS syntax bug (`fontSize` -> `font-size`) in helpdesk, enhanced `roadmaps` text contrast against accent buttons, shifted `GlobalFloatingTodo` to `bottom: 88px` to eliminate overlap collisions, modernized `ITAttendanceModal` with soft blur and non-colliding toast, and deleted duplicate `profile/profile.css`. Files: `app/globals.css`, `app/(dashboard)/dashboard/page.tsx`, `app/(dashboard)/dashboard/page.css`, `app/(dashboard)/contests/[id]/LeaderboardTable.tsx`, `components/Pagination.tsx`, `components/Pagination.css`, `components/CollapsibleSection.tsx`, `components/CollapsibleSection.css`, `components/GlobalFloatingTodo.tsx`, `components/ITAttendanceModal.tsx`, `components/Sidebar.css`, `components/Toast.css`, and 11 page stylesheet modules. |
| 2026-08-29 | Antigravity Agent | **Dashboard LeetCode Progress Widget & Interactive User Detail Analytics Modal**: (1) Fixed column mapping in `dashboard/page.tsx` (`solved_easy`, `solved_medium`, `solved_hard`, `solved_total`, `contest_rating`, `submission_calendar`). (2) Created an interactive LeetCode user detail modal in `LeetCodeProgressWidget.tsx` accessible by clicking any participant card or table row on the dashboard or inside the cohort view. (3) Displays full user metadata (Avatar, Name, Emp ID, Team, `@leetcode_id`), 4 key metric cards (Total LC Solved, Contest Track Solves, Global Ranking, Contest Rating), Difficulty Distribution breakdown (Easy / Medium / Hard problem counts & stacked visual ratio bar), Submission Calendar activity metrics (active days logged & total submissions), and instant "⟳ Re-sync Stats" action button. Files: `lms/app/(dashboard)/dashboard/LeetCodeProgressWidget.tsx`, `lms/app/(dashboard)/dashboard/page.tsx`. |
| 2026-08-29 | Antigravity Agent | **IT Attendance Toggle, Multi-Location Check-In & Dispute Ticket Workflow**: (1) **Interactive IT Attendance Toggle (`ITAttendanceToggle.tsx`)**: Replaced the static check-in button with a dynamic state toggle on `/internal-training`. (2) **Multi-Location Selection (`ITCheckInModal.tsx`)**: Toggling ON requires selecting a location from predefined options (`Coimbatore-office`, `Chennai-office`, `Vijayawada-office`, `Hyderabad-office`, `Work from Home`, `Outstation`) with dynamic detail capture, persisted to `it_trainer_progress.location` via `10_it_attendance_location_and_disputes.sql`. (3) **Attendance Dispute Modal & Tickets (`ITDisputeModal.tsx`, `api/internal-training/attendance/dispute`)**: Toggling OFF triggers a dispute modal requiring a reason, creates a support ticket with `status: 'pending'`, retains IT count while under review, and sends notifications to Admins/Managers. (4) **Helpdesk Resolution Tab (`/admin/helpdesk`)**: Added dedicated "IT Attendance Disputes" tab with metrics, search/filtering, and Admin Approve (which safely decrements `it_days_logged` and updates global IT counts) and Decline actions with audit notes. (5) **Resilient Fallback**: Embedded schema cache error fallbacks across `lib/it-day-counter.ts`, `api/internal-training/day-plan/[roadmapId]/trainer`, and `api/internal-training/attendance/dispute`. Files: `lms/app/(dashboard)/internal-training/ITAttendanceToggle.tsx`, `lms/app/(dashboard)/internal-training/ITCheckInModal.tsx`, `lms/app/(dashboard)/internal-training/ITDisputeModal.tsx`, `lms/app/(dashboard)/internal-training/ITDayStatus.tsx`, `lms/app/(dashboard)/internal-training/InternalTrainingClient.tsx`, `lms/app/(dashboard)/internal-training/TodaysPlanCard.tsx`, `lms/app/(dashboard)/internal-training/TrainerOverviewTable.tsx`, `lms/app/(dashboard)/admin/helpdesk/page.tsx`, `lms/app/api/internal-training/attendance/dispute/route.ts`, `lms/app/api/internal-training/attendance/dispute/[id]/route.ts`, `lms/app/api/internal-training/day-plan/[roadmapId]/trainer/route.ts`, `lms/app/api/internal-training/trainer-overview/route.ts`, `lms/lib/it-day-counter.ts`, `lms/lib/types.ts`, `lms/supabase/migrations/10_it_attendance_location_and_disputes.sql`. |
| 2026-08-29 | Antigravity Agent | **Critical Data Visibility Bug Fixes (3 Critical + 1 Related)**: (1) **Bug #1 — Empty Users Table**: Fixed broken `updater:users!updated_by` self-referencing join. (2) **Bug #2 — Session Cookie Loss**: Fixed critical bug in `lib/supabase/middleware.ts`. (3) **Bug #5 — Permanent Data Loss Prevention**: Removed destructive `DELETE` of progress rows in `PATCH /api/contests/[id]`. (4) **Bug #8 — Dashboard Layout Error Logging**. Files: `lms/lib/supabase/middleware.ts`, `lms/app/(dashboard)/admin/users/page.tsx`, `lms/app/(dashboard)/profile/page.tsx`, `lms/app/api/users/me/route.ts`, `lms/app/api/contests/[id]/route.ts`, `lms/app/(dashboard)/layout.tsx`. |
| 2026-08-29 | Antigravity Agent | **High-Priority Data Visibility Bug Fixes (4 Bugs)**: (1) **Bug #3 — Team Names with Spaces**. (2) **Bug #4 — Dashboard Leaderboard Silent Failure**. (3) **Bug #6 — Empty Leaderboard Without Assignments**. (4) **Bug #10 — Corrupted CDN Snapshots**. Files: `lms/app/(dashboard)/contests/page.tsx`, `lms/app/api/contests/route.ts`, `lms/app/(dashboard)/dashboard/page.tsx`, `lms/app/(dashboard)/contests/[id]/page.tsx`, `lms/lib/cdn-cache.ts`. |
| 2026-08-29 | Antigravity Agent | **Medium & Low Priority Data Visibility Fixes (3 Bugs)**: (1) **Bug #7 — Reports Missing Unassigned Users**. (2) **Bug #9 — IT Trainer Overview Auth Error Logging**. (3) **Bug #11 — Roadmap Scrape False Success**. Files: `lms/app/api/reports/route.ts`, `lms/app/api/internal-training/trainer-overview/route.ts`, `lms/app/(dashboard)/roadmaps/page.tsx`. |
| 2026-08-29 | Antigravity Agent | **Fix User Update Schema Cache Error (`updated_at` / `updated_by` Fallback)**. Files: `lms/app/api/users/[id]/route.ts`, `lms/app/api/users/me/route.ts`, `lms/app/api/support-tickets/[id]/route.ts`. |
| 2026-08-29 | Antigravity Agent | **Fix LeetCode Contest Progress Scraping & Leaderboard Synchronization**. Files: `lms/app/api/scrape/trigger/route.ts`, `lms/app/api/leetcode/sync/route.ts`, `lms/lib/leetcode-sync.ts`. |
| 2026-08-28 | Antigravity Agent | **Admin Direct Profile Editing with Audit Trace & Trainer Support Ticket Workflow**. Files: `lms/app/(dashboard)/profile/ProfileDetailsView.tsx`, `lms/app/(dashboard)/profile/AdminDirectEditModal.tsx`, `lms/app/(dashboard)/profile/page.tsx`, `lms/app/api/users/me/route.ts`, `lms/app/api/users/[id]/route.ts`, `lms/app/api/support-tickets/[id]/route.ts`, `lms/lib/types.ts`, `lms/supabase/migrations/09_profile_change_tickets_and_unique_leetcode.sql`. |
| 2026-08-28 | Antigravity Agent | **LeetCode Profile Validation Fix, Unique Handle Enforcement & Support Ticket Profile Change Workflow**. Files: multiple api and profile routes. |
| 2026-08-28 | Antigravity Agent | **Fix Trainer Profile Updating Across LMS & Admin User Management**. Files: `lms/lib/utils.ts`, multiple api/users and profile routes. |
| 2026-08-28 | Antigravity Agent | **Fix CDN Storage Stale Cache, Next.js Fetch Caching & Scraper Revalidation**. Files: `lms/lib/cdn-cache.ts`, `scraper-service/src/progressScraper.js`, multiple scrape routes. |
| 2026-08-28 | Antigravity Agent | **Fix Scrape Data Accuracy — Slug Normalization, Coverage Check, Smart Skip**. Files: `scraper-service/src/hackerrank.js`, `scraper-service/src/progressScraper.js`. |
| 2026-08-28 | Antigravity Agent | **Fix Scraper ReferenceError & React #418 Hydration Mismatch**. Files: `scraper-service/src/hackerrank.js`, `lms/app/(dashboard)/contests/[id]/page.tsx`, `LeaderboardTable.tsx`. |
| 2026-08-27 | Antigravity Agent | **Strict Contest Participant Assignment Enforcement & CDN Cache Sanitize**. |
| 2026-08-27 | Antigravity Agent | **Create Group & Assign Trainers in Contest Creation**. |
| 2026-08-27 | Antigravity Agent | **Attempted vs Solved Question Counting & Contest Widget Fixes**. |
| 2026-08-27 | Antigravity Agent | **Full Platform Separation & LeetCode Contest Support**. |
| 2026-08-27 | Antigravity Agent | Created comprehensive `CODEBASE.md` system documentation and established workspace auto-sync agent rules (`AGENTS.md`, `GEMINI.md`, `.agent/rules/`). |



| 2026-08-29 | Antigravity Agent | **Dashboard LeetCode Progress Widget & Interactive User Detail Analytics Modal**: (1) Fixed column mapping in `dashboard/page.tsx` (`solved_easy`, `solved_medium`, `solved_hard`, `solved_total`, `contest_rating`, `submission_calendar`). (2) Created an interactive LeetCode user detail modal in `LeetCodeProgressWidget.tsx` accessible by clicking any participant card or table row on the dashboard or inside the cohort view. (3) Displays full user metadata (Avatar, Name, Emp ID, Team, `@leetcode_id`), 4 key metric cards (Total LC Solved, Contest Track Solves, Global Ranking, Contest Rating), Difficulty Distribution breakdown (Easy / Medium / Hard problem counts & stacked visual ratio bar), Submission Calendar activity metrics (active days logged & total submissions), and instant "⟳ Re-sync Stats" action button. Files: `lms/app/(dashboard)/dashboard/LeetCodeProgressWidget.tsx`, `lms/app/(dashboard)/dashboard/page.tsx`. |
| 2026-08-29 | Antigravity Agent | **IT Attendance Toggle, Multi-Location Check-In & Dispute Ticket Workflow**: (1) **Interactive IT Attendance Toggle (`ITAttendanceToggle.tsx`)**: Replaced the static check-in button with a dynamic state toggle on `/internal-training`. (2) **Multi-Location Selection (`ITCheckInModal.tsx`)**: Toggling ON requires selecting a location from predefined options (`Coimbatore-office`, `Chennai-office`, `Vijayawada-office`, `Hyderabad-office`, `Work from Home`, `Outstation`) with dynamic detail capture, persisted to `it_trainer_progress.location` via `10_it_attendance_location_and_disputes.sql`. (3) **Attendance Dispute Modal & Tickets (`ITDisputeModal.tsx`, `api/internal-training/attendance/dispute`)**: Toggling OFF triggers a dispute modal requiring a reason, creates a support ticket with `status: 'pending'`, retains IT count while under review, and sends notifications to Admins/Managers. (4) **Helpdesk Resolution Tab (`/admin/helpdesk`)**: Added dedicated "IT Attendance Disputes" tab with metrics, search/filtering, and Admin Approve (which safely decrements `it_days_logged` and updates global IT counts) and Decline actions with audit notes. (5) **Resilient Fallback**: Embedded schema cache error fallbacks across `lib/it-day-counter.ts`, `api/internal-training/day-plan/[roadmapId]/trainer`, and `api/internal-training/attendance/dispute`. Files: `lms/app/(dashboard)/internal-training/ITAttendanceToggle.tsx`, `lms/app/(dashboard)/internal-training/ITCheckInModal.tsx`, `lms/app/(dashboard)/internal-training/ITDisputeModal.tsx`, `lms/app/(dashboard)/internal-training/ITDayStatus.tsx`, `lms/app/(dashboard)/internal-training/InternalTrainingClient.tsx`, `lms/app/(dashboard)/internal-training/TodaysPlanCard.tsx`, `lms/app/(dashboard)/internal-training/TrainerOverviewTable.tsx`, `lms/app/(dashboard)/admin/helpdesk/page.tsx`, `lms/app/api/internal-training/attendance/dispute/route.ts`, `lms/app/api/internal-training/attendance/dispute/[id]/route.ts`, `lms/app/api/internal-training/day-plan/[roadmapId]/trainer/route.ts`, `lms/app/api/internal-training/trainer-overview/route.ts`, `lms/lib/it-day-counter.ts`, `lms/lib/types.ts`, `lms/supabase/migrations/10_it_attendance_location_and_disputes.sql`. |
| 2026-08-29 | Antigravity Agent | **Critical Data Visibility Bug Fixes (3 Critical + 1 Related)**: (1) **Bug #1 — Empty Users Table**: Fixed broken `updater:users!updated_by` self-referencing join that silently returned empty arrays on 4 routes (`admin/users/page.tsx`, `profile/page.tsx`, `api/users/me` GET and PATCH). All 4 now try the join first and fall back to plain `select('*')` if the migration hasn't been applied, ensuring user data always loads. (2) **Bug #2 — Session Cookie Loss**: Fixed critical bug in `lib/supabase/middleware.ts` where `setAll` callback recreated `NextResponse.next()` inside the `forEach` loop, discarding all previously set cookies. Only the last cookie survived, causing random session drops and auth failures. Now creates the response once before the loop. (3) **Bug #5 — Permanent Data Loss Prevention**: Removed destructive `DELETE` of progress rows in `PATCH /api/contests/[id]` that permanently destroyed scores and submissions when contest assignments changed. Progress is now harmlessly retained since CDN cache and contest pages already filter by assignment at display time. (4) **Bug #8 — Dashboard Layout Error Logging**: Added error logging to `layout.tsx` user role query to surface auth/DB failures instead of silently defaulting to trainer role. Files: `lms/lib/supabase/middleware.ts`, `lms/app/(dashboard)/admin/users/page.tsx`, `lms/app/(dashboard)/profile/page.tsx`, `lms/app/api/users/me/route.ts`, `lms/app/api/contests/[id]/route.ts`, `lms/app/(dashboard)/layout.tsx`. |
| 2026-08-29 | Antigravity Agent | **High-Priority Data Visibility Bug Fixes (4 Bugs)**: (1) **Bug #3 — Team Names with Spaces**: Fixed PostgREST `.or()` filter generating invalid syntax for team names containing spaces (e.g. "Team Alpha"). Added proper quoting (`team.eq."Team Alpha"`) across `contests/page.tsx`, `api/contests/route.ts`, and `dashboard/page.tsx`. (2) **Bug #4 — Dashboard Leaderboard Silent Failure**: Separated DB error handling from empty-data detection in the dashboard fallback progress loop. Errors are now logged instead of silently breaking. (3) **Bug #6 — Empty Leaderboard Without Assignments**: Removed aggressive `leaderboard = []` enforcement when `assignedUserIds.size === 0` in `contests/[id]/page.tsx`. Now falls through to show all non-admin users with actual progress data, handling contests not yet assigned to groups. (4) **Bug #10 — Corrupted CDN Snapshots**: Fixed both progress fetch loops in `cdn-cache.ts` to distinguish DB errors from empty results. On error, snapshot generation aborts instead of uploading all-zeros data. Files: `lms/app/(dashboard)/contests/page.tsx`, `lms/app/api/contests/route.ts`, `lms/app/(dashboard)/dashboard/page.tsx`, `lms/app/(dashboard)/contests/[id]/page.tsx`, `lms/lib/cdn-cache.ts`. |
| 2026-08-29 | Antigravity Agent | **Medium & Low Priority Data Visibility Fixes (3 Bugs)**: (1) **Bug #7 — Reports Missing Unassigned Users**: Contest reports now include users who have progress data but are no longer assigned. These users are included with an "(Unassigned)" status suffix, ensuring no submitted scores are silently dropped from reports. (2) **Bug #9 — IT Trainer Overview Auth Error Logging**: Replaced silent `.catch(() => empty)` on `auth.admin.listUsers()` with proper `console.warn` logging so auth failures are visible in server logs. (3) **Bug #11 — Roadmap Scrape False Success**: Changed the `handleSyncScrape` catch block from showing a misleading `⚡ Scrape sync initiated!` success message to showing an actual `❌ Scrape sync failed:` error message. Files: `lms/app/api/reports/route.ts`, `lms/app/api/internal-training/trainer-overview/route.ts`, `lms/app/(dashboard)/roadmaps/page.tsx`. |
| 2026-08-29 | Antigravity Agent | **Fix User Update Schema Cache Error (`updated_at` / `updated_by` Fallback)**: Fixed PostgREST schema cache rejection when updating user records via `PATCH /api/users/[id]`, `PATCH /api/users/me`, and `PATCH /api/support-tickets/[id]`. If the remote Supabase database does not have `updated_at` or `updated_by` columns in `public.users`, the mutation endpoints automatically strip the audit fields and retry the `.update()`, ensuring user edits, profile modifications, and support ticket resolutions succeed cleanly without schema errors. Files: `lms/app/api/users/[id]/route.ts`, `lms/app/api/users/me/route.ts`, `lms/app/api/support-tickets/[id]/route.ts`. |
| 2026-08-29 | Antigravity Agent | **Fix LeetCode Contest Progress Scraping & Leaderboard Synchronization**: (1) Connected `POST /api/scrape/trigger` to automatically route `platform === 'leetcode'` contests to `syncLeetCodeContest()` rather than attempting HackerRank scraper calls. (2) Increased recent AC fetch limit in `/api/leetcode/sync` to 100 to avoid missing historical solves. (3) Quoted team filters in `/api/leetcode/sync` to handle spaces. (4) Regenerated contest and global leaderboard CDN snapshots with live problem match evaluations, immediately displaying LeetCode participant handles, solved problem counts, scores, and ranks on contest leaderboards. Files: `lms/app/api/scrape/trigger/route.ts`, `lms/app/api/leetcode/sync/route.ts`, `lms/lib/leetcode-sync.ts`. |
| 2026-08-28 | Antigravity Agent | **Admin Direct Profile Editing with Audit Trace & Trainer Support Ticket Workflow**: (1) Enabled direct profile editing for Admins and Managers via `AdminDirectEditModal.tsx` on `/profile` with full audit tracking (`updated_by`, `updated_at`, and `updater` join). (2) Enforced that only regular trainers require support ticket approval for profile changes, and eliminated the duplicate bottom banner leaving a single "Request Profile Change" button in the header. (3) Added audit trace fields (`updated_by`, `updated_at`) to `public.users` in migration `09_profile_change_tickets_and_unique_leetcode.sql` and updated all user mutation APIs (`api/users/me`, `api/users/[id]`, and `api/support-tickets/[id]`) to persist the modifier ID and timestamp. (4) Joined updater information across `profile/page.tsx` and `admin/users/page.tsx` displaying "Last modified on [Date] by [Admin Name]". Files: `lms/app/(dashboard)/profile/ProfileDetailsView.tsx`, `lms/app/(dashboard)/profile/AdminDirectEditModal.tsx`, `lms/app/(dashboard)/profile/page.tsx`, `lms/app/api/users/me/route.ts`, `lms/app/api/users/[id]/route.ts`, `lms/app/api/support-tickets/[id]/route.ts`, `lms/lib/types.ts`, `lms/supabase/migrations/09_profile_change_tickets_and_unique_leetcode.sql`. |
| 2026-08-28 | Antigravity Agent | **LeetCode Profile Validation Fix, Unique Handle Enforcement & Support Ticket Profile Change Workflow**: (1) Fixed LeetCode GraphQL query handling in `lms/lib/leetcode.ts` to cleanly handle non-existent user responses without throwing unhandled exceptions. (2) Enforced unique `leetcode_id` across LMS users in `validate-leetcode`, `api/users/[id]`, `api/users`, and `api/support-tickets` with database migration `09_profile_change_tickets_and_unique_leetcode.sql` creating a unique partial index on `lower(trim(leetcode_id))`. (3) Disabled direct profile editing for regular users (trainers) on `/profile` and restricted `PATCH /api/users/me` to admins/managers. (4) Built **Profile Change Request (Support Tickets)** workflow with `ProfileDetailsView.tsx`, `ProfileChangeRequestModal.tsx`, and `ProfileTicketsList.tsx`. (5) Created `/api/support-tickets` and `/api/support-tickets/[id]` endpoints allowing trainers to submit requests and Admins/Managers to review, approve (auto-applying changes to DB & CDN), or decline requests with full audit tracking (`resolved_by`, `resolved_at`, and `admin_notes`). (6) Enhanced `/admin/helpdesk` with dual-tab support for Profile Change Requests (with before/after diffs) and Contest Access Requests. Files: `lms/lib/leetcode.ts`, `lms/app/api/users/validate-leetcode/route.ts`, `lms/app/api/users/me/route.ts`, `lms/app/api/users/[id]/route.ts`, `lms/app/api/users/route.ts`, `lms/app/api/support-tickets/route.ts`, `lms/app/api/support-tickets/[id]/route.ts`, `lms/app/(dashboard)/profile/page.tsx`, `lms/app/(dashboard)/profile/ProfileDetailsView.tsx`, `lms/app/(dashboard)/profile/ProfileChangeRequestModal.tsx`, `lms/app/(dashboard)/profile/ProfileTicketsList.tsx`, `lms/app/(dashboard)/admin/helpdesk/page.tsx`, `lms/supabase/migrations/09_profile_change_tickets_and_unique_leetcode.sql`. |
| 2026-08-28 | Antigravity Agent | **Fix Trainer Profile Updating Across LMS & Admin User Management**: (1) Fixed blocking HackerRank/LeetCode verification checks in `validate-hackerrank/route.ts`, `validate-leetcode/route.ts`, `api/users/me/route.ts`, and `api/users/[id]/route.ts` that rejected profile updates whenever third-party APIs returned Cloudflare challenges, 403s, or rate limits. (2) Added robust `parseHackerrankUsername` and `sanitizeField` utility functions in `lms/lib/utils.ts` to automatically extract usernames from URLs, `@` prefixes, and strip placeholder tokens (`'nil'`, `'n/a'`, `'-'`). (3) Fixed `api/users/[id]/route.ts` (Admin User Edit) to support `leetcode_id`, `emp_email`, and email synchronization to `auth.users`. (4) Enhanced `api/users/route.ts` and `api/users/bulk/route.ts` to support `leetcode_id` and `emp_email`. (5) Connected automatic background CDN snapshot regeneration (`generateAndUploadCdnSnapshots()`) and tag revalidations to user profile mutations so updated trainer names, emails, and platform handles immediately reflect on contest and global leaderboards. Files: `lms/lib/utils.ts`, `lms/app/api/users/me/route.ts`, `lms/app/api/users/[id]/route.ts`, `lms/app/api/users/route.ts`, `lms/app/api/users/bulk/route.ts`, `lms/app/api/users/validate-hackerrank/route.ts`, `lms/app/(dashboard)/profile/ProfileForm.tsx`, `lms/app/(dashboard)/admin/users/UserTable.tsx`. |
| 2026-08-28 | Antigravity Agent | **Fix CDN Storage Stale Cache, Next.js Fetch Caching & Scraper Revalidation**: (1) Changed `getCachedContestData` and `getCachedGlobalLeaderboard` in `lms/lib/cdn-cache.ts` from `revalidate: 60` to `cache: 'no-store'` so Next.js never serves stale CDN JSON from its internal data cache. (2) `scraper-service/src/progressScraper.js` now sends `x-api-key` header in its POST request to `/api/scrape/revalidate` to avoid 401 Unauthorized errors and ensure cache purging succeeds after scrapes. (3) `app/api/scrape/revalidate/route.ts` now calls `generateAndUploadCdnSnapshots(contestId)` directly from DB before revalidating tags. (4) Added `↻ Refresh Display` button in `LeaderboardTable.tsx` for admins/managers to immediately rebuild and display the latest DB data without running a full scrape. (5) `cdnPublisher.js` and `cdn-cache.ts` include `hackerrank_id` and `leetcode_id` in CDN payloads to fix missing ID display. (6) LeetCode sync calls `generateAndUploadCdnSnapshots` and increased AC submission fetch limit to 100. |
| 2026-08-28 | Antigravity Agent | **Fix Scrape Data Accuracy — Slug Normalization, Coverage Check, Smart Skip**: Fixed three bugs causing wrong question counts. Slug Mismatch — compare API returns slugs like `arrayds` vs `arrays-ds` from challenges API, fixed with multi-format key indexing. Incomplete Compare Coverage — compare API only returns challenges either user attempted, added `_countCoverage` check and `_buildDenseRowsFromCompareWithSupplement` fallback. Smart Skip False Positive — added per-challenge solved-count comparison to prevent stale data reuse. Files: `scraper-service/src/hackerrank.js`, `scraper-service/src/progressScraper.js`. |
| 2026-08-28 | Antigravity Agent | **Fix Scraper ReferenceError & React #418 Hydration Mismatch**: Fixed runtime `ReferenceError: attempted is not defined` in `scraper-service/src/hackerrank.js`. Resolved React Error #418 in `lms/app/(dashboard)/contests/[id]/page.tsx` and `LeaderboardTable.tsx` by setting fixed `timeZone: 'Asia/Kolkata'` and `mounted` guard. |

| 2026-08-27 | Antigravity Agent | **Strict Contest Participant Assignment Enforcement & CDN Cache Sanitize**: Fixed issue where unassigned users and administrators appeared under contest leaderboards, participant counters, and reports. Enforced strict active assignment filtering in `contests/[id]/page.tsx` across both CDN cache and fallback DB branches by cross-referencing against `contest_assignments` and excluding `role === 'admin'`. Updated `cdnPublisher.js` and `cdn-cache.ts` to exclude admins from team/group queries. Added automatic orphaned `progress` cleanup, immediate CDN snapshot regeneration, and cache revalidation in `PATCH /api/contests/[id]` when contest assignments change. Restricted `api/leetcode/sync/route.ts` to only sync contests assigned to the target user, eliminated all-user fallback in `leetcode-sync.ts`, removed unassigned progress fallback in `api/reports/route.ts`, and prevented unassigned roadmaps from injecting contests into trainer dashboards. Executed automated database cleanup purging legacy unassigned progress rows and republished clean CDN snapshots for all contests. |
| 2026-08-27 | Antigravity Agent | **Create Group & Assign Trainers in Contest Creation**: Implemented inline group creation and trainer assignment feature in `ContestWizard.tsx` (Step 3) and `EditContestForm.tsx`. Built `CreateGroupAndAssignModal.tsx` allowing admins/managers to name a group, filter and search through individual trainers (by name, emp ID, team, handles), select individual trainers, and create/assign the group in one click. Enhanced `POST /api/contests` to support atomic `new_group: { name, user_ids }` creation with automated group member and assignment insertion. |
| 2026-08-27 | Antigravity Agent | **Attempted vs Solved Question Counting & Contest Widget Fixes**: Fixed problem completion counting across the system so partial submissions and zero-score attempts are strictly marked as `attempted` and not counted toward `solved` or completions. Updated `hackerrank.js`, `progressScraper.js`, `cdnPublisher.js`, `cdn-cache.ts`, `contests/[id]/page.tsx`, `dashboard/page.tsx`, `reports/page.tsx`, `api/reports/route.ts`, and `api/trainer/skills/route.ts` to require full score (`status === 'solved' && score >= max_score`). Updated 26 legacy database rows in `progress` table to `attempted` and flushed stale CDN caches. Fixed dashboard Recent Contests widget by removing `.limit(6)` query truncation and `.slice(0, 3)` array slicing, added scrollable list container for all contests, increased `getContestAnalytics` limit to 50, and created `AssignedContestsWidget.tsx` for trainers. |
| 2026-08-27 | Antigravity Agent | **Full Platform Separation & LeetCode Contest Support**: Added LeetCode Problem List scraping support (`parseProblemListId`, `fetchProblemListQuestions`), dynamic step titles & platform-aware creation flow in `ContestWizard.tsx`, "➕ Add Problems" modal and "🔄 Re-sync" button in `QuestionsPanel.tsx`, platform-aware empty states in `LeaderboardTable.tsx`, dynamic track identifier and delete modal in `EditContestForm.tsx`, fixed `fontSize` CSS bug in `page.css`, added platform badges in `AutoScrapeScheduler.tsx`, created `lib/leetcode-sync.ts` and enabled LeetCode automated solve synchronizing in `api/scrape/auto-cron`. |
| 2026-08-27 | Antigravity Agent | Created comprehensive `CODEBASE.md` system documentation and established workspace auto-sync agent rules (`AGENTS.md`, `GEMINI.md`, `.agent/rules/`). |
