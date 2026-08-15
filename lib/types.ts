export type UserRole = 'admin' | 'manager' | 'trainer'
export type ContestStatus = 'upcoming' | 'active' | 'past'
export type QuestionStatus = 'solved' | 'attempted' | 'unattempted'
export type AccessRequestStatus = 'pending' | 'approved' | 'denied'
export type NotificationType = 'access_request' | 'contest_assigned' | 'access_approved' | 'access_denied' | 'system'

export interface User {
  id: string
  emp_id: string
  full_name: string
  email: string
  emp_email: string
  team: string
  manager: string
  hackerrank_id: string
  role: UserRole
  created_at: string
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
  domain: string
  hackerrank_url: string
  max_score: number
  difficulty: string
  order_index: number
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
