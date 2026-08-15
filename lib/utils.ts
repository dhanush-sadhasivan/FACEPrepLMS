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
