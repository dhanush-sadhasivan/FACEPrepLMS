'use client';

import Link from 'next/link';

export interface AssignedContestItem {
  id: string;
  title: string;
  hackerrank_slug?: string;
  platform?: 'hackerrank' | 'leetcode' | null;
  start_date: string;
  end_date: string;
  questions?: { count: number }[];
}

interface AssignedContestsWidgetProps {
  contests: AssignedContestItem[];
}

export default function AssignedContestsWidget({ contests }: AssignedContestsWidgetProps) {
  const now = new Date();

  return (
    <div className="widget-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <h3 className="widget-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.98rem' }}>
            <span>🏆</span> Assigned Contests
          </h3>
          {contests.length > 0 && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                background: 'var(--surface-3)',
                color: 'var(--text-secondary)',
                padding: '0.1rem 0.45rem',
                borderRadius: '999px',
              }}
            >
              {contests.length}
            </span>
          )}
        </div>
        <Link href="/contests" style={{ color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>
          View All →
        </Link>
      </div>

      {contests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '1.75rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          <div style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>🏆</div>
          No assigned contests found.
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            maxHeight: '340px',
            overflowY: 'auto',
            paddingRight: '0.35rem',
          }}
        >
          {contests.map((c) => {
            const start = new Date(c.start_date);
            const end = new Date(c.end_date);
            const isActive = now >= start && now <= end;
            const isUpcoming = now < start;
            const status = isActive ? 'active' : isUpcoming ? 'upcoming' : 'past';
            const qCount = c.questions?.[0]?.count || 0;
            const isLeetCode = c.platform === 'leetcode';

            return (
              <Link key={c.id} href={`/contests/${c.id}`} style={{ textDecoration: 'none' }}>
                <div
                  style={{
                    padding: '0.65rem 0.85rem',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.6rem',
                    transition: 'all 0.18s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-glow)';
                    e.currentTarget.style.background = 'var(--surface-3)';
                    e.currentTarget.style.transform = 'translateX(2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.background = 'var(--surface-2)';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        background: isLeetCode ? 'rgba(255,161,22,0.12)' : 'rgba(59,130,246,0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.95rem',
                        flexShrink: 0,
                      }}
                    >
                      {isLeetCode ? '🟠' : '🏆'}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            color: 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {c.title}
                        </span>
                        <span
                          style={{
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            padding: '0.08rem 0.3rem',
                            borderRadius: 3,
                            background: isLeetCode ? 'rgba(255,161,22,0.15)' : 'rgba(59,130,246,0.15)',
                            color: isLeetCode ? '#ffa116' : '#3b82f6',
                            flexShrink: 0,
                          }}
                        >
                          {isLeetCode ? 'LeetCode' : 'HackerRank'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        <span>💡 {qCount} Questions</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <span
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        padding: '0.12rem 0.45rem',
                        borderRadius: '999px',
                        background:
                          status === 'active'
                            ? 'rgba(16,185,129,0.15)'
                            : status === 'upcoming'
                            ? 'rgba(59,130,246,0.15)'
                            : 'rgba(148,163,184,0.15)',
                        color:
                          status === 'active'
                            ? '#10b981'
                            : status === 'upcoming'
                            ? '#3b82f6'
                            : 'var(--text-muted)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      {status === 'active' && (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#10b981',
                            display: 'inline-block',
                          }}
                        />
                      )}
                      {status.toUpperCase()}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>→</span>
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
