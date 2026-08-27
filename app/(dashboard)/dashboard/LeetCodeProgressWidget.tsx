'use client';

import { useState } from 'react';
import Link from 'next/link';

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
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTeam, setFilterTeam] = useState('All');

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
              Live verified solves &amp; profile stats
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
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem 0.6rem',
                borderRadius: 6,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: idx === 0 ? '#ffd700' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : 'var(--surface-3)',
                    color: idx < 3 ? '#000' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#ffa116' }}>
                    @{p.leetcode_id} &bull; <span style={{ color: 'var(--text-muted)' }}>{p.team || 'No Team'}</span>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '0.5rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--success)' }}>
                  {p.assigned_solved} Solved
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  LC Total: {p.solved_total}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {performers.length > 5 && (
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-ghost btn-sm"
          style={{ width: '100%', marginTop: '0.75rem', fontSize: '0.8rem', color: '#ffa116' }}
        >
          View All {performers.length} LeetCode Solvers →
        </button>
      )}

      {/* Full Modal */}
      {showModal && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal" style={{ maxWidth: 740, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                🟠 LeetCode Cohort Leaderboard ({performers.length})
              </h2>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowModal(false)}
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
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left' }}>Easy/Med/Hard</th>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left' }}>Global Rank</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPerformers.map((p, i) => (
                    <tr key={p.user_id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.6rem 0.8rem', fontWeight: 600 }}>{i + 1}</td>
                      <td style={{ padding: '0.6rem 0.8rem', fontWeight: 500 }}>{p.name}</td>
                      <td style={{ padding: '0.6rem 0.8rem', color: 'var(--text-muted)' }}>{p.team || '—'}</td>
                      <td style={{ padding: '0.6rem 0.8rem' }}>
                        <a
                          href={`https://leetcode.com/u/${p.leetcode_id}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#ffa116', fontWeight: 600, textDecoration: 'none' }}
                        >
                          @{p.leetcode_id}
                        </a>
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', fontWeight: 700, color: 'var(--success)' }}>
                        {p.assigned_solved}
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem' }}>
                        <span style={{ color: '#00b8a3', fontWeight: 600 }}>{p.solved_easy}</span> /{' '}
                        <span style={{ color: '#ffc01e', fontWeight: 600 }}>{p.solved_medium}</span> /{' '}
                        <span style={{ color: '#ff375f', fontWeight: 600 }}>{p.solved_hard}</span>
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', color: 'var(--text-muted)' }}>
                        {p.ranking ? `#${p.ranking.toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  ))}
                  {filteredPerformers.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
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
    </div>
  );
}
