'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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

export default function LeaderboardTable({ contestId, data, lastScraped, questions, isAdminOrManager }: any) {
  const router = useRouter();
  const [scraping, setScraping] = useState(false);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [scrapeMessage, setScrapeMessage] = useState('');
  const [scrapeError, setScrapeError] = useState('');
  const [selectedTrainer, setSelectedTrainer] = useState<any>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const jobIdRef = useRef<string | null>(null);

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
          // Job not found — might have expired or scraper restarted
          if (elapsed > 15_000) {
            // After 15s with no job found, assume something went wrong
            clearInterval(pollRef.current!);
            pollRef.current = null;
            setScrapeError('Lost contact with scraper job. The scraper may have restarted. Try again.');
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
        setScrapeError('Scrape timed out after 10 minutes. The scraper may still be working — refresh the page in a minute to check.');
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
        // Fallback: no jobId means old scraper without status tracking — use basic polling
        setScrapeMessage(result.message || 'Scraping started! Refresh in ~60 seconds.');
        setTimeout(() => {
          router.refresh();
          setScraping(false);
        }, 30_000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setScrapeError(`Failed to connect to scraper: ${msg}. Is the scraper service running?`);
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

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }} suppressHydrationWarning>
          Last scraped: {lastScraped ? new Date(lastScraped).toLocaleString() : 'Never'}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {isAdminOrManager && (
            <button className="btn btn-primary" onClick={triggerScrape} disabled={scraping}>
              {scraping ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Scraping…
                </span>
              ) : (
                '🔄 Scrape Progress'
              )}
            </button>
          )}
          {data.length > 0 && (
            <button className="btn btn-secondary" onClick={exportCsv}>📥 Export CSV</button>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Live job status */}
      {scraping && jobStatus && (
        <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <span style={{ display: 'inline-block', width: 16, height: 16, border: '2.5px solid rgba(99,102,241,0.3)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>
              {jobStatus.message || (jobStatus.step ? (STEP_LABELS[jobStatus.step] || `Working: ${jobStatus.step}…`) : 'Scraping progress…')}
            </span>
          </div>
          {((jobStatus.total && jobStatus.total > 0) || (jobStatus.userCount && jobStatus.userCount > 0)) && (
            <div style={{ marginLeft: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                <span>Processing users…</span>
                <span>{jobStatus.progress ?? jobStatus.processedUsers ?? 0}/{jobStatus.total ?? jobStatus.userCount ?? 0}</span>
              </div>
              <div style={{ width: '100%', height: 6, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
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

      {/* Success message */}
      {scrapeMessage && (
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid var(--success)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: 'var(--success)', fontSize: '0.85rem' }}>
          {scrapeMessage}
        </div>
      )}

      {/* Error message */}
      {scrapeError && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--error)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: 'var(--error)', fontSize: '0.85rem' }}>
          ⚠️ {scrapeError}
        </div>
      )}

      {/* Leaderboard table or empty state */}
      {data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📊</div>
          <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>No Assigned Participants Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 460, margin: '0 auto' }}>
            Make sure this contest has assigned Groups or Teams, and that users have their HackerRank IDs set in their profiles.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rank</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Emp ID</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Team</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progress</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Score</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last Active</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row: any, i: number) => {
                const pct = row.total > 0 ? Math.round((row.solved / row.total) * 100) : 0;
                return (
                  <tr
                    key={row.user_id}
                    onClick={() => setSelectedTrainer(row)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                      {i === 0 && row.score > 0 ? '🥇' : i === 1 && row.score > 0 ? '🥈' : i === 2 && row.score > 0 ? '🥉' : i + 1}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{cleanDisplay(row.name)}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{cleanDisplay(row.emp_id)}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{cleanDisplay(row.team)}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', minWidth: '3rem', fontWeight: row.solved > 0 ? 600 : 400 }}>{row.solved}/{row.total}</span>
                        <div style={{ width: 96, height: 8, background: 'var(--bg)', borderRadius: 999, overflow: 'hidden', border: '1px solid var(--border)' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 999, transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: row.score > 0 ? 'var(--accent)' : 'inherit' }}>{row.score} pts</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }} suppressHydrationWarning>
                      {row.lastActive ? new Date(row.lastActive).toLocaleString() : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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
