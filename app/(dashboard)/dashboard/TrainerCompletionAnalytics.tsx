'use client';

import { useState } from 'react';
import Link from 'next/link';

export interface ContestCompletionStat {
  contestId: string;
  title: string;
  slug: string;
  questionCount: number;
  assignedTrainersCount: number;
  completedTrainersCount: number;
  completionPercentage: number;
}

export interface RoadmapCompletionStat {
  roadmapId: string;
  title: string;
  domain: string;
  level: string;
  totalTopics: number;
  assignedTrainersCount: number;
  completedTrainersCount: number;
  completionPercentage: number;
}

export interface TopTrainerCompletionMaster {
  id: string;
  name: string;
  team?: string;
  solved: number;
  score: number;
  completedContestsCount: number;
  completedRoadmapsCount: number;
}

interface TrainerCompletionAnalyticsProps {
  contestStats: ContestCompletionStat[];
  roadmapStats: RoadmapCompletionStat[];
  topTrainers: TopTrainerCompletionMaster[];
  totalTrainersCount: number;
}

export default function TrainerCompletionAnalytics({
  contestStats,
  roadmapStats,
  topTrainers,
  totalTrainersCount,
}: TrainerCompletionAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<'contests' | 'roadmaps' | 'leaderboard'>('contests');

  const totalContestsMastered = contestStats.reduce((acc, curr) => acc + curr.completedTrainersCount, 0);
  const totalRoadmapsMastered = roadmapStats.reduce((acc, curr) => acc + curr.completedTrainersCount, 0);

  return (
    <div className="widget-card" style={{ marginTop: '0.85rem' }}>
      {/* Header & Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.85rem' }}>
        <div>
          <h3 className="widget-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.98rem' }}>
            <span>📊</span> Trainer Completion Analytics &amp; Mastery
          </h3>
          <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Real-time contest and roadmap completion metrics across all trainers
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', background: 'var(--surface-2)', padding: '0.15rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <button
            onClick={() => setActiveTab('contests')}
            style={{
              padding: '0.25rem 0.6rem',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'contests' ? 'var(--surface)' : 'transparent',
              color: activeTab === 'contests' ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: activeTab === 'contests' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            🏆 Contests ({contestStats.length})
          </button>

          <button
            onClick={() => setActiveTab('roadmaps')}
            style={{
              padding: '0.25rem 0.6rem',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'roadmaps' ? 'var(--surface)' : 'transparent',
              color: activeTab === 'roadmaps' ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: activeTab === 'roadmaps' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            🗺️ Roadmaps ({roadmapStats.length})
          </button>

          <button
            onClick={() => setActiveTab('leaderboard')}
            style={{
              padding: '0.25rem 0.6rem',
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
            👑 Leaderboard
          </button>
        </div>
      </div>

      {/* Summary Stat Chips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.85rem' }}>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.45rem 0.65rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--accent)', lineHeight: 1 }}>{totalContestsMastered}</div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.15rem' }}>Contests Mastered</div>
        </div>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.45rem 0.65rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--success)', lineHeight: 1 }}>{totalRoadmapsMastered}</div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.15rem' }}>Roadmaps Mastered</div>
        </div>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.45rem 0.65rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--indigo)', lineHeight: 1 }}>{totalTrainersCount}</div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.15rem' }}>Active Trainers</div>
        </div>
      </div>

      {/* Tab 1: Contest Completion Analytics */}
      {activeTab === 'contests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {contestStats.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              No contest completion data available.
            </div>
          ) : (
            contestStats.map((c) => (
              <div
                key={c.contestId}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                    <span style={{ fontSize: '0.85rem' }}>🏆</span>
                    <Link
                      href={`/contests/${c.contestId}`}
                      style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {c.title}
                    </Link>
                    <code style={{ fontSize: '0.65rem', color: 'var(--accent)', background: 'var(--surface-3)', padding: '0.1rem 0.4rem', borderRadius: 4 }}>
                      {c.slug}
                    </code>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 }}>
                    {c.completedTrainersCount > 0 && (
                      <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '0.1rem 0.45rem', borderRadius: '999px' }}>
                        👑 {c.completedTrainersCount} Finished 100%
                      </span>
                    )}
                    <span style={{ color: 'var(--text-primary)' }}>{c.completionPercentage}% Avg</span>
                  </div>
                </div>

                {/* Linear Progress Bar */}
                <div style={{ height: '6px', background: 'var(--surface-3)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${c.completionPercentage}%`,
                      background: 'linear-gradient(90deg, var(--accent) 0%, var(--success) 100%)',
                      borderRadius: '999px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  <span>💡 {c.questionCount} Questions in Contest</span>
                  <span>{c.completedTrainersCount} of {c.assignedTrainersCount || totalTrainersCount} trainers completed</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Roadmap Completion Analytics */}
      {activeTab === 'roadmaps' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {roadmapStats.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              No roadmap completion data available.
            </div>
          ) : (
            roadmapStats.map((r) => (
              <div
                key={r.roadmapId}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                    <span style={{ fontSize: '0.85rem' }}>🗺️</span>
                    <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.title}
                    </span>
                    <span style={{ fontSize: '0.65rem', background: 'var(--surface-3)', color: 'var(--indigo)', padding: '0.1rem 0.4rem', borderRadius: '999px', fontWeight: 700 }}>
                      {r.domain || 'DSA'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 }}>
                    {r.completedTrainersCount > 0 && (
                      <span style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '0.1rem 0.45rem', borderRadius: '999px' }}>
                        👑 {r.completedTrainersCount} Finished 100%
                      </span>
                    )}
                    <span style={{ color: 'var(--text-primary)' }}>{r.completionPercentage}% Avg</span>
                  </div>
                </div>

                {/* Linear Progress Bar */}
                <div style={{ height: '6px', background: 'var(--surface-3)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${r.completionPercentage}%`,
                      background: 'linear-gradient(90deg, var(--indigo) 0%, var(--success) 100%)',
                      borderRadius: '999px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  <span>💡 {r.totalTopics} Questions in Roadmap</span>
                  <span>{r.completedTrainersCount} of {r.assignedTrainersCount} trainers completed</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Top Master Trainers Leaderboard */}
      {activeTab === 'leaderboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {topTrainers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              No completion records found.
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.72rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '0.1rem 0.45rem', borderRadius: '999px', fontWeight: 800 }}>
                      🏆 {trainer.completedContestsCount} Contests
                    </span>
                    <span style={{ fontSize: '0.72rem', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '0.1rem 0.45rem', borderRadius: '999px', fontWeight: 800 }}>
                      🗺️ {trainer.completedRoadmapsCount} Roadmaps
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
