'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type PlatformTab = 'all' | 'hackerrank' | 'leetcode';

function getInitials(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
  });
}

function StatusBadge({ status }: { status: string }) {
  const s = (status || 'unattempted').toLowerCase();
  if (s === 'solved') return <span className="up-status-badge solved">✅ Solved</span>;
  if (s === 'attempted') return <span className="up-status-badge attempted">⏳ Attempted</span>;
  return <span className="up-status-badge unattempted">○ Unattempted</span>;
}

function ActivityHeatmap({
  heatmap,
  batchStart,
}: {
  heatmap: Array<{ day: string; solve_count: number }>;
  batchStart: string;
}) {
  const dataMap = useMemo(() => {
    const m = new Map<string, number>();
    heatmap.forEach((h) => m.set(h.day, h.solve_count));
    return m;
  }, [heatmap]);

  const columns = useMemo(() => {
    const start = new Date(batchStart);
    const today = new Date();
    const dayOfWeek = start.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    start.setDate(start.getDate() + diff);
    const weeks: Date[][] = [];
    const cur = new Date(start);
    while (cur <= today) {
      const week: Date[] = [];
      for (let d = 0; d < 7; d++) {
        const cell = new Date(cur);
        if (cell <= today) week.push(cell);
        cur.setDate(cur.getDate() + 1);
      }
      if (week.length) weeks.push(week);
    }
    return weeks;
  }, [batchStart]);

  const toKey = (d: Date) => d.toISOString().slice(0, 10);

  const cellColor = (count: number) => {
    if (count === 0) return 'var(--surface-3)';
    if (count === 1) return 'rgba(99,102,241,0.3)';
    if (count === 2) return 'rgba(99,102,241,0.5)';
    if (count === 3) return 'rgba(99,102,241,0.7)';
    if (count === 4) return 'rgba(99,102,241,0.85)';
    return 'var(--accent)';
  };

  const totalSolves = heatmap.reduce((a, h) => a + h.solve_count, 0);
  const activeDays = heatmap.filter((h) => h.solve_count > 0).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          📅 <strong>{activeDays}</strong> active days • <strong>{totalSolves}</strong> solves since batch start
        </span>
        <div className="up-heatmap-legend">
          <span>Less</span>
          {[0,1,2,3,4,5].map((v) => (
            <div key={v} className="up-heatmap-legend-cell" style={{ background: cellColor(v) }} />
          ))}
          <span>More</span>
        </div>
      </div>
      <div className="up-heatmap-wrapper">
        <div className="up-heatmap-grid">
          {columns.map((week, wi) => (
            <div key={wi} className="up-heatmap-col">
              {week.map((day) => {
                const k = toKey(day);
                const count = dataMap.get(k) || 0;
                return (
                  <div
                    key={k}
                    className="up-heatmap-cell"
                    style={{ background: cellColor(count) }}
                    title={`${k}: ${count} solve${count !== 1 ? 's' : ''}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function UserProfileClient({
  data,
  viewerRole,
  currentUserId,
}: {
  data: any;
  viewerRole: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [platformTab, setPlatformTab] = useState<PlatformTab>('all');

  const user = data?.user || {};
  const summary = data?.summary || {};
  const leetcode = data?.leetcode || null;
  const heatmap: Array<{ day: string; solve_count: number }> = data?.heatmap || [];
  const contests: any[] = data?.contests || [];
  const batchStart: string = data?.batch_start || new Date(Date.now() - 180 * 86400000).toISOString();

  const isAdmin = viewerRole === 'admin';

  const filteredContests = useMemo(() => {
    if (platformTab === 'all') return contests;
    return contests.filter((c) => (c.platform || 'hackerrank') === platformTab);
  }, [contests, platformTab]);

  const hrCount = contests.filter((c) => (c.platform || 'hackerrank') === 'hackerrank').length;
  const lcCount = contests.filter((c) => c.platform === 'leetcode').length;

  return (
    <div className="up-page">
      {/* Back */}
      <button onClick={() => router.back()} className="up-back-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
        ← Back
      </button>

      {/* Hero Card */}
      <div className="up-hero-card">
        <div className="up-hero-banner" />
        <div className="up-hero-body">
          <div className="up-hero-avatar-row">
            <div className="up-avatar">{getInitials(user.full_name)}</div>
            {isAdmin && (
              <div className="up-hero-actions">
                <Link href={`/admin/users?edit=${user.id}`} className="btn btn-secondary btn-sm" style={{ fontSize: '0.78rem' }}>
                  ✏️ Edit Profile
                </Link>
              </div>
            )}
          </div>
          <h1 className="up-hero-name">{user.full_name || 'Unknown User'}</h1>
          <div className="up-hero-meta">
            <span className={`up-meta-pill${user.role === 'admin' ? ' role-admin' : user.role === 'manager' ? ' role-manager' : ''}`}>
              {user.role === 'admin' ? '👑 Admin' : user.role === 'manager' ? '🛡️ Manager' : '🎓 Trainer'}
            </span>
            {user.emp_id && <span className="up-meta-pill">💼 {user.emp_id}</span>}
            {user.team && <span className="up-meta-pill">🏢 {user.team}</span>}
            {user.manager && <span className="up-meta-pill">👤 {user.manager}</span>}
            {user.hackerrank_id && (
              <a className="up-meta-pill hr" href={`https://www.hackerrank.com/${user.hackerrank_id}`} target="_blank" rel="noreferrer">
                ⚡ @{user.hackerrank_id} ↗
              </a>
            )}
            {user.leetcode_id && (
              <a className="up-meta-pill lc" href={`https://leetcode.com/u/${user.leetcode_id}`} target="_blank" rel="noreferrer">
                🟠 @{user.leetcode_id} ↗
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="up-stats-grid">
        <div className="up-stat-card">
          <div className="up-stat-value" style={{ color: 'var(--success)' }}>{summary.total_solved ?? 0}</div>
          <div className="up-stat-label">Problems Solved</div>
        </div>
        <div className="up-stat-card">
          <div className="up-stat-value" style={{ color: 'var(--accent)' }}>{summary.total_score ?? 0}</div>
          <div className="up-stat-label">Total Score (pts)</div>
        </div>
        <div className="up-stat-card">
          <div className="up-stat-value">{summary.contests_participated ?? 0}</div>
          <div className="up-stat-label">Contests Joined</div>
        </div>
        <div className="up-stat-card">
          <div className="up-stat-value" style={{ color: '#ffa116' }}>
            {leetcode?.contest_rating ? Math.round(leetcode.contest_rating) : '—'}
          </div>
          <div className="up-stat-label">LC Contest Rating</div>
        </div>
        {(leetcode?.solved_total ?? 0) > 0 && (
          <div className="up-stat-card">
            <div className="up-stat-value" style={{ color: '#ffa116' }}>{leetcode.solved_total}</div>
            <div className="up-stat-label">LeetCode Solved</div>
          </div>
        )}
      </div>

      {/* Heatmap */}
      <div className="up-section-card">
        <h3 className="up-section-title">📅 Solve Activity</h3>
        {heatmap.length === 0 ? (
          <div className="up-empty">
            <div className="up-empty-icon">📉</div>
            <div>No solve activity recorded for this batch period yet.</div>
          </div>
        ) : (
          <ActivityHeatmap heatmap={heatmap} batchStart={batchStart} />
        )}
      </div>

      {/* LeetCode Stats */}
      {leetcode && (
        <div className="up-section-card">
          <h3 className="up-section-title">🟠 LeetCode Stats</h3>
          <div className="up-lc-grid">
            {[
              { label: 'Total Solved', val: leetcode.solved_total || 0, color: '#ffa116' },
              { label: '🟢 Easy', val: leetcode.solved_easy || 0, color: '#00b8a3' },
              { label: '🟡 Medium', val: leetcode.solved_medium || 0, color: '#ffc01e' },
              { label: '🔴 Hard', val: leetcode.solved_hard || 0, color: '#ff375f' },
              { label: 'Contest Rating', val: leetcode.contest_rating ? Math.round(leetcode.contest_rating) : '—', color: 'var(--accent)' },
              { label: 'Global Rank', val: leetcode.ranking ? `#${Number(leetcode.ranking).toLocaleString()}` : '—', color: 'var(--text-primary)' },
            ].map((m) => (
              <div key={m.label} className="up-lc-metric">
                <div className="up-lc-metric-value" style={{ color: m.color }}>{m.val}</div>
                <div className="up-lc-metric-label">{m.label}</div>
              </div>
            ))}
          </div>
          {leetcode.solved_total > 0 && (
            <>
              <div className="up-diff-bar">
                <div style={{ width: `${Math.round((leetcode.solved_easy / leetcode.solved_total) * 100)}%`, background: '#00b8a3' }} />
                <div style={{ width: `${Math.round((leetcode.solved_medium / leetcode.solved_total) * 100)}%`, background: '#ffc01e' }} />
                <div style={{ width: `${Math.round((leetcode.solved_hard / leetcode.solved_total) * 100)}%`, background: '#ff375f' }} />
              </div>
              <div className="up-diff-grid">
                {[
                  { label: '🟢 Easy', val: leetcode.solved_easy, color: '#00b8a3', bg: 'rgba(0,184,163,0.08)', border: 'rgba(0,184,163,0.25)' },
                  { label: '🟡 Medium', val: leetcode.solved_medium, color: '#ffc01e', bg: 'rgba(255,192,30,0.08)', border: 'rgba(255,192,30,0.25)' },
                  { label: '🔴 Hard', val: leetcode.solved_hard, color: '#ff375f', bg: 'rgba(255,55,95,0.08)', border: 'rgba(255,55,95,0.25)' },
                ].map((d) => (
                  <div key={d.label} className="up-diff-item" style={{ background: d.bg, border: `1px solid ${d.border}` }}>
                    <div style={{ fontSize: '0.7rem', color: d.color, fontWeight: 700 }}>{d.label}</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: d.color, margin: '0.1rem 0' }}>{d.val}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      {Math.round((d.val / leetcode.solved_total) * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {leetcode.last_synced_at && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.75rem', textAlign: 'right' }}>
              Last synced: {fmtDate(leetcode.last_synced_at)}
            </div>
          )}
        </div>
      )}

      {/* Contest History */}
      <div className="up-section-card">
        <h3 className="up-section-title">🏆 Contest History</h3>
        <div className="up-contest-tabs">
          {([
            { key: 'all', label: `All (${contests.length})` },
            hrCount > 0 ? { key: 'hackerrank', label: `⚡ HackerRank (${hrCount})` } : null,
            lcCount > 0 ? { key: 'leetcode', label: `🟠 LeetCode (${lcCount})` } : null,
          ] as any[]).filter(Boolean).map((t: any) => (
            <button key={t.key} className={`up-tab-btn${platformTab === t.key ? ' active' : ''}`} onClick={() => setPlatformTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {filteredContests.length === 0 ? (
          <div className="up-empty">
            <div className="up-empty-icon">🏁</div>
            <div>No contests for this filter.</div>
          </div>
        ) : (
          <div className="up-contest-list">
            {filteredContests.map((contest) => {
              const pct = contest.total_questions > 0 ? Math.round((contest.solved_count / contest.total_questions) * 100) : 0;
              const platform = contest.platform || 'hackerrank';
              const isMastered = contest.total_questions > 0 && contest.solved_count >= contest.total_questions;

              return (
                <details key={contest.id} className="up-contest-card">
                  <summary className="up-contest-summary">
                    <div className="up-contest-info">
                      <div className="up-contest-title">{contest.title}</div>
                      <div className="up-contest-meta">
                        <span className={`up-platform-badge ${platform === 'leetcode' ? 'lc' : 'hr'}`}>
                          {platform === 'leetcode' ? '🟠 LeetCode' : '⚡ HackerRank'}
                        </span>
                        <span>{fmtDate(contest.start_date)}</span>
                        {isMastered && <span style={{ color: '#10b981', fontWeight: 700 }}>100% Mastered 👑</span>}
                      </div>
                    </div>
                    <div className="up-contest-score-chip">
                      <div className="up-contest-solved">{contest.solved_count}/{contest.total_questions} solved</div>
                      <div className="up-contest-pts">{contest.score} / {contest.max_score} pts</div>
                      <div className="up-mini-progress">
                        <div className="up-mini-progress-fill" style={{
                          width: `${pct}%`,
                          background: isMastered ? 'linear-gradient(90deg,#10b981,#059669)' : 'linear-gradient(90deg,var(--accent),var(--indigo))',
                        }} />
                      </div>
                    </div>
                  </summary>

                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    {contest.questions && contest.questions.length > 0 ? (
                      <table className="up-question-table">
                        <thead>
                          <tr>
                            <th style={{ width: '38%' }}>Problem</th>
                            <th>Domain</th>
                            <th>Difficulty</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Score</th>
                            <th style={{ textAlign: 'right' }}>Last Submission</th>
                          </tr>
                        </thead>
                        <tbody>
                          {contest.questions.map((q: any) => (
                            <tr key={q.id}>
                              <td>
                                {q.hackerrank_url ? (
                                  <a href={q.hackerrank_url} target="_blank" rel="noreferrer" className="up-problem-link">
                                    {q.title} ↗
                                  </a>
                                ) : (
                                  <span className="up-problem-link">{q.title}</span>
                                )}
                              </td>
                              <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{q.domain}</td>
                              <td>
                                <span style={{
                                  fontSize: '0.72rem', fontWeight: 600,
                                  color: q.difficulty === 'Easy' ? '#00b8a3' : q.difficulty === 'Hard' ? '#ff375f' : '#ffc01e',
                                }}>
                                  {q.difficulty || 'Medium'}
                                </span>
                              </td>
                              <td><StatusBadge status={q.status} /></td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: q.score > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                                {q.score}/{q.max_score}
                              </td>
                              <td style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {fmtDate(q.last_submission_at)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        No problem data recorded yet.
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}