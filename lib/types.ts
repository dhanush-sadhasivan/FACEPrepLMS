export type UserRole = 'admin' | 'manager' | 'trainer'
export type ContestStatus = 'upcoming' | 'active' | 'past'
export type PlatformType = 'hackerrank' | 'leetcode'
export type QuestionStatus = 'solved' | 'attempted' | 'unattempted'
export type AccessRequestStatus = 'pending' | 'approved' | 'denied'
export type NotificationType = 'access_request' | 'contest_assigned' | 'access_approved' | 'access_denied' | 'system' | 'announcement'


export interface User {
  id: string
  emp_id: string
  full_name: string
  email: string
  emp_email: string
  team: string
  manager: string
  hackerrank_id: string
  leetcode_id?: string | null
  role: UserRole
  created_at: string
  updated_by?: string | null
  updated_at?: string | null
  updater?: {
    id: string
    full_name: string
    role?: string
  } | null
}

export interface Group {
  id: string
  name: string
  created_by: string
  created_at: string
  member_count?: number
}

export interface Contest {
  id: string
  title: string
  hackerrank_slug: string
  platform?: PlatformType
  start_date: string
  end_date: string
  created_by: string
  last_scraped_at: string | null
  created_at: string
  question_count?: number
  assigned_count?: number
}

export interface Question {
  id: string
  contest_id: string
  slug: string
  title: string
  topic?: string | null
  domain: string
  hackerrank_url: string
  url?: string
  max_score: number
  difficulty: string
  order_index: number
}

export interface LeetCodeUserStats {
  user_id: string
  username: string
  ranking: number | null
  contest_rating: number | null
  solved_easy: number
  solved_medium: number
  solved_hard: number
  solved_total: number
  submission_calendar: Record<string, number>
  last_synced_at: string
  sync_status: string
  sync_error?: string | null
}

export interface Progress {
  id: string
  contest_id: string
  user_id: string
  question_id: string
  status: QuestionStatus
  score: number
  max_score: number
  last_submission_at: string | null
  updated_at: string
}

export interface AccessRequest {
  id: string
  contest_id: string
  user_id: string
  message: string
  status: AccessRequestStatus
  resolved_by: string | null
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  related_id: string | null
  is_read: boolean
  created_at: string
  sender?: {
    id?: string
    full_name?: string
    role?: string
    team?: string
  } | null
  is_sent_by_me?: boolean
}

// ── Trainer Flow Types ───────────────────────────────────────────────────

export type TodoPriority = 'high' | 'medium' | 'low'
export type RoadmapStatus = 'not_started' | 'in_progress' | 'completed'

export interface RoadmapQuestion {
  id: string
  title: string
  description?: string
  question_id?: string
  hackerrank_url?: string
  difficulty?: string
  max_score?: number
  order_index?: number
}

export interface RoadmapTopic {
  id: string
  title: string
  description?: string
  topic_group?: string
  questions?: RoadmapQuestion[]
  resources?: { label: string; url: string }[]
  milestone?: boolean
  question_id?: string
  hackerrank_url?: string
  difficulty?: string
  max_score?: number
  order_index?: number
}

export interface Roadmap {
  id: string
  title: string
  description?: string
  domain: string
  level: string
  estimated_hours: number
  topics: RoadmapTopic[]
  contest_id?: string | null
  contest_title?: string
  is_it_roadmap?: boolean
  created_by: string
  created_at: string
}

export interface UserRoadmapProgress {
  id: string
  user_id: string
  roadmap_id: string
  completed_topic_ids: string[]
  topic_completion_dates?: Record<string, string>
  status: RoadmapStatus
  started_at: string | null
  completed_at: string | null
  updated_at: string
}

export interface Course {
  id: string
  title: string
  description?: string
  category: string
  level: string
  duration_weeks: number
  syllabus: { week: number; topics: string[]; resources?: string[] }[]
  created_by: string
  created_at: string
}

export interface CourseAssignment {
  id: string
  course_id: string
  user_id: string | null
  group_id: string | null
  assigned_by: string
  due_date: string | null
  created_at: string
  course?: Course
}

export interface TrainerTodo {
  id: string
  user_id: string
  title: string
  description?: string
  is_completed: boolean
  priority: TodoPriority
  category: string
  due_date: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

// ── Internal Training Dashboard Types ─────────────────────────────────────

export type QuestionLinkType = 'hackerrank' | 'custom'

export interface ITRoadmapConfig {
  id: string
  roadmap_id: string
  start_date_mode: string
  working_days: number[] // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
  default_extension_days: number
  created_by?: string
  created_at?: string
  updated_at?: string
}

export interface ITDayQuestion {
  id: string
  day_plan_id: string
  question_type: QuestionLinkType
  question_id?: string | null
  title: string
  description?: string | null
  url: string
  order_index: number
  difficulty?: string
  max_score?: number
  created_at?: string
  // Dynamic fields from completions/scraper
  clicked_at?: string | null
  is_completed?: boolean
  completed_at?: string | null
  score?: number
  hr_solved?: boolean
  needs_portal_click?: boolean
}

export interface ITDayPlan {
  id: string
  roadmap_id: string
  day_number: number
  topic_title: string
  description?: string | null
  resources: { title: string; url: string }[]
  created_by?: string
  created_at?: string
  updated_at?: string
  questions?: ITDayQuestion[]
  calculated_date?: string // Computed date string e.g. "2026-08-19"
}

export interface ITTrainerProgress {
  id: string
  user_id: string
  roadmap_id: string
  started_at: string | null // ISO date string "YYYY-MM-DD"
  current_day: number
  extended_days: number
  extension_count: number
  created_at?: string
  updated_at?: string
}

export interface ITQuestionCompletion {
  id: string
  user_id: string
  day_question_id: string
  clicked_at: string | null
  completed_at: string | null
  is_completed: boolean
  created_at?: string
}

export interface ITTrainerOverviewItem {
  user_id: string
  full_name: string
  emp_id: string
  team: string
  email: string
  roadmap_id: string
  roadmap_title: string
  started_at: string | null
  current_day: number
  total_days: number
  completed_questions_count: number
  total_questions_count: number
  pending_questions_count: number
  it_days_count: number
  extended_days: number
  extension_count: number
  is_online?: boolean
  last_it_check_date?: string | null
  is_it_counted_today?: boolean
}

