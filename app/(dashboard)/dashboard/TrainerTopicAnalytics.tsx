'use client';

import { useState } from 'react';
import Link from 'next/link';

interface TopicStat {
  topicName: string;
  domain?: string;
  totalQuestions: number;
  solvedQuestions: number;
  completedTrainersCount: number;
  completionPercentage: number;
}

interface TopTrainerTopicMaster {
  id: string;
  name: string;
  team?: string;
  solved: number;
  score: number;
  completedRoadmapsCount: number;
}

interface TrainerTopicAnalyticsProps {
  topicStats: TopicStat[];
  topTrainers: TopTrainerTopicMaster[];
  totalTrainersCount: number;
}

export default function TrainerTopicAnalytics({
  topicStats,
  topTrainers,
  totalTrainersCount,
}: TrainerTopicAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<'topics' | 'leaderboard'>('topics');

  const totalMasteredBadges = topicStats.reduce((acc, curr) => acc + curr.completedTrainersCount, 0);

  return (
    <div className="widget-card" style={{ marginTop: '0.85rem' }}>
      {/* Header & Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.85rem' }}>
        <div>
          <h3 className="widget-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.98rem' }}>
            <span>📊</span> Trainer Topic Completion &amp; Skill Analytics
          </h3>
          <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Real-time analytics on topic completion rates and skill mastery across trainers
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', background: 'var(--surface-2)', padding: '0.15rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <button
            onClick={() => setActiveTab('topics')}
            style={{
              padding: '0.25rem 0.65rem',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'topics' ? 'var(--surface)' : 'transparent',
              color: activeTab === 'topics' ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: activeTab === 'topics' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            🎯 Topic Completion ({topicStats.length})
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            style={{
              padding: '0.25rem 0.65rem',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'leaderboard' ? 'var(--surface)' : 'transparent',
              color: activeTab === 'leaderboard' ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: activeTab === 'leaderboard' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            👑 Top Skill Masters ({topTrainers.length})
          </button>
        </div>
      </div>

      {/* Overview Stat Chips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.85rem' }}>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.45rem 0.65rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--accent)', lineHeight: 1 }}>{topicStats.length}</div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.15rem' }}>Tracked Topics</div>
        </div>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.45rem 0.65rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--success)', lineHeight: 1 }}>{totalMasteredBadges}</div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.15rem' }}>100% Badges Earned</div>
        </div>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.45rem 0.65rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--indigo)', lineHeight: 1 }}>{totalTrainersCount}</div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.15rem' }}>Active Trainers</div>
        </div>
      </div>

      {/* Tab 1: Topic Completion Breakdown */}
      {activeTab === 'topics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {topicStats.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              No topic completion analytics calculated yet.
            </div>
          ) : (
            topicStats.map((t, idx) => (
              <div
                key={t.topicName + idx}
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '0.55rem 0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.85rem' }}>📖</span>
                    <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {t.topicName}
                    </span>
                    {t.domain && (
                      <span style={{ fontSize: '0.65rem', background: 'var(--surface-3)', color: 'var(--text-muted)', padding: '0.1rem 0.4rem', borderRadius: '999px', fontWeight: 700 }}>
                        {t.domain}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.72rem', fontWeight: 700 }}>
                    {t.completedTrainersCount > 0 && (
                      <span style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '0.1rem 0.45rem', borderRadius: '999px' }}>
                        👑 {t.completedTrainersCount} Mastered
                      </span>
                    )}
                    <span style={{ color: 'var(--text-primary)' }}>
                      {Math.max(0, Math.min(100, Math.round(Number(t.completionPercentage) || 0)))}% Complete
                    </span>
                  </div>
                </div>

                {/* Linear Progress Bar */}
                <div style={{ height: '6px', background: 'var(--surface-3)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.max(0, Math.min(100, Math.round(Number(t.completionPercentage) || 0)))}%`,
                      background: 'linear-gradient(90deg, var(--accent) 0%, var(--success) 100%)',
                      borderRadius: '999px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  <span>{t.solvedQuestions} / {t.totalQuestions} questions solved globally</span>
                  <span>{t.completedTrainersCount} of {totalTrainersCount ?? 0} trainers finished</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Top Skill Masters Leaderboard */}
      {activeTab === 'leaderboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {topTrainers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              No trainer topic completion records found.
            </div>
          ) : (
            topTrainers.slice(0, 5).map((trainer, idx) => {
              const rankMedal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
              return (
                <div
                  key={trainer.id}
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '0.5rem 0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, width: 24, textAlign: 'center', flexShrink: 0 }}>
                      {rankMedal}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {trainer.name}
                      </div>
                      {trainer.team && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Team: {trainer.team}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.72rem', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '0.1rem 0.5rem', borderRadius: '999px', fontWeight: 800 }}>
                      👑 {trainer.completedRoadmapsCount} Topics Mastered
                    </span>
                    <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--accent)' }}>
                      {trainer.solved} Solved
                    </span>
                  </div>
                </div>
              );
            })
          )}

          <Link
            href="/admin/roadmaps"
            style={{
              display: 'block',
              textAlign: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--accent)',
              textDecoration: 'none',
              marginTop: '0.35rem',
              paddingTop: '0.35rem',
              borderTop: '1px dashed var(--border)',
            }}
          >
            Manage Topic Roadmaps &amp; Assignments →
          </Link>
        </div>
      )}
    </div>
  );
}
