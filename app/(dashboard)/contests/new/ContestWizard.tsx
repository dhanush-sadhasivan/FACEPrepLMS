'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import CreateGroupAndAssignModal, { TrainerUser } from './CreateGroupAndAssignModal';

/* ─── Skeleton Loader for scraping state ─────────────────────────────── */
function ScrapingLoader() {
  return (
    <div className="scraping-loader">
      <style>{`
        .scraping-loader {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
          padding: 3rem 2rem;
        }
        .scraping-spinner {
          width: 56px; height: 56px;
          border: 4px solid var(--border);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .scraping-steps { display: flex; flex-direction: column; gap: 0.75rem; width: 100%; max-width: 360px; }
        .scraping-step {
          display: flex; align-items: center; gap: 0.75rem;
          font-size: 0.9rem; color: var(--text-muted);
          transition: color 0.3s, opacity 0.3s;
        }
        .scraping-step.active { color: var(--text-primary); font-weight: 600; }
        .scraping-step.done   { color: var(--success); }
        .step-dot {
          width: 10px; height: 10px; border-radius: 50%;
          background: var(--border); flex-shrink: 0;
          transition: background 0.3s;
        }
        .scraping-step.active .step-dot { background: var(--accent); animation: pulse-dot 1s ease-in-out infinite; }
        .scraping-step.done   .step-dot { background: var(--success); }
        @keyframes pulse-dot { 0%,100% { transform: scale(1); } 50% { transform: scale(1.5); } }
        .skeleton-bar {
          height: 14px; border-radius: 4px;
          background: linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s ease-in-out infinite;
        }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>

      <div className="scraping-spinner" />
      <h3 style={{ fontWeight: 700, fontSize: '1.1rem' }}>Scraping HackerRank Contest…</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
        This may take 30–60 seconds. The scraper is logging into HackerRank,<br />
        navigating to the contest, and extracting all questions.
      </p>

      <div className="scraping-steps">
        <div className="scraping-step done"><div className="step-dot" /> Connecting to scraper service</div>
        <div className="scraping-step active"><div className="step-dot" /> Authenticating with HackerRank</div>
        <div className="scraping-step"><div className="step-dot" /> Fetching contest challenges</div>
        <div className="scraping-step"><div className="step-dot" /> Parsing domains &amp; metadata</div>
      </div>

      {/* Skeleton preview of what questions will look like */}
      <div style={{ width: '100%', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div className="skeleton-bar" style={{ width: '70%' }} />
        <div className="skeleton-bar" style={{ width: '90%' }} />
        <div className="skeleton-bar" style={{ width: '55%' }} />
        <div className="skeleton-bar" style={{ width: '80%' }} />
      </div>
    </div>
  );
}

function LeetcodeImportLoader() {
  return (
    <div className="scraping-loader">
      <div className="scraping-spinner" style={{ borderTopColor: '#ffa116' }} />
      <h3 style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Importing LeetCode Problems…</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
        Fetching problem details, difficulty levels, and topic tags from LeetCode.
      </p>

      <div className="scraping-steps">
        <div className="scraping-step done"><div className="step-dot" style={{ background: '#ffa116' }} /> Parsing problem list &amp; URLs</div>
        <div className="scraping-step active"><div className="step-dot" style={{ background: '#ffa116' }} /> Querying LeetCode GraphQL API</div>
        <div className="scraping-step"><div className="step-dot" /> Categorizing topics &amp; difficulties</div>
        <div className="scraping-step"><div className="step-dot" /> Preparing track challenges</div>
      </div>

      <div style={{ width: '100%', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div className="skeleton-bar" style={{ width: '70%' }} />
        <div className="skeleton-bar" style={{ width: '90%' }} />
        <div className="skeleton-bar" style={{ width: '60%' }} />
      </div>
    </div>
  );
}

/* ─── Main Wizard ─────────────────────────────────────────────────────── */
export default function ContestWizard({
  groups,
  teams,
  trainers = [],
}: {
  groups: any[];
  teams: string[];
  trainers?: TrainerUser[];
}) {
  const router = useRouter();
  const { showToast } = useToast();

  const [step, setStep] = useState(1);
  const [platform, setPlatform] = useState<'hackerrank' | 'leetcode'>('hackerrank');
  const [slug, setSlug] = useState('');
  const [lcInput, setLcInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [scrapeError, setScrapeError] = useState('');

  // Contest Data
  const [questions, setQuestions] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [groupsList, setGroupsList] = useState<any[]>(groups);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [newlyCreatedGroupIds, setNewlyCreatedGroupIds] = useState<string[]>([]);

  /* ── Step 1 → Fetch questions from HackerRank scraper ─────────────── */
  const fetchQuestions = async () => {
    if (!slug.trim()) {
      showToast('Please enter a valid HackerRank contest slug', 'error');
      return;
    }
    setScrapeError('');
    setLoading(true);
    try {
      const res = await fetch('/api/scrape/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: slug.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch questions from scraper');

      const fetched = data.questions || data.challenges || [];
      if (fetched.length === 0) {
        setScrapeError('No questions found. Check if the slug is correct and the contest is accessible on HackerRank.');
        showToast('No questions found in this contest.', 'info');
      } else {
        showToast(`Successfully scraped ${fetched.length} question(s)!`, 'success');
      }

      setQuestions(fetched);
      setTitle(slug.trim().replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
      setStep(2);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Scraper error';
      setScrapeError(msg);
      showToast(`Scraper error: ${msg}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  /* ── Step 1 → Fetch LeetCode questions via GraphQL lookup ─────────── */
  const fetchLeetcodeQuestions = async () => {
    if (!lcInput.trim()) {
      showToast('Please paste at least one LeetCode problem URL or slug', 'error');
      return;
    }
    setScrapeError('');
    setLoading(true);
    try {
      const res = await fetch('/api/leetcode/problem-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: lcInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to lookup LeetCode problems');
      if (!data.questions || data.questions.length === 0) {
        throw new Error('No valid LeetCode problems found. Check the URLs or slugs entered.');
      }

      setQuestions(data.questions);
      const generatedSlug = slug.trim() || `lc-${Date.now().toString().slice(-6)}`;
      setSlug(generatedSlug);
      if (!title) {
        setTitle(`LeetCode Practice (${data.questions.length} Problems)`);
      }
      showToast(`Imported ${data.questions.length} LeetCode question(s)!`, 'success');
      setStep(2);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lookup error';
      setScrapeError(msg);
      showToast(`LeetCode lookup error: ${msg}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  /* ── Step 3 → Create contest ──────────────────────────────────────── */
  const createContest = async () => {
    if (!title.trim()) return showToast('Please enter a contest title', 'error');
    if (!startDate || !endDate) return showToast('Please select start and end dates', 'error');
    if (new Date(endDate) <= new Date(startDate)) {
      return showToast('End date must be after start date', 'error');
    }

    setLoading(true);
    try {
      const res = await fetch('/api/contests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          slug: slug.trim(),
          platform,
          start_date: new Date(startDate).toISOString(),
          end_date: new Date(endDate).toISOString(),
          questions: questions.map(q => ({
            slug: q.slug,
            title: q.displayTitle || q.questionName || q.title || q.name || q.slug,
            domain: q.domain || 'General',
            difficulty: q.difficulty || 'Medium',
            max_score: q.maxScore ?? q.max_score ?? 10,
            url: q.url || q.hackerrank_url || (platform === 'leetcode' ? `https://leetcode.com/problems/${q.slug}/` : `https://www.hackerrank.com/contests/${slug.trim()}/challenges/${q.slug}`),
            hackerrank_url: q.url || q.hackerrank_url || (platform === 'leetcode' ? `https://leetcode.com/problems/${q.slug}/` : `https://www.hackerrank.com/contests/${slug.trim()}/challenges/${q.slug}`),
          })),
          groups: selectedGroups,
          teams: selectedTeams,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create contest');

      showToast(`${platform === 'leetcode' ? 'LeetCode Track' : 'Contest'} created successfully!`, 'success');
      router.push('/contests');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Creation error';
      showToast(`Creation failed: ${msg}`, 'error');
      setLoading(false);
    }
  };

  /* ── Computed ──────────────────────────────────────────────────────── */
  const domains = Array.from(new Set(questions.map(q => q.domain || 'General')));
  const totalMaxScore = questions.reduce((s, q) => s + (q.maxScore ?? q.max_score ?? 10), 0);

  return (
    <div className="card" style={{ maxWidth: '820px', margin: '0 auto', padding: '2rem' }}>
      {/* ── Step Indicators ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
        {[
          { n: 1, label: platform === 'leetcode' ? 'Import Problems' : 'Scrape' },
          { n: 2, label: 'Details & Review' },
          { n: 3, label: 'Assign' },
        ].map(s => (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: step >= s.n ? 1 : 0.35, fontWeight: step === s.n ? 700 : 400, transition: 'all 0.3s' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: step >= s.n ? (platform === 'leetcode' ? '#ffa116' : 'var(--accent)') : 'var(--border)',
              color: step >= s.n && platform === 'leetcode' ? '#000' : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.85rem', fontWeight: 700, transition: 'background 0.3s',
            }}>{s.n}</div>
            <span>{s.n}. {s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Step 1: Platform Selection & Input ─────────────────────── */}
      {step === 1 && !loading && (
        <div>
          <label className="label" style={{ fontWeight: 700, marginBottom: '0.5rem', display: 'block' }}>
            Choose Platform *
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.75rem' }}>
            <div
              onClick={() => { setPlatform('hackerrank'); setScrapeError(''); }}
              style={{
                border: `2px solid ${platform === 'hackerrank' ? 'var(--accent)' : 'var(--border)'}`,
                background: platform === 'hackerrank' ? 'rgba(59, 130, 246, 0.08)' : 'var(--surface-2)',
                borderRadius: 10,
                padding: '1.25rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>🟢</div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>HackerRank Contest</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.25rem 0 0 0' }}>
                Scrape challenges directly from a live HackerRank contest slug.
              </p>
            </div>

            <div
              onClick={() => { setPlatform('leetcode'); setScrapeError(''); }}
              style={{
                border: `2px solid ${platform === 'leetcode' ? '#ffa116' : 'var(--border)'}`,
                background: platform === 'leetcode' ? 'rgba(255, 161, 22, 0.08)' : 'var(--surface-2)',
                borderRadius: 10,
                padding: '1.25rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>🟠</div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>LeetCode Track</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.25rem 0 0 0' }}>
                Paste Problem List URLs or problem links. Auto-fetch titles &amp; topics.
              </p>
            </div>
          </div>

          {platform === 'hackerrank' ? (
            <div>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="label">HackerRank Contest Slug *</label>
                <input
                  type="text"
                  className="input"
                  value={slug}
                  onChange={e => { setSlug(e.target.value); setScrapeError(''); }}
                  placeholder="e.g. pascal-marathon-1"
                />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
                  From <code>https://www.hackerrank.com/contests/<strong>your-slug</strong></code>
                </p>
              </div>

              {scrapeError && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--error)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: 'var(--error)', fontSize: '0.85rem' }}>
                  ⚠️ {scrapeError}
                </div>
              )}

              <button className="btn btn-primary" onClick={fetchQuestions} disabled={!slug.trim()}>
                🔍 Fetch Questions via Scraper
              </button>
            </div>
          ) : (
            <div>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="label">LeetCode Problem URLs, Slugs, or Problem List URL *</label>
                <textarea
                  className="input"
                  rows={6}
                  value={lcInput}
                  onChange={e => { setLcInput(e.target.value); setScrapeError(''); }}
                  placeholder={`Paste LeetCode Problem List URLs, individual problem links, or slugs (one per line):\nhttps://leetcode.com/problem-list/top-interview-questions/\nhttps://leetcode.com/problems/two-sum/\nhttps://leetcode.com/problems/valid-parentheses/\nreverse-linked-list`}
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.5' }}
                />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
                  Accepts <strong>Problem List URLs</strong> (e.g. <code>https://leetcode.com/problem-list/top-interview-questions/</code>), <strong>Problem URLs</strong> (<code>https://leetcode.com/problems/two-sum/</code>), or <strong>Slugs</strong> (<code>two-sum</code>).
                </p>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="label">Track Identifier / Code (Optional)</label>
                <input
                  type="text"
                  className="input"
                  value={slug}
                  onChange={e => setSlug(e.target.value)}
                  placeholder="e.g. lc-marathon-1 (auto-generated if empty)"
                />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
                  Unique identifier for this LeetCode track. Leave blank to auto-generate (e.g. <code>lc-XXXXXX</code>).
                </p>
              </div>

              {scrapeError && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--error)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: 'var(--error)', fontSize: '0.85rem' }}>
                  ⚠️ {scrapeError}
                </div>
              )}

              <button className="btn btn-primary" onClick={fetchLeetcodeQuestions} disabled={!lcInput.trim()} style={{ background: '#ffa116', borderColor: '#ffa116', color: '#000', fontWeight: 700 }}>
                🔍 Lookup &amp; Import LeetCode Problems
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Step 1: Loading state ───────────────────────────────────── */}
      {step === 1 && loading && (platform === 'leetcode' ? <LeetcodeImportLoader /> : <ScrapingLoader />)}

      {/* ── Step 2: Details & Question Preview ──────────────────────── */}
      {step === 2 && (
        <div>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="label">{platform === 'leetcode' ? 'Track Title *' : 'Contest Title *'}</label>
            <input type="text" className="input" value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="label">{platform === 'leetcode' ? 'Track Identifier / Code *' : 'HackerRank Contest Slug *'}</label>
            <input type="text" className="input" value={slug} onChange={e => setSlug(e.target.value)} />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
              {platform === 'leetcode' ? 'Unique reference code for this LeetCode track.' : 'The contest slug as shown in the HackerRank URL.'}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="form-group">
              <label className="label">Start Date &amp; Time *</label>
              <input type="datetime-local" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">End Date &amp; Time *</label>
              <input type="datetime-local" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          {/* ── Questions Preview ────────────────────────────── */}
          <div style={{ background: 'var(--surface-2)', padding: '1.25rem', borderRadius: 10, border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>
                📋 {platform === 'leetcode' ? 'LeetCode Problems' : 'Scraped Questions'} ({questions.length})
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <span className="badge badge-accent">{domains.length} Domain{domains.length !== 1 ? 's' : ''}</span>
                <span className="badge badge-muted">{totalMaxScore} pts total</span>
              </div>
            </div>

            {questions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                <p>
                  {platform === 'leetcode'
                    ? 'No problems imported yet. Go back and check your links or list URL.'
                    : 'No questions were scraped. Go back and try a different slug.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 320, overflowY: 'auto' }}>
                {domains.map(domain => {
                  const domainQs = questions.filter(q => (q.domain || 'General') === domain);
                  return (
                    <details key={domain as string} open style={{ background: 'var(--surface)', padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>📂 {domain as string}</span>
                        <span className="badge" style={{ background: 'var(--accent)', color: '#fff', fontSize: '0.75rem' }}>{domainQs.length}</span>
                      </summary>
                      <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', paddingLeft: '0.75rem' }}>
                        {domainQs.map((q, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', padding: '0.35rem 0', borderBottom: idx < domainQs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                            <span style={{ fontWeight: 500 }}>{q.displayTitle || q.questionName || q.title || q.name || q.slug}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                              {q.difficulty || 'Medium'} &bull; {q.maxScore ?? q.max_score ?? 10} pts
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
            <button className="btn btn-primary" onClick={() => setStep(3)} disabled={!startDate || !endDate || questions.length === 0}>
              Next: Assign →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Assign Groups & Teams ───────────────────────────── */}
      {step === 3 && (
        <div>
          {/* Quick Create Group Callout Banner */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)',
              border: '1px solid var(--border)',
              borderLeft: '4px solid var(--accent)',
              borderRadius: 10,
              padding: '1rem 1.25rem',
              marginBottom: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--text-primary)' }}>
                <span>👥</span> Create Group from Individual Trainers
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Pick specific trainers across any teams to create a cohort and assign it to this contest instantly.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsCreateGroupOpen(true)}
              style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.84rem' }}
            >
              <span>➕</span> Create New Group &amp; Select Trainers
            </button>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label className="label" style={{ fontWeight: 700, margin: 0 }}>Assign to Groups</label>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                {selectedGroups.length} of {groupsList.length} group(s) selected
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                maxHeight: '260px',
                overflowY: 'auto',
                paddingRight: '0.25rem',
              }}
            >
              {groupsList.length === 0 ? (
                <div style={{ padding: '1.25rem', background: 'var(--surface-2)', borderRadius: 8, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No trainer groups created yet. Click <strong>&quot;Create New Group &amp; Select Trainers&quot;</strong> above to create and assign one now!
                </div>
              ) : (
                groupsList.map((g) => {
                  const isChecked = selectedGroups.includes(g.id);
                  const isNew = newlyCreatedGroupIds.includes(g.id);
                  return (
                    <label
                      key={g.id}
                      style={{
                        display: 'flex',
                        gap: '0.65rem',
                        alignItems: 'center',
                        cursor: 'pointer',
                        padding: '0.55rem 0.75rem',
                        borderRadius: 8,
                        background: isChecked ? 'rgba(99, 102, 241, 0.08)' : 'var(--surface-2)',
                        border: isChecked ? '1px solid var(--accent)' : '1px solid var(--border)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedGroups([...selectedGroups, g.id]);
                          else setSelectedGroups(selectedGroups.filter((id) => id !== g.id));
                        }}
                        style={{ cursor: 'pointer', width: 16, height: 16 }}
                      />
                      <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)', flex: 1 }}>
                        {g.name}
                      </span>
                      {isNew && (
                        <span
                          style={{
                            fontSize: '0.66rem',
                            fontWeight: 800,
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981',
                            padding: '0.08rem 0.4rem',
                            borderRadius: 4,
                          }}
                        >
                          ✨ JUST CREATED
                        </span>
                      )}
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label className="label" style={{ fontWeight: 700 }}>Assign to Teams</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              {teams.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No distinct teams found among users.</p>
              ) : teams.map(t => (
                <label key={t} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" checked={selectedTeams.includes(t)} onChange={e => {
                    if (e.target.checked) setSelectedTeams([...selectedTeams, t]);
                    else setSelectedTeams(selectedTeams.filter(id => id !== t));
                  }} />
                  <span>{t}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Summary strip */}
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span><strong>{platform === 'leetcode' ? 'Track:' : 'Contest:'}</strong> {title}</span>
            <span><strong>{platform === 'leetcode' ? 'Problems:' : 'Questions:'}</strong> {questions.length}</span>
            <span><strong>Groups:</strong> {selectedGroups.length} | <strong>Teams:</strong> {selectedTeams.length}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-secondary" onClick={() => setStep(2)}>← Back</button>
            <button
              className="btn btn-primary"
              onClick={createContest}
              disabled={loading}
              style={platform === 'leetcode' ? { background: '#ffa116', borderColor: '#ffa116', color: '#000', fontWeight: 700 } : {}}
            >
              {loading
                ? (platform === 'leetcode' ? 'Creating LeetCode Track…' : 'Creating Contest…')
                : (platform === 'leetcode' ? '🎉 Create LeetCode Track' : '🎉 Create Contest')}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal to Create Group & Assign Trainers ───────────────────── */}
      <CreateGroupAndAssignModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        availableTrainers={trainers}
        defaultGroupName={title ? `${title} Cohort` : ''}
        onGroupCreated={(newGroup, memberCount) => {
          setGroupsList((prev) => [newGroup, ...prev.filter((g) => g.id !== newGroup.id)]);
          setSelectedGroups((prev) => Array.from(new Set([newGroup.id, ...prev])));
          setNewlyCreatedGroupIds((prev) => [...prev, newGroup.id]);
        }}
      />
    </div>
  );
}
