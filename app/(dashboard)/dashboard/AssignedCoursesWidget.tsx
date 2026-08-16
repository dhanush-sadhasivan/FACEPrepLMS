'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Priority calculator for higher level badges
function getBadgePriority(badge: any): number {
  let score = 0;

  // Unlocked badges get top priority (+1000)
  if (badge.isCompleted) score += 1000;

  // Level priority
  if (badge.type === 'contest') {
    score += 500; // Contest Champions are highest level!
  } else {
    const title = (badge.title || '').toLowerCase();
    if (title.includes('linked list') || title.includes('linkedlist')) score += 300;
    else if (title.includes('dynamic') || title.includes('dp')) score += 290;
    else if (title.includes('tree') || title.includes('graph')) score += 280;
    else if (title.includes('recursion') || title.includes('backtrack')) score += 270;
    else if (title.includes('array')) score += 200;
    else if (title.includes('stack') || title.includes('queue')) score += 190;
    else if (title.includes('string')) score += 180;
    else if (title.includes('sort') || title.includes('search')) score += 170;
    else score += 100;
  }

  // Secondary tie-breaker by total questions
  score += Math.min(badge.total, 99);

  return score;
}

export default function AssignedCoursesWidget() {
  const [skillsData, setSkillsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSkills() {
      try {
        const res = await fetch('/api/trainer/skills');
        if (res.ok) {
          setSkillsData(await res.json());
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    loadSkills();
  }, []);

  const allBadges = [
    ...(skillsData?.topicBadges || []),
    ...(skillsData?.contestBadges || []),
  ];

  // Sort by priority (completed & high level badges first!)
  const sortedBadges = [...allBadges].sort((a, b) => getBadgePriority(b) - getBadgePriority(a));
  const displayBadges = sortedBadges.slice(0, 4);

  const unlockedCount = allBadges.filter((b) => b.isCompleted).length;

  return (
    <div className="widget-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
        <h3 className="widget-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem' }}>
          <span>🏆</span>
          Skills &amp; Badges Obtained
          {unlockedCount > 0 && (
            <span style={{ fontSize: '0.7rem', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '0.1rem 0.55rem', borderRadius: '999px', fontWeight: 800 }}>
              {unlockedCount} Earned
            </span>
          )}
        </h3>
        <Link href="/skills" style={{ color: 'var(--accent)', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none' }}>
          View Badges →
        </Link>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Loading skills &amp; badges...
        </div>
      ) : displayBadges.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '1.5rem 1rem', background: 'var(--surface-2)', borderRadius: '12px', border: '1px dashed var(--border)', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '1.8rem', marginBottom: '0.35rem' }}>🎯</div>
          <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
            No Badges Unlocked Yet
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0', maxWidth: 280 }}>
            Complete 100% of questions in any topic or contest to earn your official skill badges!
          </p>
        </div>
      ) : (
        /* ── Flexible Dynamic Badge List Grid ─────────────────────────────────── */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem', flex: 1, alignContent: 'start' }}>
          {displayBadges.map((b) => {
            const isCompleted = b.isCompleted;
            return (
              <div
                key={b.id}
                style={{
                  background: isCompleted ? 'rgba(245, 158, 11, 0.08)' : 'var(--surface-2)',
                  border: isCompleted ? '1.5px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '0.75rem 0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  boxShadow: isCompleted ? '0 4px 12px rgba(245, 158, 11, 0.12)' : 'none',
                  transition: 'all 0.15s ease',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                title={isCompleted ? `${b.title} (100% Completed)` : `${b.title} (${b.solved}/${b.total} Solved)`}
              >
                {/* Badge Icon Emblem */}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '10px',
                    background: isCompleted ? 'rgba(245, 158, 11, 0.15)' : 'var(--surface-3)',
                    border: isCompleted ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.45rem',
                    flexShrink: 0,
                    boxShadow: isCompleted ? '0 2px 8px rgba(245, 158, 11, 0.2)' : 'none',
                  }}
                >
                  {b.badgeIcon || '🏆'}
                </div>

                {/* Badge Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.84rem',
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      lineHeight: 1.2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {b.title}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.25rem' }}>
                    {isCompleted ? (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 900,
                          background: 'linear-gradient(135deg, #f59e0b, #eab308)',
                          color: '#000',
                          padding: '0.12rem 0.5rem',
                          borderRadius: '999px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.3px',
                        }}
                      >
                        🏆 100% MASTERED
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          background: 'var(--surface-3)',
                          color: 'var(--text-muted)',
                          padding: '0.12rem 0.5rem',
                          borderRadius: '999px',
                        }}
                      >
                        🔒 {b.solved}/{b.total} Solved
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {allBadges.length > 4 && (
        <Link
          href="/skills"
          style={{
            display: 'block',
            textAlign: 'center',
            marginTop: '0.75rem',
            fontSize: '0.78rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textDecoration: 'none',
            paddingTop: '0.6rem',
            borderTop: '1px solid var(--border)',
          }}
        >
          +{allBadges.length - 4} more skills &amp; badges →
        </Link>
      )}
    </div>
  );
}
