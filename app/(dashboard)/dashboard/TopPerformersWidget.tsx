'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface Performer {
  user_id: string;
  name: string;
  emp_id: string;
  team: string;
  score: number;
  solved: number;
  rank?: number;
}

interface TopPerformersWidgetProps {
  performers: Performer[];
  currentUserId?: string;
}

export default function TopPerformersWidget({ performers, currentUserId }: TopPerformersWidgetProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTeam, setFilterTeam] = useState('All');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto refresh every 30 seconds to sync live scrape progress automatically
  useEffect(() => {
    const timer = setInterval(() => {
      router.refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, [router]);

  const handleManualRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  // Attach rank to performers
  const rankedPerformers = performers.map((p, idx) => ({
    ...p,
    rank: idx + 1,
  }));

  const top5 = rankedPerformers.slice(0, 5);

  // Teams list for modal filter
  const teams = ['All', ...Array.from(new Set(performers.map(p => p.team).filter(t => t && t !== 'N/A')))];

  // Filtered performers for modal
  const filteredPerformers = rankedPerformers.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.emp_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.team.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTeam = filterTeam === 'All' || p.team === filterTeam;
    return matchesSearch && matchesTeam;
  });

  const currentUserRank = rankedPerformers.find(p => p.user_id === currentUserId);

  return (
    <>
      {/* ── Dashboard Widget Card ────────────────────────────────────────── */}
      <div
        className="widget-card"
        style={{ flex: 1, cursor: 'pointer', position: 'relative' }}
        onClick={() => setShowModal(true)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className="widget-title" style={{ margin: 0 }}>
            <span style={{ fontSize: '1.2rem', marginRight: '0.4rem' }}>🏆</span>
            Top Performers
          </h3>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button
              onClick={handleManualRefresh}
              title="Refresh Live Data"
              style={{
                background: 'var(--surface-3)', border: '1px solid var(--border)',
                borderRadius: '50%', width: 26, height: 26, color: 'var(--text-secondary)',
                fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', transition: 'transform 0.3s ease',
                transform: isRefreshing ? 'rotate(360deg)' : 'none',
              }}
            >
              🔄
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowModal(true);
              }}
              style={{
                background: 'var(--surface-3)', border: '1px solid var(--border)',
                borderRadius: '999px', padding: '0.2rem 0.65rem', color: 'var(--accent)',
                fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              View All ({performers.length}) →
            </button>
          </div>
        </div>

        {top5.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>🌟</div>
            No performer data recorded yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {top5.map((p) => {
              const isCurrentUser = p.user_id === currentUserId;
              const rankBadgeBg =
                p.rank === 1 ? 'linear-gradient(135deg, #f59e0b, #d97706)' :
                p.rank === 2 ? 'linear-gradient(135deg, #94a3b8, #64748b)' :
                p.rank === 3 ? 'linear-gradient(135deg, #b45309, #78350f)' :
                'var(--surface-3)';

              return (
                <div
                  key={p.user_id}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.65rem 0.85rem', borderRadius: 'var(--radius)',
                    background: isCurrentUser ? 'rgba(99, 102, 241, 0.08)' : 'var(--surface-2)',
                    border: isCurrentUser ? '1px solid var(--accent)' : '1px solid var(--border)',
                    transition: 'transform 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                    {/* Rank Badge */}
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', background: rankBadgeBg,
                      color: p.rank! <= 3 ? '#fff' : 'var(--text-secondary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: '0.75rem', flexShrink: 0,
                    }}>
                      {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : `#${p.rank}`}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                      }}>
                        <span>{p.name}</span>
                        {isCurrentUser && (
                          <span style={{ fontSize: '0.65rem', background: 'var(--accent)', color: '#fff', padding: '0.05rem 0.35rem', borderRadius: '999px', fontWeight: 700 }}>
                            YOU
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {p.emp_id} &bull; {p.team}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '0.5rem' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--accent)' }}>
                      {p.score} pts
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {p.solved} solved
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {currentUserRank && currentUserRank.rank! > 5 && (
          <div style={{
            marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)',
            background: 'var(--surface-3)', fontSize: '0.75rem', color: 'var(--text-secondary)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>Your Global Position: <strong>#{currentUserRank.rank}</strong> ({currentUserRank.score} pts)</span>
            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>View Leaderboard →</span>
          </div>
        )}
      </div>

      {/* ── Global Top Performers Modal ─────────────────────────────────────── */}
      {showModal && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '1rem',
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '16px', maxWidth: '720px', width: '100%',
              maxHeight: '88vh', display: 'flex', flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--surface-2)',
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🏆</span> Portal Global Leaderboard
                </h2>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Live aggregate rankings across all contest questions &amp; roadmaps ({performers.length} total participants)
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'var(--surface-3)', border: 'none', borderRadius: '50%',
                  width: 32, height: 32, cursor: 'pointer', color: 'var(--text-secondary)',
                  fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Filters & Search Bar */}
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.75rem', background: 'var(--surface)' }}>
              <input
                type="text"
                placeholder="Search user by name, emp ID, or team..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  flex: 1, padding: '0.55rem 0.85rem', borderRadius: '8px',
                  border: '1px solid var(--border)', background: 'var(--surface-2)',
                  color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none',
                }}
              />

              <select
                value={filterTeam}
                onChange={(e) => setFilterTeam(e.target.value)}
                style={{
                  padding: '0.55rem 0.85rem', borderRadius: '8px',
                  border: '1px solid var(--border)', background: 'var(--surface-2)',
                  color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {teams.map(t => (
                  <option key={t} value={t}>Team: {t}</option>
                ))}
              </select>
            </div>

            {/* Modal Body: Full Table */}
            <div style={{ padding: '0.5rem 1.5rem 1.5rem 1.5rem', overflowY: 'auto', flex: 1 }}>
              {filteredPerformers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
                  No matching participants found.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '0.65rem 0.5rem', width: 60 }}>Rank</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>Participant</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>Emp ID</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>Team</th>
                      <th style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>Questions Solved</th>
                      <th style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>Total Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPerformers.map((p) => {
                      const isCurrentUser = p.user_id === currentUserId;
                      return (
                        <tr
                          key={p.user_id}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            background: isCurrentUser ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                            fontWeight: isCurrentUser ? 700 : 400,
                          }}
                        >
                          <td style={{ padding: '0.65rem 0.5rem' }}>
                            <span style={{
                              fontWeight: 800,
                              color: p.rank === 1 ? '#f59e0b' : p.rank === 2 ? '#94a3b8' : p.rank === 3 ? '#b45309' : 'var(--text-muted)',
                            }}>
                              {p.rank === 1 ? '🥇 #1' : p.rank === 2 ? '🥈 #2' : p.rank === 3 ? '🥉 #3' : `#${p.rank}`}
                            </span>
                          </td>

                          <td style={{ padding: '0.65rem 0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{p.name}</span>
                              {isCurrentUser && (
                                <span style={{ fontSize: '0.65rem', background: 'var(--accent)', color: '#fff', padding: '0.05rem 0.35rem', borderRadius: '999px', fontWeight: 700 }}>
                                  YOU
                                </span>
                              )}
                            </div>
                          </td>

                          <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-muted)' }}>
                            {p.emp_id}
                          </td>

                          <td style={{ padding: '0.65rem 0.5rem' }}>
                            <span style={{ fontSize: '0.72rem', background: 'var(--surface-3)', padding: '0.15rem 0.45rem', borderRadius: '999px', color: 'var(--text-secondary)' }}>
                              {p.team}
                            </span>
                          </td>

                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                            {p.solved}
                          </td>

                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', fontWeight: 800, color: 'var(--accent)' }}>
                            {p.score} pts
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '0.85rem 1.5rem', borderTop: '1px solid var(--border)',
              background: 'var(--surface-2)', display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)',
            }}>
              <span>Showing {filteredPerformers.length} of {performers.length} participants</span>
              <button
                onClick={() => setShowModal(false)}
                className="btn btn-secondary btn-sm"
              >
                Close Leaderboard
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
