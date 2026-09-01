'use client';

import Link from 'next/link';
import { Roadmap, UserRoadmapProgress } from '@/lib/types';

interface RoadmapWithProgress extends Roadmap {
  progress: UserRoadmapProgress | null;
}

interface TopicRoadmapsWidgetProps {
  roadmaps: RoadmapWithProgress[];
}

const DOMAIN_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  'DSA': { icon: '🧠', color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  'System Design': { icon: '🏗️', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  'Web Dev': { icon: '🌐', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  'Python': { icon: '🐍', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  'Cloud': { icon: '☁️', color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
  'General': { icon: '📚', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
};

function getDomainConfig(domain: string) {
  return DOMAIN_CONFIG[domain] || DOMAIN_CONFIG['General'];
}

function getStatusLabel(status: string | null) {
  if (!status || status === 'not_started') return { label: 'Not Started', color: 'var(--text-muted)' };
  if (status === 'in_progress') return { label: 'In Progress', color: 'var(--accent)' };
  return { label: 'Completed', color: 'var(--success)' };
}

export default function TopicRoadmapsWidget({ roadmaps }: TopicRoadmapsWidgetProps) {
  const displayRoadmaps = roadmaps.slice(0, 4);

  return (
    <div className="widget-card" style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 className="widget-title" style={{ margin: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--indigo)' }}>
            <path d="M3 3h7v7H3z"/><path d="M14 3h7v7h-7z"/><path d="M3 14h7v7H3z"/>
            <circle cx="17.5" cy="17.5" r="3.5"/><path d="M10 6.5h4"/><path d="M6.5 14v-4"/>
          </svg>
          Topic Roadmaps
        </h3>
        <Link href="/roadmaps" style={{ color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>
          View All →
        </Link>
      </div>

      {displayRoadmaps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>🗺️</div>
          No roadmaps assigned yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {displayRoadmaps.map(rm => {
            const dc = getDomainConfig(rm.domain);
            const completedIds: string[] = rm.progress?.completed_topic_ids || [];
            const topics = rm.topics || [];

            let totalQuestions = 0;
            let completedCount = 0;

            const hasNested = topics.some((t: any) => t.questions && Array.isArray(t.questions) && t.questions.length > 0);

            if (hasNested) {
              topics.forEach((t: any) => {
                const questions = t.questions || [];
                totalQuestions += questions.length;
                completedCount += questions.filter((q: any) => completedIds.includes(q.id) || (q.question_id && completedIds.includes(q.question_id))).length;
              });
            } else if (topics.length > 0) {
              totalQuestions = topics.length;
              completedCount = topics.filter((t: any) => completedIds.includes(t.id) || (t.question_id && completedIds.includes(t.question_id))).length;
            }

            const pct = totalQuestions > 0 ? Math.max(0, Math.min(100, Math.round((completedCount / totalQuestions) * 100))) : 0;

            let computedStatus = 'not_started';
            if (totalQuestions > 0 && completedCount >= totalQuestions) {
              computedStatus = 'completed';
            } else if (completedCount > 0) {
              computedStatus = 'in_progress';
            } else if (rm.progress?.status && rm.progress.status !== 'not_started') {
              computedStatus = rm.progress.status;
            }

            const status = getStatusLabel(computedStatus);

            return (
              <Link key={rm.id} href={`/roadmaps`} style={{ textDecoration: 'none' }}>
                <div style={{
                  padding: '0.75rem 0.9rem',
                  background: 'var(--surface-2)',
                  borderTop: '1px solid var(--border)',
                  borderRight: '1px solid var(--border)',
                  borderBottom: '1px solid var(--border)',
                  borderLeft: `3px solid ${dc.color}`,
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = dc.color; (e.currentTarget as HTMLDivElement).style.transform = 'translateX(3px)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.borderLeftColor = dc.color; (e.currentTarget as HTMLDivElement).style.transform = 'none'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                      <span style={{ fontSize: '1rem' }}>{dc.icon}</span>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rm.title}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: status.color, fontWeight: 700, flexShrink: 0, marginLeft: '0.5rem' }}>
                      {status.label}
                    </span>
                  </div>

                  {/* Progress */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ flex: 1, height: '4px', background: 'var(--surface-3)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, background: `linear-gradient(90deg, ${dc.color}, var(--accent))`, borderRadius: '999px', transition: 'width 0.5s ease' }} />
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>
                      {completedCount}/{totalQuestions}
                    </span>
                  </div>

                  {/* Meta */}
                  <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '999px', background: dc.bg, color: dc.color, fontWeight: 600 }}>
                      {rm.domain}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {rm.level} · ~{rm.estimated_hours}h
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
