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

  // Sort by priority (higher level & completed badges first!)
  const sortedBadges = [...allBadges].sort((a, b) => getBadgePriority(b) - getBadgePriority(a));
  const displayBadges = sortedBadges.slice(0, 4);

  const unlockedCount = allBadges.filter(b => b.isCompleted).length;

  return (
    <div className="widget-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
        <h3 className="widget-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem' }}>
          <span>🏆</span>
          Skills &amp; Badges Obtained
          {unlockedCount > 0 && (
            <span style={{ fontSize: '0.7rem', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '0.1rem 0.5rem', borderRadius: '999px', fontWeight: 800 }}>
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
        <div style={{ textAlign: 'center', padding: '1.25rem 0.75rem', background: 'var(--surface-2)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.2rem' }}>🎯</div>
          <div style={{ fontWeight: 700, fontSize: '0.83rem', color: 'var(--text-primary)' }}>
            No Badges Unlocked Yet
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
            Complete 100% of questions in any topic to earn your first badge!
          </p>
        </div>
      ) : (
        /* ── Compact Square Tiles Grid ─────────────────────────────────── */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem' }}>
          {displayBadges.map(b => {
            const isCompleted = b.isCompleted;
            return (
              <div
                key={b.id}
                style={{
                  background: isCompleted ? 'rgba(245, 158, 11, 0.08)' : 'var(--surface-2)',
                  border: isCompleted ? '1.5px solid rgba(245, 158, 11, 0.4)' : '1px dashed var(--border)',
                  borderRadius: '12px', padding: '0.65rem 0.4rem',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'space-between', textAlign: 'center',
                  boxShadow: isCompleted ? '0 4px 12px rgba(245, 158, 11, 0.12)' : 'none',
                  transition: 'transform 0.15s ease',
                  cursor: 'pointer', minHeight: '100px',
                }}
                title={isCompleted ? `${b.title} (100% Completed)` : `${b.title} (${b.solved}/${b.total} Solved)`}
              >
                {/* Badge Icon */}
                <div style={{
                  fontSize: '1.6rem', lineHeight: 1, marginBottom: '0.35rem',
                  filter: isCompleted ? 'drop-shadow(0 2px 6px rgba(245,158,11,0.4))' : 'grayscale(60%)',
                }}>
                  {b.badgeIcon}
                </div>

                {/* Badge Title */}
                <div style={{
                  fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-primary)',
                  lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  maxHeight: '2.3em', width: '100%', wordBreak: 'break-word',
                }}>
                  {b.title}
                </div>

                {/* Level / Status Pill */}
                <div style={{ marginTop: '0.35rem' }}>
                  {isCompleted ? (
                    <span style={{
                      fontSize: '0.62rem', fontWeight: 900, background: 'linear-gradient(135deg, #f59e0b, #eab308)',
                      color: '#000', padding: '0.1rem 0.4rem', borderRadius: '999px', textTransform: 'uppercase',
                      letterSpacing: '0.3px', display: 'inline-block',
                    }}>
                      🏆 100%
                    </span>
                  ) : (
                    <span style={{
                      fontSize: '0.62rem', fontWeight: 700, background: 'var(--surface-3)',
                      color: 'var(--text-muted)', padding: '0.1rem 0.4rem', borderRadius: '999px',
                      display: 'inline-block',
                    }}>
                      🔒 {b.solved}/{b.total}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {allBadges.length > 4 && (
        <Link href="/skills" style={{ display: 'block', textAlign: 'center', marginTop: '0.6rem', fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'none', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
          +{allBadges.length - 4} more skills &amp; badges →
        </Link>
      )}
    </div>
  );
}
