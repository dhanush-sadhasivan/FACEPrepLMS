'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';

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
        This may take 30–60 seconds. The scraper is connecting to HackerRank,<br />
        navigating to the contest, and extracting all questions.
      </p>

      <div className="scraping-steps">
        <div className="scraping-step done"><div className="step-dot" /> Connecting to scraper service</div>
        <div className="scraping-step active"><div className="step-dot" /> Authenticating with HackerRank</div>
        <div className="scraping-step"><div className="step-dot" /> Fetching contest challenges</div>
        <div className="scraping-step"><div className="step-dot" /> Parsing domains &amp; metadata</div>
      </div>

      <div style={{ width: '100%', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div className="skeleton-bar" style={{ width: '70%' }} />
        <div className="skeleton-bar" style={{ width: '90%' }} />
        <div className="skeleton-bar" style={{ width: '55%' }} />
        <div className="skeleton-bar" style={{ width: '80%' }} />
      </div>
    </div>
  );
}

/* ─── Main Wizard ─────────────────────────────────────────────────────── */
export default function ContestWizard({ groups, teams }: { groups: any[]; teams: string[] }) {
  const router = useRouter();
  const { showToast } = useToast();

  const [step, setStep] = useState(1);
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [scrapeError, setScrapeError] = useState('');

  // Contest Data
  const [questions, setQuestions] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);

  // Manual Question Addition
  const [manualTitle, setManualTitle] = useState('');
  const [manualSlug, setManualSlug] = useState('');
  const [manualDomain, setManualDomain] = useState('General');
  const [manualMaxScore, setManualMaxScore] = useState(10);

  /* ── Step 1 → Fetch questions from scraper ────────────────────────── */
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
      setTitle(slug.trim().replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
      setStep(2);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Scraper error';
      setScrapeError(msg);
      showToast(`Scraper notice: ${msg}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipScraper = () => {
    if (!slug.trim()) {
      showToast('Please enter a contest slug first', 'error');
      return;
    }
    setTitle(slug.trim().replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
    setStep(2);
  };

  const handleAddManualQuestion = () => {
    if (!manualTitle.trim()) {
      showToast('Enter a question title', 'error');
      return;
    }
    const newQ = {
      slug: manualSlug.trim() || manualTitle.toLowerCase().replace(/\s+/g, '-'),
      displayTitle: manualTitle.trim(),
      domain: manualDomain.trim() || 'General',
      maxScore: Number(manualMaxScore) || 10,
      difficulty: 'Medium',
    };
    setQuestions((prev) => [...prev, newQ]);
    setManualTitle('');
    setManualSlug('');
    showToast(`Added "${newQ.displayTitle}" to questions list`, 'success');
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
          start_date: new Date(startDate).toISOString(),
          end_date: new Date(endDate).toISOString(),
          questions: questions.map((q) => ({
            slug: q.slug,
            title: q.displayTitle || q.questionName || q.title || q.name || q.slug,
            domain: q.domain || 'General',
            difficulty: q.difficulty || 'Medium',
            max_score: q.maxScore ?? q.max_score ?? 10,
            hackerrank_url:
              q.questionLink ||
              q.hackerrank_url ||
              `https://www.hackerrank.com/contests/${slug.trim()}/challenges/${q.slug}`,
          })),
          groups: selectedGroups,
          teams: selectedTeams,
        }),
      });

      if (res.ok) {
        showToast(`Contest "${title}" created successfully!`, 'success');
        router.push('/contests');
        router.refresh();
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create contest');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Creation error';
      showToast(`Creation failed: ${msg}`, 'error');
      setLoading(false);
    }
  };

  /* ── Computed ──────────────────────────────────────────────────────── */
  const domains = Array.from(new Set(questions.map((q) => q.domain || 'General')));
  const totalMaxScore = questions.reduce((s, q) => s + (q.maxScore ?? q.max_score ?? 10), 0);

  return (
    <div className="card" style={{ maxWidth: '840px', margin: '0 auto', padding: '1.75rem' }}>
      {/* ── Step Indicators ─────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justify: 'space-between',
          marginBottom: '1.5rem',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '1rem',
          gap: '0.75rem',
        }}
      >
        {[
          { n: 1, label: 'Scrape / Setup' },
          { n: 2, label: 'Details & Review' },
          { n: 3, label: 'Assign & Create' },
        ].map((s, idx) => (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: idx < 2 ? 1 : 'initial' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.55rem',
                cursor: step >= s.n ? 'pointer' : 'default',
              }}
              onClick={() => step > s.n && setStep(s.n)}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: step >= s.n ? 'var(--accent)' : 'var(--surface-3)',
                  color: step >= s.n ? '#fff' : 'var(--text-muted)',
                  border: step >= s.n ? '1px solid var(--accent)' : '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  boxShadow: step === s.n ? '0 0 10px var(--accent-glow)' : 'none',
                  transition: 'all 0.25s ease',
                  flexShrink: 0,
                }}
              >
                {s.n}
              </div>
              <span
                style={{
                  fontSize: '0.88rem',
                  fontWeight: step === s.n ? 800 : step > s.n ? 700 : 500,
                  color: step >= s.n ? 'var(--text-primary)' : 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.label}
              </span>
            </div>

            {idx < 2 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: step > s.n ? 'var(--accent)' : 'var(--border)',
                  minWidth: 20,
                  transition: 'background 0.3s ease',
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 1: Slug Entry & Scrape ─────────────────────────────── */}
      {step === 1 && !loading && (
        <div>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="label">HackerRank Contest Slug *</label>
            <input
              type="text"
              className="input"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setScrapeError('');
              }}
              placeholder="e.g. dsa-trainers or pascal-marathon-1"
            />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
              From <code>https://www.hackerrank.com/contests/<strong>your-slug</strong></code>
            </p>
          </div>

          {scrapeError && (
            <div
              style={{
                background: 'rgba(245,158,11,0.1)',
                border: '1px solid var(--warning)',
                borderRadius: 8,
                padding: '0.85rem 1rem',
                marginBottom: '1.25rem',
                color: 'var(--warning)',
                fontSize: '0.85rem',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: '0.2rem' }}>⚠️ Scraper Notice:</div>
              <div>{scrapeError}</div>
              <div style={{ marginTop: '0.4rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                💡 Tip: You can skip automated scraping and add/manage questions manually!
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={fetchQuestions} disabled={!slug.trim()}>
              🔍 Fetch Questions via Scraper
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleSkipScraper}
              disabled={!slug.trim()}
            >
              ✏️ Skip Scraping &amp; Continue Manually →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 1: Loading state ───────────────────────────────────── */}
      {step === 1 && loading && <ScrapingLoader />}

      {/* ── Step 2: Details & Question Preview ──────────────────────── */}
      {step === 2 && (
        <div>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="label">Contest Title *</label>
            <input type="text" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="form-group">
              <label className="label">Start Date &amp; Time *</label>
              <input
                type="datetime-local"
                className="input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="label">End Date &amp; Time *</label>
              <input
                type="datetime-local"
                className="input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* ── Questions List & Manual Addition ────────────────────────────── */}
          <div
            style={{
              background: 'var(--surface-2)',
              padding: '1.25rem',
              borderRadius: 10,
              border: '1px solid var(--border)',
              marginBottom: '1.5rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justify: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
              }}
            >
              <h3 style={{ fontWeight: 800, fontSize: '1rem', margin: 0 }}>📋 Questions ({questions.length})</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <span className="badge badge-accent">
                  {domains.length} Domain{domains.length !== 1 ? 's' : ''}
                </span>
                <span className="badge badge-muted">{totalMaxScore} pts total</span>
              </div>
            </div>

            {questions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.25rem 0', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '0.35rem' }}>📭</div>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                  No questions scraped yet. Add custom questions below or continue setup.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 260, overflowY: 'auto' }}>
                {domains.map((domain) => {
                  const domainQs = questions.filter((q) => (q.domain || 'General') === domain);
                  return (
                    <details
                      key={domain as string}
                      open
                      style={{
                        background: 'var(--surface)',
                        padding: '0.65rem 0.85rem',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                      }}
                    >
                      <summary
                        style={{
                          cursor: 'pointer',
                          fontWeight: 700,
                          display: 'flex',
                          justify: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.86rem',
                        }}
                      >
                        <span>📂 {domain as string}</span>
                        <span className="badge" style={{ background: 'var(--accent)', color: '#fff', fontSize: '0.72rem' }}>
                          {domainQs.length}
                        </span>
                      </summary>
                      <div
                        style={{
                          marginTop: '0.5rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.3rem',
                          paddingLeft: '0.65rem',
                        }}
                      >
                        {domainQs.map((q, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              justify: 'space-between',
                              alignItems: 'center',
                              fontSize: '0.84rem',
                              padding: '0.3rem 0',
                              borderBottom: idx < domainQs.length - 1 ? '1px solid var(--border)' : 'none',
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>{q.displayTitle || q.questionName || q.title || q.name || q.slug}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
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

            {/* Manual Question Addition Input Form */}
            <div
              style={{
                marginTop: '1rem',
                paddingTop: '0.85rem',
                borderTop: '1px dashed var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                ➕ Add Question Manually
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  className="input"
                  placeholder="Question Title *"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  style={{ fontSize: '0.82rem', padding: '0.4rem 0.65rem' }}
                />
                <input
                  type="text"
                  className="input"
                  placeholder="Domain (e.g. Arrays)"
                  value={manualDomain}
                  onChange={(e) => setManualDomain(e.target.value)}
                  style={{ fontSize: '0.82rem', padding: '0.4rem 0.65rem' }}
                />
                <input
                  type="number"
                  className="input"
                  placeholder="Points"
                  value={manualMaxScore}
                  onChange={(e) => setManualMaxScore(Number(e.target.value))}
                  style={{ fontSize: '0.82rem', padding: '0.4rem 0.65rem' }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleAddManualQuestion}
                  disabled={!manualTitle.trim()}
                >
                  + Add
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-secondary" onClick={() => setStep(1)}>
              ← Back
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setStep(3)}
              disabled={!startDate || !endDate}
            >
              Next: Assign →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Assign Groups & Teams ───────────────────────────── */}
      {step === 3 && (
        <div>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="label" style={{ fontWeight: 700 }}>
              Assign to Groups
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.4rem' }}>
              {groups.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No trainer groups created yet. Create groups under &quot;Groups&quot; tab first.
                </p>
              ) : (
                groups.map((g) => (
                  <label key={g.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input
                      type="checkbox"
                      checked={selectedGroups.includes(g.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedGroups([...selectedGroups, g.id]);
                        else setSelectedGroups(selectedGroups.filter((id) => id !== g.id));
                      }}
                    />
                    <span>{g.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="label" style={{ fontWeight: 700 }}>
              Assign to Teams
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.4rem' }}>
              {teams.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No distinct teams found among users.</p>
              ) : (
                teams.map((t) => (
                  <label key={t} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input
                      type="checkbox"
                      checked={selectedTeams.includes(t)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedTeams([...selectedTeams, t]);
                        else setSelectedTeams(selectedTeams.filter((id) => id !== t));
                      }}
                    />
                    <span>{t}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Summary strip */}
          <div
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.65rem 0.95rem',
              marginBottom: '1.25rem',
              display: 'flex',
              justify: 'space-between',
              fontSize: '0.85rem',
            }}
          >
            <span>
              <strong>Contest:</strong> {title}
            </span>
            <span>
              <strong>Questions:</strong> {questions.length}
            </span>
            <span>
              <strong>Groups:</strong> {selectedGroups.length} | <strong>Teams:</strong> {selectedTeams.length}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-secondary" onClick={() => setStep(2)}>
              ← Back
            </button>
            <button className="btn btn-primary" onClick={createContest} disabled={loading}>
              {loading ? 'Creating Contest…' : '🚀 Save & Publish Contest'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
