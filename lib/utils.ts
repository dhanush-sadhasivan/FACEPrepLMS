import { User, ContestStatus } from './types'

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export function formatRelativeTime(date: string): string {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const daysDifference = Math.round((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  
  if (Math.abs(daysDifference) < 1) {
    const hours = Math.round((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60))
    if (Math.abs(hours) < 1) {
      const minutes = Math.round((new Date(date).getTime() - new Date().getTime()) / (1000 * 60))
      return rtf.format(minutes, 'minute')
    }
    return rtf.format(hours, 'hour')
  }
  return rtf.format(daysDifference, 'day')
}

export function getContestStatus(start: string, end: string): ContestStatus {
  const now = new Date().getTime()
  const startDate = new Date(start).getTime()
  const endDate = new Date(end).getTime()
  
  if (now < startDate) return 'upcoming'
  if (now > endDate) return 'past'
  return 'active'
}

export function parseCSVRow(row: Record<string, string>): Partial<User> {
  return {
    emp_id: row.emp_id || row.EmpID || '',
    full_name: row.full_name || row.Name || row.FullName || '',
    email: row.email || row.Email || '',
    emp_email: row.emp_email || row.EmpEmail || '',
    team: row.team || row.Team || '',
    manager: row.manager || row.Manager || '',
    hackerrank_id: row.hackerrank_id || row.HackerRankID || '',
    role: (row.role?.toLowerCase() as User['role']) || 'trainer'
  }
}

export function getDomainColor(domain: string): string {
  let hash = 0
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash)
  }
  const color = Math.floor(Math.abs((Math.sin(hash) * 10000) % 1 * 16777215)).toString(16)
  return '#' + color.padStart(6, '0')
}

export function calculateProgress(solved: number, total: number): number {
  if (total === 0) return 0
  return Math.round((solved / total) * 100)
}

/**
 * Accepts a raw username, handle, or any HackerRank profile URL and returns the normalized username.
 * e.g., "https://www.hackerrank.com/profile/jdoe" -> "jdoe"
 * e.g., "@jdoe" -> "jdoe", "jdoe" -> "jdoe"
 */
export function parseHackerrankUsername(input?: string | null): string | null {
  if (!input) return null;
  let s = String(input).trim();
  if (!s) return null;
  if (['nil', 'null', 'n/a', 'undefined', 'none', '-'].includes(s.toLowerCase())) {
    return null;
  }
  if (s.includes('hackerrank.com')) {
    try {
      const url = new URL(s.startsWith('http') ? s : `https://${s}`);
      const parts = url.pathname.split('/').filter(Boolean);
      const cleaned = parts[0] === 'profile' || parts[0] === 'hackers' ? parts.slice(1) : parts;
      s = cleaned[0] || '';
    } catch {
      const m = s.match(/hackerrank\.com\/(?:profile\/|hackers\/)?([^/?#]+)/i);
      s = m ? m[1] : s;
    }
  }
  s = s.replace(/^@+/, '').replace(/[/?#].*$/, '').trim();
  return s || null;
}

/**
 * Sanitizes generic text fields, converting placeholder tokens ('nil', 'n/a', '-') or empty strings to null.
 */
export function sanitizeField(val?: string | null): string | null {
  if (!val) return null;
  const trimmed = String(val).trim();
  if (!trimmed || ['nil', 'null', 'n/a', 'undefined', 'none', '-'].includes(trimmed.toLowerCase())) {
    return null;
  }
  return trimmed;
}

/**
 * Canonical check for whether a submission/progress record is solved.
 * Satisfies Interface Contract 1 from PROJECT.md:
 * Returns true if and only if p.status === 'solved' AND
 * (if max_score > 0, score >= max_score; otherwise score > 0).
 */
export function isRecordSolved(
  p:
    | {
        status?: string | null;
        score?: number | string | null;
        max_score?: number | string | null;
      }
    | null
    | undefined
): boolean {
  if (!p) return false;
  if (p.status !== 'solved') return false;
  const score = p.score != null ? Number(p.score) : 0;
  const maxScore = p.max_score != null ? Number(p.max_score) : 0;
  if (Number.isFinite(maxScore) && maxScore > 0) {
    return Number.isFinite(score) && score >= maxScore;
  }
  return Number.isFinite(score) && score > 0;
}

