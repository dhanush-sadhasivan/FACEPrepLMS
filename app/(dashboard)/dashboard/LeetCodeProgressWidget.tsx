'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export interface LeetCodePerformer {
  user_id: string;
  name: string;
  emp_id: string;
  team: string;
  leetcode_id: string;
  solved_easy: number;
  solved_medium: number;
  solved_hard: number;
  solved_total: number;
  ranking: number | null;
  contest_rating?: number | null;
  submission_calendar?: Record<string, number> | null;
  assigned_solved: number;
  last_synced_at: string | null;
}

interface LeetCodeProgressWidgetProps {
  performers: LeetCodePerformer[];
  totalAssignedProblems: number;
  activeTracksCount: number;
}

export default function LeetCodeProgressWidget({
  performers,
  totalAssignedProblems,
  activeTracksCount,
}: LeetCodeProgressWidgetProps) {
  const router = useRouter();
  const [showAllModal, setShowAllModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<LeetCodePerformer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTeam, setFilterTeam] = useState('All');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const top5 = performers.slice(0, 5);
  const teams = ['All', ...Array.from(new Set(performers.map((p) => p.team).filter((t) => t && t !== 'N/A')))];

  const filteredPerformers = performers.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.leetcode_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.team.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.emp_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTeam = filterTeam === 'All' || p.team === filterTeam;
    return matchesSearch && matchesTeam;
  });

  const handleSyncUser = async (userId: string) => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await fetch('/api/leetcode/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncFeedback({ type: 'error', message: data.error || 'Failed to sync LeetCode data' });
      } else {
        setSyncFeedback({
          type: 'success',
          message: `Synced! ${data.stats?.solved?.total || 0} total problems solved on LeetCode.`,
        });
        if (data.stats && selectedUser) {
          setSelectedUser({
            ...selectedUser,
            solved_easy: data.stats.solved.easy,
            solved_medium: data.stats.solved.medium,
            solved_hard: data.stats.solved.hard,
            solved_total: data.stats.solved.total,
            ranking: data.stats.ranking,
            contest_rating: data.stats.contestRating,
            submission_calendar: data.stats.submissionCalendar,
            last_synced_at: new Date().toISOString(),
          });
        }
        router.refresh();
      }
    } catch (err: any) {
      setSyncFeedback({ type: 'error', message: err.message || 'Network error syncing LeetCode' });
    } finally {
      setIsSyncing(false);
    }
  };

  const getCalendarStats = (cal?: Record<string, number> | null) => {
    if (!cal || typeof cal !== 'object') return { activeDays: 0, totalSubmissions: 0 };
    const entries = Object.entries(cal);
    const activeDays = entries.length;
    const totalSubmissions = entries.reduce((acc, [, val]) => acc + (Number(val) || 0), 0);
    return { activeDays, totalSubmissions };
  };

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '1.25rem',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.25rem' }}>🟠</span>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              LeetCode Progress
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Live verified solves &amp; profile stats &bull; Click user for breakdown
            </span>
          </div>
        </div>
        <Link href="/contests/new" className="btn btn-secondary btn-sm" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}>
          + New Track
        </Link>
      </div>

      {/* Mini Stats Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.5rem',
          marginBottom: '1rem',
          background: 'var(--surface-2)',
          padding: '0.75rem',
          borderRadius: 8,
          border: '1px solid var(--border)',
          textAlign: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffa116' }}>{performers.length}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Participants</div>
        </div>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent)' }}>{activeTracksCount}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Active Tracks</div>
        </div>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--success)' }}>
            {performers.reduce((sum, p) => sum + (p.assigned_solved || 0), 0)}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Track Solves</div>
        </div>
      </div>

      {/* Performers List */}
      {performers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          No users with LeetCode ID configured yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {top5.map((p, idx) => (
            <div
              key={p.user_id}
              onClick={() => {
                setSelectedUser(p);
                setSyncFeedback(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.55rem 0.75rem',
                borderRadius: 8,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.background = 'var(--surface-3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.background = 'var(--surface-2)';
              }}
              title="Click to view detailed LeetCode profile analytics"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: idx === 0 ? '#ffd700' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : 'var(--surface-3)',
                    color: idx < 3 ? '#000' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>{p.name}</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>({p.emp_id})</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#ffa116' }}>
                    @{p.leetcode_id} &bull; <span style={{ color: 'var(--text-muted)' }}>{p.team || 'No Team'}</span>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '0.5rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--success)' }}>
                  {p.assigned_solved} Track Solves
                </div>
                <div style={{ fontSize: '0.72rem', color: '#ffa116', fontWeight: 600 }}>
                  🏆 {p.solved_total} LC Solved 🔍
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {performers.length > 5 && (
        <button
          onClick={() => setShowAllModal(true)}
          className="btn btn-ghost btn-sm"
          style={{ width: '100%', marginTop: '0.75rem', fontSize: '0.8rem', color: '#ffa116' }}
        >
          View All {performers.length} LeetCode Solvers →
        </button>
      )}

      {/* ── 1. Full Cohort Modal ────────────────────────────────────────── */}
      {showAllModal && (
        <div
          data-testid="leetcode-cohort-modal"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={() => setShowAllModal(false)}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              maxWidth: 780,
              width: '100%',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)',
              padding: '1.25rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🟠</span> LeetCode Cohort Leaderboard ({performers.length})
              </h2>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowAllModal(false)}
                style={{ fontSize: '1.2rem', padding: '0.2rem 0.5rem' }}
              >
                ✕
              </button>
            </div>

            {/* Filter controls */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
              <input
                type="text"
                className="input"
                placeholder="Search participant or LeetCode handle..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ flex: 1 }}
              />
              <select
                className="select"
                value={filterTeam}
                onChange={(e) => setFilterTeam(e.target.value)}
                style={{ width: 140 }}
              >
                {teams.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Table */}
            <div style={{ overflowY: 'auto', flex: 1, border: '1px solid var(--border)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left' }}>Rank</th>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left' }}>Name</th>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left' }}>Team</th>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left' }}>LeetCode Handle</th>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left' }}>Track Solves</th>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left' }}>Total LC Solved</th>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left' }}>Easy/Med/Hard</th>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPerformers.map((p, i) => (
                    <tr
                      key={p.user_id}
                      style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedUser(p);
                        setSyncFeedback(null);
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '0.6rem 0.8rem', fontWeight: 600 }}>{i + 1}</td>
                      <td style={{ padding: '0.6rem 0.8rem', fontWeight: 500 }}>
                        <div>{p.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.emp_id}</div>
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', color: 'var(--text-muted)' }}>{p.team || '—'}</td>
                      <td style={{ padding: '0.6rem 0.8rem' }}>
                        <span style={{ color: '#ffa116', fontWeight: 600 }}>@{p.leetcode_id}</span>
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', fontWeight: 700, color: 'var(--success)' }}>
                        {p.assigned_solved}
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', fontWeight: 700, color: '#ffa116' }}>
                        {p.solved_total}
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem' }}>
                        <span style={{ color: '#00b8a3', fontWeight: 600 }}>{p.solved_easy}</span> /{' '}
                        <span style={{ color: '#ffc01e', fontWeight: 600 }}>{p.solved_medium}</span> /{' '}
                        <span style={{ color: '#ff375f', fontWeight: 600 }}>{p.solved_hard}</span>
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUser(p);
                            setSyncFeedback(null);
                          }}
                        >
                          View Details 🔍
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredPerformers.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No matching participants found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. Detailed LeetCode User Analytics Modal ────────────────────── */}
      {selectedUser && (
        <div
          data-testid="leetcode-user-detail-modal"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem',
          }}
          onClick={() => setSelectedUser(null)}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              maxWidth: 580,
              width: '100%',
              borderRadius: 16,
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #ffa116, #d97706)',
                    color: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    fontWeight: 900,
                    boxShadow: '0 4px 12px rgba(255, 161, 22, 0.3)',
                  }}
                >
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    {selectedUser.name}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', background: 'var(--surface-3)', padding: '0.1rem 0.45rem', borderRadius: 999, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      ID: {selectedUser.emp_id}
                    </span>
                    <span style={{ fontSize: '0.75rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--indigo)', padding: '0.1rem 0.45rem', borderRadius: 999, fontWeight: 600 }}>
                      {selectedUser.team}
                    </span>
                    <a
                      href={`https://leetcode.com/u/${selectedUser.leetcode_id}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: '0.75rem',
                        color: '#ffa116',
                        fontWeight: 700,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                      }}
                    >
                      @{selectedUser.leetcode_id} ↗
                    </a>
                  </div>
                </div>
              </div>

              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setSelectedUser(null)}
                style={{ fontSize: '1.2rem', padding: '0.2rem 0.5rem', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            {/* Sync Feedback Toast */}
            {syncFeedback && (
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: 8,
                  fontSize: '0.82rem',
                  background: syncFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  border: syncFeedback.type === 'success' ? '1px solid var(--success)' : '1px solid var(--error)',
                  color: syncFeedback.type === 'success' ? 'var(--success)' : 'var(--error)',
                }}
              >
                {syncFeedback.type === 'success' ? '✅' : '⚠️'} {syncFeedback.message}
              </div>
            )}

            {/* 4 Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
              <div
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '0.85rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                  Total LC Solved
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ffa116', margin: '0.2rem 0 0' }}>
                  {selectedUser.solved_total}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Verified problems</div>
              </div>

              <div
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '0.85rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                  Contest Track Solves
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--success)', margin: '0.2rem 0 0' }}>
                  {selectedUser.assigned_solved}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>LMS Track Match</div>
              </div>

              <div
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '0.85rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                  Global Ranking
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.4rem 0 0' }}>
                  {selectedUser.ranking ? `#${selectedUser.ranking.toLocaleString()}` : '—'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Worldwide LeetCode</div>
              </div>

              <div
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '0.85rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                  Contest Rating
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)', margin: '0.4rem 0 0' }}>
                  {selectedUser.contest_rating ? Math.round(selectedUser.contest_rating) : 'Unrated'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Contest Score</div>
              </div>
            </div>

            {/* Problem Difficulty Breakdown */}
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.65rem' }}>
                Difficulty Distribution
              </div>

              {/* Stacked Progress Bar */}
              {selectedUser.solved_total > 0 && (
                <div style={{ width: '100%', height: 8, background: 'var(--surface-3)', borderRadius: 999, display: 'flex', overflow: 'hidden', marginBottom: '0.85rem' }}>
                  <div
                    style={{
                      width: `${Math.round((selectedUser.solved_easy / selectedUser.solved_total) * 100)}%`,
                      background: '#00b8a3',
                      transition: 'width 0.3s ease',
                    }}
                    title={`Easy: ${selectedUser.solved_easy}`}
                  />
                  <div
                    style={{
                      width: `${Math.round((selectedUser.solved_medium / selectedUser.solved_total) * 100)}%`,
                      background: '#ffc01e',
                      transition: 'width 0.3s ease',
                    }}
                    title={`Medium: ${selectedUser.solved_medium}`}
                  />
                  <div
                    style={{
                      width: `${Math.round((selectedUser.solved_hard / selectedUser.solved_total) * 100)}%`,
                      background: '#ff375f',
                      transition: 'width 0.3s ease',
                    }}
                    title={`Hard: ${selectedUser.solved_hard}`}
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                <div style={{ background: 'rgba(0, 184, 163, 0.08)', border: '1px solid rgba(0, 184, 163, 0.25)', borderRadius: 8, padding: '0.5rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#00b8a3', fontWeight: 700 }}>🟢 Easy</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#00b8a3', margin: '0.1rem 0' }}>
                    {selectedUser.solved_easy}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    {selectedUser.solved_total > 0 ? Math.round((selectedUser.solved_easy / selectedUser.solved_total) * 100) : 0}% of solves
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 192, 30, 0.08)', border: '1px solid rgba(255, 192, 30, 0.25)', borderRadius: 8, padding: '0.5rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#ffc01e', fontWeight: 700 }}>🟡 Medium</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ffc01e', margin: '0.1rem 0' }}>
                    {selectedUser.solved_medium}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    {selectedUser.solved_total > 0 ? Math.round((selectedUser.solved_medium / selectedUser.solved_total) * 100) : 0}% of solves
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 55, 95, 0.08)', border: '1px solid rgba(255, 55, 95, 0.25)', borderRadius: 8, padding: '0.5rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#ff375f', fontWeight: 700 }}>🔴 Hard</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ff375f', margin: '0.1rem 0' }}>
                    {selectedUser.solved_hard}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    {selectedUser.solved_total > 0 ? Math.round((selectedUser.solved_hard / selectedUser.solved_total) * 100) : 0}% of solves
                  </div>
                </div>
              </div>
            </div>

            {/* Activity & Sync Meta */}
            {(() => {
              const { activeDays, totalSubmissions } = getCalendarStats(selectedUser.submission_calendar);
              return (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0 0.25rem' }}>
                  <span>
                    📅 <strong>{activeDays}</strong> Active Submission Days ({totalSubmissions} total logged)
                  </span>
                  <span>
                    Synced:{' '}
                    <strong>
                      {selectedUser.last_synced_at
                        ? new Date(selectedUser.last_synced_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Never'}
                    </strong>
                  </span>
                </div>
              );
            })()}

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.25rem', flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleSyncUser(selectedUser.user_id)}
                disabled={isSyncing}
                style={{ fontSize: '0.8rem' }}
              >
                {isSyncing ? '🔄 Syncing...' : '⟳ Re-sync Stats'}
              </button>
              <a
                href={`https://leetcode.com/u/${selectedUser.leetcode_id}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary btn-sm"
                style={{ fontSize: '0.8rem', background: '#ffa116', borderColor: '#ffa116', color: '#000', fontWeight: 700 }}
              >
                Open LeetCode Profile ↗
              </a>
              <Link
                href={`/users/${selectedUser.user_id}`}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.8rem' }}
                onClick={() => setSelectedUser(null)}
              >
                View Full Profile →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
