'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSkills } from '@/lib/swr-hooks';

export default function AssignedCoursesWidget() {
  const { data: skillsData, isLoading: loading } = useSkills();
  const [activeTab, setActiveTab] = useState<'all' | 'earned' | 'in_progress'>('all');

  const earnedTopicBadges = skillsData?.topicBadges || [];
  const earnedContestBadges = skillsData?.contestBadges || [];
  const inProgressTopics = skillsData?.inProgressTopics || [];
  const earnedBadges = [...earnedTopicBadges, ...earnedContestBadges];

  // Highest % in-progress topic to feature as "Next Milestone"
  const nextMilestone = inProgressTopics.length > 0
    ? [...inProgressTopics].sort((a: any, b: any) => b.pct - a.pct)[0]
    : null;

  // Decide what to display based on active tab
  let displayList: any[] = [];
  if (activeTab === 'earned') {
    displayList = earnedBadges;
  } else if (activeTab === 'in_progress') {
    displayList = inProgressTopics;
  } else {
    // Show earned badges first, then highest in-progress topics
    displayList = [
      ...earnedBadges,
      ...[...inProgressTopics].sort((a: any, b: any) => b.pct - a.pct),
    ];
  }

  const itemsToShow = displayList.slice(0, 4);

  return (
    <div
      className="widget-card"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.15rem' }}>🏆</span>
          <h3 className="widget-title" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>
            Skills &amp; Badges
          </h3>
          {earnedBadges.length > 0 ? (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                background: 'rgba(16, 185, 129, 0.12)',
                color: 'var(--success, #10b981)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '0.12rem 0.55rem',
                borderRadius: '999px',
              }}
            >
              {earnedBadges.length} Earned
            </span>
          ) : (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                background: 'rgba(99, 102, 241, 0.12)',
                color: 'var(--accent, #6366f1)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                padding: '0.12rem 0.55rem',
                borderRadius: '999px',
              }}
            >
              {inProgressTopics.length} In Progress
            </span>
          )}
        </div>

        <Link
          href="/skills"
          style={{
            color: 'var(--accent)',
            fontSize: '0.78rem',
            fontWeight: 700,
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.2rem',
          }}
        >
          View Library →
        </Link>
      </div>

      {/* Sub-Tabs / Filter Switcher */}
      <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.75rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          style={{
            fontSize: '0.74rem',
            fontWeight: 700,
            padding: '0.25rem 0.6rem',
            borderRadius: '6px',
            border: `1px solid ${activeTab === 'all' ? 'var(--accent)' : 'var(--border)'}`,
            background: activeTab === 'all' ? 'rgba(99, 102, 241, 0.12)' : 'var(--surface-2)',
            color: activeTab === 'all' ? 'var(--accent)' : 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Featured ({earnedBadges.length + inProgressTopics.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('earned')}
          style={{
            fontSize: '0.74rem',
            fontWeight: 700,
            padding: '0.25rem 0.6rem',
            borderRadius: '6px',
            border: `1px solid ${activeTab === 'earned' ? 'var(--success, #10b981)' : 'var(--border)'}`,
            background: activeTab === 'earned' ? 'rgba(16, 185, 129, 0.12)' : 'var(--surface-2)',
            color: activeTab === 'earned' ? 'var(--success, #10b981)' : 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          ✓ Mastered ({earnedBadges.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('in_progress')}
          style={{
            fontSize: '0.74rem',
            fontWeight: 700,
            padding: '0.25rem 0.6rem',
            borderRadius: '6px',
            border: `1px solid ${activeTab === 'in_progress' ? 'var(--indigo)' : 'var(--border)'}`,
            background: activeTab === 'in_progress' ? 'rgba(99, 102, 241, 0.12)' : 'var(--surface-2)',
            color: activeTab === 'in_progress' ? 'var(--indigo)' : 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          ⚡ In Progress ({inProgressTopics.length})
        </button>
      </div>

      {/* Next Milestone Teaser (If available) */}
      {nextMilestone && !loading && (
        <div
          style={{
            background: 'var(--surface-2)',
            borderTop: '1px solid var(--border)',
            borderRight: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
            borderLeft: '3.5px solid var(--accent)',
            borderRadius: '8px',
            padding: '0.45rem 0.75rem',
            marginBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent)' }}>
              <span>🎯 NEXT UNLOCK:</span>
              <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {nextMilestone.title}
              </span>
            </div>
            <div style={{ height: '4px', background: 'var(--surface-3)', borderRadius: '999px', marginTop: '0.3rem', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.max(0, Math.min(100, Number(nextMilestone.pct) || 0))}%`,
                  background: 'linear-gradient(90deg, var(--accent), #10b981)',
                  borderRadius: '999px',
                }}
              />
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--accent)' }}>
              {nextMilestone.pct}%
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              {nextMilestone.total - nextMilestone.solved} to go
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
          <div className="courses-spinner" style={{ margin: '0 auto 0.5rem' }} />
          Loading skills &amp; badges...
        </div>
      ) : itemsToShow.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '1.75rem 1rem',
            background: 'var(--surface-2)',
            borderRadius: '12px',
            borderTop: '1px dashed var(--border)',
            borderRight: '1px dashed var(--border)',
            borderBottom: '1px dashed var(--border)',
            borderLeft: '1px dashed var(--border)',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '0.35rem' }}>🎯</div>
          <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
            {activeTab === 'earned' ? 'No Mastered Badges Yet' : 'Start Solving to Earn Badges'}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0', maxWidth: 260, lineHeight: 1.4 }}>
            Solve 100% of questions in any roadmap topic or contest to unlock your official verified badges!
          </p>
          <Link
            href="/roadmaps"
            className="btn btn-primary btn-sm"
            style={{ marginTop: '0.85rem', fontSize: '0.76rem', fontWeight: 700 }}
          >
            Explore Roadmaps →
          </Link>
        </div>
      ) : (
        /* Dynamic Badges List (2 columns on medium/large screens) */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.6rem', flex: 1, alignContent: 'start' }}>
          {itemsToShow.map((b) => {
            const isCompleted = b.isCompleted;
            return (
              <Link
                key={b.id}
                href="/skills"
                style={{ textDecoration: 'none' }}
              >
                <div
                  style={{
                    background: 'var(--surface-2)',
                    borderTop: '1px solid var(--border)',
                    borderRight: '1px solid var(--border)',
                    borderBottom: '1px solid var(--border)',
                    borderLeft: `3px solid ${isCompleted ? 'var(--success, #10b981)' : 'var(--accent, #6366f1)'}`,
                    borderRadius: '10px',
                    padding: '0.65rem 0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.15s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.borderColor = isCompleted ? 'var(--success, #10b981)' : 'var(--accent, #6366f1)';
                    e.currentTarget.style.boxShadow = 'var(--shadow)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.borderLeftColor = isCompleted ? 'var(--success, #10b981)' : 'var(--accent, #6366f1)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  }}
                >
                  {/* Emblem Icon */}
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: '8px',
                      background: isCompleted
                        ? 'rgba(16, 185, 129, 0.1)'
                        : 'rgba(99, 102, 241, 0.1)',
                      border: `1px solid ${isCompleted ? 'rgba(16, 185, 129, 0.25)' : 'rgba(99, 102, 241, 0.25)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem',
                      flexShrink: 0,
                    }}
                  >
                    {b.badgeIcon || (isCompleted ? '🏆' : '⚡')}
                  </div>

                  {/* Title & Status */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        lineHeight: 1.25,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={b.title}
                    >
                      {b.title}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.25rem' }}>
                      {isCompleted ? (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            background: 'rgba(16, 185, 129, 0.12)',
                            color: 'var(--success, #10b981)',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            padding: '0.1rem 0.45rem',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                          }}
                        >
                          <span>✓</span> Mastered
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            background: 'rgba(99, 102, 241, 0.12)',
                            color: 'var(--accent, #6366f1)',
                            border: '1px solid rgba(99, 102, 241, 0.25)',
                            padding: '0.1rem 0.45rem',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                          }}
                        >
                          <span>⚡</span> {b.solved}/{b.total} ({Math.max(0, Math.min(100, Number(b.pct) || 0))}%)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Footer link */}
      {displayList.length > 4 && (
        <Link
          href="/skills"
          style={{
            display: 'block',
            textAlign: 'center',
            marginTop: '0.65rem',
            fontSize: '0.76rem',
            fontWeight: 700,
            color: 'var(--accent)',
            textDecoration: 'none',
            paddingTop: '0.5rem',
            borderTop: '1px solid var(--border)',
          }}
        >
          +{displayList.length - 4} more badges in library →
        </Link>
      )}
    </div>
  );
}
