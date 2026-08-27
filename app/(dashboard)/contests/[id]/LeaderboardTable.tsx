'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import TrainerDetailModal from './TrainerDetailModal';
import Papa from 'papaparse';

type JobStatus = {
  id?: string;
  status: 'pending' | 'running' | 'done' | 'completed' | 'error' | 'failed';
  step?: string;
  message?: string;
  progress?: number;
  total?: number;
  userCount?: number;
  processedUsers?: number;
  totalSolved?: number;
  error?: string | null;
};

const STEP_LABELS: Record<string, string> = {
  authenticating: '🔐 Authenticating with HackerRank…',
  fetching_leaderboard: '📊 Fetching contest leaderboard…',
  processing_users: '👤 Processing user progress…',
  sending_to_lms: '📤 Saving results to database…',
  done: '✅ Complete!',
};

type LeaderboardSortField = 'rank' | 'name' | 'emp_id' | 'team' | 'solved' | 'score' | 'lastActive';
type SortDirection = 'asc' | 'desc' | null;

export default function LeaderboardTable({ contestId, data = [], lastScraped, questions = [], isAdminOrManager, platform = 'hackerrank' }: any) {
  const router = useRouter();
  const [scraping, setScraping] = useState(false);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [scrapeMessage, setScrapeMessage] = useState('');
  const [scrapeError, setScrapeError] = useState('');
  const [selectedTrainer, setSelectedTrainer] = useState<any>(null);

  const triggerLeetcodeSync = async () => {
    setScraping(true);
    setScrapeMessage('🔄 Syncing LeetCode solves for assigned participants…');
    setScrapeError('');
    try {
      const res = await fetch('/api/leetcode/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contestId }),
      });
      const result = await res.json();
      if (!res.ok) {
        setScrapeError(result.error || `Sync failed (HTTP ${res.status})`);
      } else {
        setScrapeMessage(`✅ ${result.message || 'LeetCode sync complete!'}`);
        router.refresh();
      }
    } catch (err: any) {
      setScrapeError(`Sync error: ${err.message}`);
    } finally {
      setScraping(false);
    }
  };
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');

  // Sorting State
  const [sortField, setSortField] = useState<LeaderboardSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const jobIdRef = useRef<string | null>(null);

  const handleSort = (field: LeaderboardSortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      setSortField(null);
      setSortDirection(null);
    }
  };

  const renderSortHeader = (
    label: string,
    field: LeaderboardSortField,
    align: 'left' | 'center' | 'right' = 'left',
    style?: React.CSSProperties
  ) => {
    const isActive = sortField === field;
    return (
      <th
        onClick={() => handleSort(field)}
        style={{
          padding: '0.65rem 0.85rem',
          textAlign: align,
          fontSize: '0.72rem',
          color: isActive ? 'var(--accent)' : 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'color 0.15s ease',
          ...style,
        }}
        title={`Sort by ${label} (${isActive ? (sortDirection === 'asc' ? 'Ascending / A-Z' : 'Descending / Z-A') : 'Click to sort'})`}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
            width: '100%',
          }}
        >
          <span>{label}</span>
          <span style={{ fontSize: '0.75rem', opacity: isActive ? 1 : 0.4 }}>
            {isActive ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
          </span>
        </div>
      </th>
    );
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const pollJobStatus = useCallback((jobId: string) => {
    let elapsed = 0;
    const maxPollMs = 600_000; // 10 minutes max
    const intervalMs = 3_000;  // poll every 3 seconds

    pollRef.current = setInterval(async () => {
      elapsed += intervalMs;

      try {
        const res = await fetch(`/api/scrape/status?jobId=${jobId}`);
        if (!res.ok) {
          if (elapsed > 15_000) {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            setScrapeError('Lost contact with scraper job. The scraper service may have restarted.');
            setScraping(false);
          }
          return;
        }

        const job: JobStatus = await res.json();
        setJobStatus(job);

        const rawStatus = (job as any).status;
        const isDone = rawStatus === 'done' || rawStatus === 'completed';
        const isFailed = rawStatus === 'error' || rawStatus === 'failed';

        if (isDone) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setScraping(false);
          setScrapeMessage(`✅ Scrape complete! ${(job as any).message || 'Results saved to database.'}`);
          setJobStatus(null);
          router.refresh();
        } else if (isFailed) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setScraping(false);
          setScrapeError(job.error || (job as any).message || 'Scrape failed with an error.');
          setJobStatus(null);
        }
      } catch {
        // Network error — keep polling
      }

      if (elapsed >= maxPollMs) {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        setScraping(false);
        setScrapeError('Scrape timed out after 10 minutes.');
        setJobStatus(null);
      }
    }, intervalMs);
  }, [router]);

  const triggerScrape = async () => {
    setScraping(true);
    setScrapeMessage('');
    setScrapeError('');
    setJobStatus(null);

    try {
      const res = await fetch(`/api/scrape/trigger?contestId=${contestId}`, { method: 'POST' });
      const result = await res.json();
      if (!res.ok) {
        setScrapeError(result.error || `Scrape failed (HTTP ${res.status})`);
        setScraping(false);
        return;
      }

      if (result.jobId) {
        jobIdRef.current = result.jobId;
        pollJobStatus(result.jobId);
      } else {
        setScrapeMessage(result.message || 'Scraping started! Refresh in ~30 seconds.');
        setTimeout(() => {
          router.refresh();
          setScraping(false);
        }, 30_000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setScrapeError(`Failed to connect to scraper: ${msg}`);
      setScraping(false);
    }
  };

  const exportCsv = () => {
    const csvData = data.map((d: any, i: number) => ({
      Rank: i + 1,
      Name: d.name,
      EmpID: d.emp_id,
      Team: d.team,
      Solved: d.solved,
      Total: d.total,
      Score: d.score,
      LastActive: d.lastActive
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contest-${contestId}-leaderboard.csv`;
    a.click();
  };

  const cleanDisplay = (val: any) => {
    if (!val) return '—';
    const str = String(val).trim();
    if (['nil', 'null', 'n/a', 'undefined', 'none', '-'].includes(str.toLowerCase())) return '—';
    return str;
  };

  // Distinct Teams for Filter Dropdown
  const distinctTeams = useMemo(() => {
    const set = new Set<string>();
    data.forEach((d: any) => {
      const t = cleanDisplay(d.team);
      if (t !== '—') set.add(t);
    });
    return Array.from(set);
  }, [data]);

  // Filtered & Sorted Leaderboard Rows
  const filteredData = useMemo(() => {
    return data.filter((row: any) => {
      const q = searchTerm.toLowerCase().trim();
      const nameMatch = (row.name || '').toLowerCase().includes(q);
      const empMatch = (row.emp_id || '').toLowerCase().includes(q);
      const teamMatch = (row.team || '').toLowerCase().includes(q);
      const matchesSearch = q === '' || nameMatch || empMatch || teamMatch;

      const rowTeam = cleanDisplay(row.team);
      const matchesTeam = selectedTeam === 'all' || rowTeam === selectedTeam;

      return matchesSearch && matchesTeam;
    });
  }, [data, searchTerm, selectedTeam]);

  const sortedData = useMemo(() => {
    if (!sortField || !sortDirection) return filteredData;

    return [...filteredData].sort((a: any, b: any) => {
      let valA: any = 0;
      let valB: any = 0;

      if (sortField === 'name') {
        valA = (a.name || '').toLowerCase();
        valB = (b.name || '').toLowerCase();
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (sortField === 'emp_id') {
        valA = (a.emp_id || '').toLowerCase();
        valB = (b.emp_id || '').toLowerCase();
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (sortField === 'team') {
        valA = (a.team || '').toLowerCase();
        valB = (b.team || '').toLowerCase();
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (sortField === 'rank') {
        valA = data.findIndex((d: any) => d.user_id === a.user_id);
        valB = data.findIndex((d: any) => d.user_id === b.user_id);
      }
      if (sortField === 'solved') {
        valA = a.solved || 0;
        valB = b.solved || 0;
      }
      if (sortField === 'score') {
        valA = a.score || 0;
        valB = b.score || 0;
      }
      if (sortField === 'lastActive') {
        valA = a.lastActive ? new Date(a.lastActive).getTime() : 0;
        valB = b.lastActive ? new Date(b.lastActive).getTime() : 0;
      }

      if (sortDirection === 'asc') return valA > valB ? 1 : valA < valB ? -1 : 0;
      return valA < valB ? 1 : valA > valB ? -1 : 0;
    });
  }, [filteredData, sortField, sortDirection, data]);

  // Summary Metrics
  const totalCount = data.length;
  const fullMasteredCount = data.filter((d: any) => d.total > 0 && d.solved >= d.total).length;
  const avgCompletionPct = totalCount > 0
    ? Math.round(data.reduce((acc: number, curr: any) => acc + (curr.total > 0 ? (curr.solved / curr.total) * 100 : 0), 0) / totalCount)
    : 0;
  const topPerformer = data.length > 0 ? data[0] : null;

  return (
    <div>
      {/* ── Top Overview Stats Summary Bar ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem', marginBottom: '0.85rem' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.6rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-3)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 800 }}>👥</div>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>{totalCount}</div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.15rem' }}>Assigned Trainers</div>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.6rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 800 }}>👑</div>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--success)', lineHeight: 1 }}>{fullMasteredCount}</div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.15rem' }}>100% Mastered</div>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.6rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', color: 'var(--indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 800 }}>📊</div>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--indigo)', lineHeight: 1 }}>{avgCompletionPct}%</div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.15rem' }}>Avg Completion</div>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.6rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 800 }}>🥇</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.86rem', fontWeight: 900, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1 }}>
              {topPerformer ? topPerformer.name : '—'}
            </div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', marginTop: '0.15rem' }}>
              {topPerformer ? `${topPerformer.score} pts (#1)` : 'Top Performer'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Search, Team Filter & Action Controls ───────────────────────── */}
      <div className="search-filter-bar" style={{ marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', flex: 1 }}>
          {/* Search Box */}
          <div className="search-box-wrapper" style={{ maxWidth: 300 }}>
            <span className="search-box-icon">🔍</span>
            <input
              type="text"
              className="search-box-input"
              placeholder="Search trainer, emp ID, or team..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Team Dropdown Filter */}
          {distinctTeams.length > 0 && (
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              style={{
                padding: '0.45rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="all">All Teams ({distinctTeams.length})</option>
              {distinctTeams.map((t) => (
                <option key={t} value={t}>Team: {t}</option>
              ))}
            </select>
          )}

          <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginLeft: 'auto' }} suppressHydrationWarning>
            Last synced: <strong>{lastScraped ? new Date(lastScraped).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never'}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.45rem', flexShrink: 0 }}>
          {isAdminOrManager && (
            platform === 'leetcode' ? (
              <button
                className="btn btn-primary btn-sm"
                onClick={triggerLeetcodeSync}
                disabled={scraping}
                style={{ fontSize: '0.8rem', background: '#ffa116', borderColor: '#ffa116', color: '#000', fontWeight: 700 }}
              >
                {scraping ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    Syncing LeetCode…
                  </span>
                ) : (
                  '⟳ Sync LeetCode Solves'
                )}
              </button>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={triggerScrape} disabled={scraping} style={{ fontSize: '0.8rem' }}>
                {scraping ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    Scraping…
                  </span>
                ) : (
                  '🔄 Scrape Progress'
                )}
              </button>
            )
          )}
          {data.length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={exportCsv} style={{ fontSize: '0.8rem' }}>
              📥 Export CSV
            </button>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Live Scraper Job Status Bar ──────────────────────────────────── */}
      {scraping && jobStatus && (
        <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(99,102,241,0.3)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
              {jobStatus.message || (jobStatus.step ? (STEP_LABELS[jobStatus.step] || `Working: ${jobStatus.step}…`) : 'Scraping progress…')}
            </span>
          </div>
          {((jobStatus.total && jobStatus.total > 0) || (jobStatus.userCount && jobStatus.userCount > 0)) && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                <span>Processing trainers…</span>
                <span>{jobStatus.progress ?? jobStatus.processedUsers ?? 0}/{jobStatus.total ?? jobStatus.userCount ?? 0}</span>
              </div>
              <div style={{ width: '100%', height: 5, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.round(((jobStatus.progress ?? jobStatus.processedUsers ?? 0) / (jobStatus.total ?? jobStatus.userCount ?? 1)) * 100)}%`,
                  background: 'var(--accent)',
                  borderRadius: 999,
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      {scrapeMessage && (
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid var(--success)', borderRadius: 8, padding: '0.65rem 0.95rem', marginBottom: '0.85rem', color: 'var(--success)', fontSize: '0.84rem' }}>
          {scrapeMessage}
        </div>
      )}

      {scrapeError && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--error)', borderRadius: 8, padding: '0.65rem 0.95rem', marginBottom: '0.85rem', color: 'var(--error)', fontSize: '0.84rem' }}>
          ⚠️ {scrapeError}
        </div>
      )}

      {/* ── Main Leaderboard Table / Empty State ───────────────────────── */}
      {filteredData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏆</div>
          <h3 style={{ fontWeight: 800, fontSize: '1.05rem', margin: '0 0 0.35rem', color: 'var(--text-primary)' }}>
            {searchTerm || selectedTeam !== 'all' ? 'No matching trainers found' : 'No Assigned Participants Found'}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', maxWidth: 460, margin: '0 auto' }}>
            {searchTerm || selectedTeam !== 'all'
              ? 'Try clearing your search query or team filter to view all participants.'
              : platform === 'leetcode'
              ? 'Make sure this contest has assigned Groups or Teams, and that users have their LeetCode IDs set in their profiles.'
              : 'Make sure this contest has assigned Groups or Teams, and that users have their HackerRank IDs set in their profiles.'}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-sm)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--surface-2)' }}>
                {renderSortHeader('Rank', 'rank', 'center', { width: 75 })}
                {renderSortHeader('Trainer Name', 'name', 'left')}
                {renderSortHeader('Emp ID', 'emp_id', 'left')}
                {renderSortHeader('Team', 'team', 'left')}
                {renderSortHeader(platform === 'leetcode' ? 'LeetCode ID' : 'Handle', 'emp_id', 'left')}
                {renderSortHeader('Questions Progress', 'solved', 'left', { minWidth: 190 })}
                {renderSortHeader('Total Score', 'score', 'right')}
                {renderSortHeader('Last Active', 'lastActive', 'right')}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row: any, i: number) => {
                const actualRank = data.findIndex((d: any) => d.user_id === row.user_id) + 1;
                const displayRank = actualRank > 0 ? actualRank : i + 1;
                const pct = row.total > 0 ? Math.round((row.solved / row.total) * 100) : 0;
                const isMastered = row.total > 0 && row.solved >= row.total;
                const rankBadgeBg =
                  displayRank === 1 ? '#f59e0b' :
                  displayRank === 2 ? '#94a3b8' :
                  displayRank === 3 ? '#b45309' :
                  'var(--surface-3)';

                const initial = (row.name || '?').charAt(0).toUpperCase();

                return (
                  <tr
                    key={row.user_id || i}
                    onClick={() => setSelectedTrainer(row)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      height: '46px',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Rank Badge */}
                    <td style={{ padding: '0.5rem 0.95rem', textAlign: 'center', verticalAlign: 'middle' }}>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: '0.78rem',
                          color: displayRank <= 3 ? '#fff' : 'var(--text-secondary)',
                          background: rankBadgeBg,
                          display: 'inline-flex',
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.25rem',
                          whiteSpace: 'nowrap',
                          height: '24px',
                          minWidth: '58px',
                          padding: '0 0.55rem',
                          borderRadius: '999px',
                          lineHeight: 1,
                          boxSizing: 'border-box',
                        }}
                      >
                        {displayRank === 1 ? '🥇 #1' : displayRank === 2 ? '🥈 #2' : displayRank === 3 ? '🥉 #3' : `#${displayRank}`}
                      </span>
                    </td>

                    {/* Trainer Name & Initial Avatar */}
                    <td style={{ padding: '0.5rem 0.95rem', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: 'var(--surface-3)',
                            color: 'var(--accent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            flexShrink: 0,
                            border: '1px solid var(--border)',
                            lineHeight: 1,
                          }}
                        >
                          {initial}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.25 }}>
                            {cleanDisplay(row.name)}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Emp ID */}
                    <td style={{ padding: '0.5rem 0.95rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontFamily: 'monospace', verticalAlign: 'middle' }}>
                      {cleanDisplay(row.emp_id)}
                    </td>

                    {/* Team Badge */}
                    <td style={{ padding: '0.5rem 0.95rem', verticalAlign: 'middle' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          background: 'rgba(99,102,241,0.1)',
                          color: 'var(--indigo)',
                          border: '1px solid rgba(99,102,241,0.25)',
                          padding: '0.12rem 0.5rem',
                          borderRadius: '999px',
                          fontWeight: 700,
                          display: 'inline-block',
                          lineHeight: 1.2,
                        }}
                      >
                        {cleanDisplay(row.team)}
                      </span>
                    </td>

                    {/* Handle Cell */}
                    <td style={{ padding: '0.5rem 0.95rem', verticalAlign: 'middle' }}>
                      {platform === 'leetcode' ? (
                        row.leetcode_id ? (
                          <a
                            href={`https://leetcode.com/u/${row.leetcode_id}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ color: '#ffa116', fontWeight: 600, textDecoration: 'none', fontSize: '0.82rem' }}
                          >
                            @{row.leetcode_id}
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>No LC ID</span>
                        )
                      ) : (
                        row.hackerrank_id ? (
                          <span style={{ color: 'var(--accent)', fontSize: '0.82rem' }}>@{row.hackerrank_id}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )
                      )}
                    </td>

                    {/* Questions Progress Bar */}
                    <td style={{ padding: '0.5rem 0.95rem', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, minWidth: '3.2rem', color: isMastered ? 'var(--success)' : 'var(--text-primary)' }}>
                          {row.solved}/{row.total}
                        </span>

                        <div style={{ flex: 1, height: 6, background: 'var(--surface-3)', borderRadius: 999, overflow: 'hidden', minWidth: 70 }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${pct}%`,
                              background: isMastered
                                ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                                : 'linear-gradient(90deg, var(--accent) 0%, var(--indigo) 100%)',
                              borderRadius: 999,
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>

                        {isMastered && (
                          <span style={{ fontSize: '0.65rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '0.08rem 0.35rem', borderRadius: '999px', fontWeight: 800, flexShrink: 0 }}>
                            100%
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Total Score */}
                    <td style={{ padding: '0.5rem 0.95rem', textAlign: 'right', fontWeight: 900, fontSize: '0.9rem', color: row.score > 0 ? 'var(--accent)' : 'var(--text-muted)', verticalAlign: 'middle' }}>
                      {row.score} pts
                    </td>

                    {/* Last Active */}
                    <td style={{ padding: '0.5rem 0.95rem', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)', verticalAlign: 'middle' }} suppressHydrationWarning>
                      {row.lastActive ? new Date(row.lastActive).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Trainer Detail Drilldown Modal */}
      {selectedTrainer && (
        <TrainerDetailModal
          trainer={selectedTrainer}
          questions={questions}
          onClose={() => setSelectedTrainer(null)}
        />
      )}
    </div>
  );
}
