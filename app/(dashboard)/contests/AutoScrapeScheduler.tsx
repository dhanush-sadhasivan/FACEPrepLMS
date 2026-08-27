'use client';

import { useState, useEffect, useCallback } from 'react';
import AutoScrapeConfigModal from './AutoScrapeConfigModal';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Contest {
  id: string;
  title: string;
  hackerrank_slug: string;
  platform?: string;
  start_date: string;
  end_date: string;
}

interface Schedule {
  id: string;
  contest_id: string;
  date: string;
  is_running: boolean;
  active_job_id: string | null;
  last_triggered_at: string | null;
  contests: Contest;
}

interface AutoScrapeSchedulerProps {
  /** All contests available to add to today's schedule */
  allContests: Contest[];
}

export default function AutoScrapeScheduler({ allContests }: AutoScrapeSchedulerProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [allowedDays, setAllowedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [loading, setLoading] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // contestId being acted on
  const [expanded, setExpanded] = useState(true);

  // ── Load schedule + config ─────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [schedRes, configRes] = await Promise.all([
        fetch('/api/scrape/auto-schedule'),
        fetch('/api/scrape/auto-config'),
      ]);
      if (schedRes.ok) {
        const d = await schedRes.json();
        setSchedules(d.schedules || []);
      }
      if (configRes.ok) {
        const d = await configRes.json();
        setAllowedDays(d.allowed_days || [1, 2, 3, 4, 5]);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Poll every 30s to keep is_running + last_triggered_at fresh
    const interval = setInterval(loadData, 30_000);
    return () => clearInterval(interval);
  }, [loadData]);

  // ── Today's IST weekday name ────────────────────────────────────────────────
  const todayDOW = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', weekday: 'long' });
  const todayDOWIdx = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    .findIndex((d) => d === todayDOW);
  const isTodayEnabled = allowedDays.includes(todayDOWIdx);

  // ── Already-scheduled contest IDs ──────────────────────────────────────────
  const scheduledIds = new Set(schedules.map((s) => s.contest_id));

  // ── Add contest to today's schedule ────────────────────────────────────────
  const handleAdd = async (contestId: string) => {
    setActionLoading(contestId);
    try {
      const res = await fetch('/api/scrape/auto-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contestId }),
      });
      if (res.ok) await loadData();
    } finally {
      setActionLoading(null);
    }
  };

  // ── Remove contest from today's schedule ────────────────────────────────────
  const handleRemove = async (contestId: string) => {
    setActionLoading(contestId);
    try {
      const res = await fetch(`/api/scrape/auto-schedule?contestId=${contestId}`, { method: 'DELETE' });
      if (res.ok) setSchedules((prev) => prev.filter((s) => s.contest_id !== contestId));
    } finally {
      setActionLoading(null);
    }
  };

  // ── Stop ongoing scrape job ─────────────────────────────────────────────────
  const handleStopJob = async (contestId: string) => {
    if (!confirm('Stop the ongoing scrape for this contest? The current Railway job will finish on its own, but the next cron tick will skip it.')) return;
    setActionLoading(contestId);
    try {
      await fetch(`/api/scrape/auto-cron/cancel?contestId=${contestId}`, { method: 'DELETE' });
      await loadData();
    } finally {
      setActionLoading(null);
    }
  };

  // ── Available contests to add (not yet in today's schedule) ────────────────
  const available = allContests.filter((c) => !scheduledIds.has(c.id));

  // ── Next run countdown ─────────────────────────────────────────────────────
  const getNextRunLabel = () => {
    const now = new Date();
    const minuteIST = parseInt(
      new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', minute: '2-digit' })
    );
    const minsToNext = minuteIST < 30 ? 30 - minuteIST : 60 - minuteIST;
    return `~${minsToNext} min`;
  };

  return (
    <>
      {/* ── Panel ─────────────────────────────────────────────────────────── */}
      <div className="auto-scrape-panel">
        {/* Header */}
        <div className="auto-scrape-header" onClick={() => setExpanded((v) => !v)} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <span style={{ fontSize: '1.1rem' }}>⏰</span>
            <div>
              <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                Auto-Scrape Scheduler
              </span>
              <span style={{
                marginLeft: '0.5rem', fontSize: '0.7rem', fontWeight: 700,
                padding: '0.1rem 0.45rem', borderRadius: 999,
                background: isTodayEnabled ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.1)',
                color: isTodayEnabled ? 'var(--success)' : '#ef4444',
                border: `1px solid ${isTodayEnabled ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}>
                {isTodayEnabled ? `● ON • ${todayDOW}` : `✕ OFF • ${todayDOW}`}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isTodayEnabled && schedules.length > 0 && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Next run in {getNextRunLabel()}
              </span>
            )}
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '0.76rem' }}
              onClick={(e) => { e.stopPropagation(); setShowConfigModal(true); }}
            >
              ⚙️ Configure Days
            </button>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {expanded ? '▲' : '▼'}
            </span>
          </div>
        </div>

        {/* Body */}
        {expanded && (
          <div className="auto-scrape-body">
            {loading ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', padding: '0.5rem 0' }}>
                Loading schedule...
              </div>
            ) : (
              <>
                {/* Scheduled contests */}
                <div style={{ marginBottom: schedules.length > 0 ? '0.85rem' : 0 }}>
                  {schedules.length === 0 ? (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No contests selected for today. Add from the list below.
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.45rem' }}>
                        Today's Schedule ({schedules.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                        {schedules.map((s) => (
                          <div key={s.id} className="auto-scrape-contest-row">
                            {/* Status indicator */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flex: 1, minWidth: 0 }}>
                              <span style={{
                                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                background: s.is_running ? 'var(--success)' : 'var(--text-muted)',
                                boxShadow: s.is_running ? '0 0 6px var(--success)' : 'none',
                                animation: s.is_running ? 'pulse 1.5s infinite' : 'none',
                              }} />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                  <span style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    padding: '0.08rem 0.35rem',
                                    borderRadius: 4,
                                    background: s.contests?.platform === 'leetcode' ? 'rgba(255, 161, 22, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                    color: s.contests?.platform === 'leetcode' ? '#ffa116' : '#3b82f6',
                                    border: `1px solid ${s.contests?.platform === 'leetcode' ? 'rgba(255, 161, 22, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                                  }}>
                                    {s.contests?.platform === 'leetcode' ? 'LeetCode' : 'HackerRank'}
                                  </span>
                                  <span style={{ fontWeight: 700, fontSize: '0.83rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {s.contests?.title || s.contest_id}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                  {s.is_running
                                    ? (s.contests?.platform === 'leetcode' ? '🟠 Syncing LeetCode in progress...' : '🔴 Scraping in progress...')
                                    : s.last_triggered_at
                                    ? `Last run: ${new Date(s.last_triggered_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} IST`
                                    : 'Not yet triggered today'}
                                </div>
                              </div>
                            </div>

                            {/* Action buttons */}
                            <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                              {s.is_running && (
                                <button
                                  className="btn btn-sm"
                                  style={{ fontSize: '0.72rem', background: '#ef4444', color: '#fff', border: 'none', minWidth: 72 }}
                                  onClick={() => handleStopJob(s.contest_id)}
                                  disabled={actionLoading === s.contest_id}
                                >
                                  {actionLoading === s.contest_id ? '...' : '⏹ Stop Job'}
                                </button>
                              )}
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: '0.72rem', color: '#ef4444' }}
                                onClick={() => handleRemove(s.contest_id)}
                                disabled={actionLoading === s.contest_id || s.is_running}
                                title={s.is_running ? 'Stop the job first before removing' : 'Remove from today\'s schedule'}
                              >
                                ✕ Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Add contests section */}
                {available.length > 0 && (
                  <>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>
                      Add to Today's Schedule
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {available.map((c) => (
                        <button
                          key={c.id}
                          className="btn btn-ghost btn-sm"
                          style={{
                            fontSize: '0.75rem',
                            borderStyle: 'dashed',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                          onClick={() => handleAdd(c.id)}
                          disabled={actionLoading === c.id}
                        >
                          <span>{c.platform === 'leetcode' ? '🟠' : '🟢'}</span>
                          <span>{actionLoading === c.id ? '...' : `+ ${c.title}`}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Allowed days display */}
                <div style={{ marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Runs on:</span>
                  {DAY_LABELS.map((label, idx) => (
                    <span key={idx} style={{
                      fontSize: '0.68rem', fontWeight: 700,
                      padding: '0.1rem 0.4rem', borderRadius: 999,
                      background: allowedDays.includes(idx) ? 'var(--accent-muted)' : 'var(--surface-2)',
                      color: allowedDays.includes(idx) ? 'var(--accent)' : 'var(--text-muted)',
                      border: `1px solid ${allowedDays.includes(idx) ? 'rgba(var(--accent-rgb),0.3)' : 'var(--border)'}`,
                    }}>
                      {label}
                    </span>
                  ))}
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>• 10 AM–6 PM IST • every 30 min</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Config Modal */}
      {showConfigModal && (
        <AutoScrapeConfigModal
          initialAllowedDays={allowedDays}
          onClose={() => setShowConfigModal(false)}
          onSaved={(days) => {
            setAllowedDays(days);
            setShowConfigModal(false);
          }}
        />
      )}
    </>
  );
}
