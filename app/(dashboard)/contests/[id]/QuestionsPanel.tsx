'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function QuestionsPanel({ questions, contestSlug, contestId }: { questions: any[], contestSlug: string, contestId: string }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState('');

  const rescrapeQuestions = async () => {
    setScraping(true);
    setScrapeError('');
    try {
      // Step 1: Fetch questions from scraper
      const scrapeRes = await fetch('/api/scrape/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: contestSlug }),
      });
      const scrapeData = await scrapeRes.json();
      if (!scrapeRes.ok) throw new Error(scrapeData.error || 'Scraper failed');

      const fetched = scrapeData.questions || scrapeData.challenges || [];
      if (fetched.length === 0) {
        setScrapeError('Scraper returned 0 questions. Check if the contest slug is correct and accessible.');
        return;
      }

      // Step 2: Map fields and POST to contest API to insert into DB
      const mapped = fetched.map((q: any) => ({
        slug: q.slug,
        title: q.displayTitle || q.questionName || q.title || q.name || q.slug,
        domain: q.domain || 'General',
        difficulty: q.difficulty || 'Medium',
        max_score: q.maxScore ?? q.max_score ?? 10,
        hackerrank_url: q.questionLink || q.hackerrank_url || `https://www.hackerrank.com/contests/${contestSlug}/challenges/${q.slug}`,
      }));

      const insertRes = await fetch(`/api/contests/${contestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: mapped }),
      });
      const insertData = await insertRes.json();
      if (!insertRes.ok) throw new Error(insertData.error || 'Failed to save questions');

      // Refresh the page to show the new questions
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setScrapeError(msg);
    } finally {
      setScraping(false);
    }
  };

  // Empty state with re-scrape button
  if (questions.length === 0) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div>
        <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>No Questions Scraped</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 480, margin: '0 auto 1.25rem' }}>
          This contest has no questions in the database. Click below to scrape them from HackerRank using the contest slug <code style={{ background: 'var(--surface-2)', padding: '0.1rem 0.4rem', borderRadius: 4 }}>{contestSlug}</code>.
        </p>

        {scrapeError && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--error)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: 'var(--error)', fontSize: '0.85rem', textAlign: 'left', maxWidth: 480, margin: '0 auto 1rem' }}>
            ⚠️ {scrapeError}
          </div>
        )}

        <button className="btn btn-primary" onClick={rescrapeQuestions} disabled={scraping}>
          {scraping ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Scraping Questions…
            </span>
          ) : (
            '🔍 Scrape Questions from HackerRank'
          )}
        </button>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Questions exist — show collapsible panel
  const domains = Array.from(new Set(questions.map(q => q.domain || 'General')));

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1.25rem' }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-primary)', fontWeight: 700, fontSize: '1rem', padding: 0,
          }}
        >
          <span style={{ fontSize: '1.1rem', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}>▾</span>
          📋 Contest Questions ({questions.length})
        </button>
        <button className="btn btn-sm btn-secondary" onClick={rescrapeQuestions} disabled={scraping} style={{ fontSize: '0.78rem' }}>
          {scraping ? '⏳ Re-scraping…' : '🔄 Re-scrape'}
        </button>
      </div>

      {/* Expandable body */}
      {expanded && (
        <div style={{ padding: '0 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {scrapeError && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--error)', borderRadius: 8, padding: '0.6rem 0.75rem', color: 'var(--error)', fontSize: '0.82rem' }}>
              ⚠️ {scrapeError}
            </div>
          )}

          {domains.map(domain => {
            const domainQs = questions.filter(q => (q.domain || 'General') === domain);
            return (
              <details key={domain as string} open style={{ background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)', padding: '0.75rem 1rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>📂 {domain as string}</span>
                  <span style={{ background: 'var(--accent)', color: '#fff', padding: '0.1rem 0.5rem', borderRadius: 10, fontSize: '0.75rem', fontWeight: 700 }}>
                    {domainQs.length}
                  </span>
                </summary>
                <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column' }}>
                  {domainQs.map((q, idx) => (
                    <div
                      key={q.id || idx}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.5rem 0',
                        borderBottom: idx < domainQs.length - 1 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{q.title}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {q.difficulty || 'Medium'} &bull; {q.max_score || 10} pts
                        </div>
                      </div>
                      <a
                        href={q.hackerrank_url || `https://www.hackerrank.com/contests/${contestSlug}/challenges/${q.slug}`}
                        target="_blank" rel="noreferrer"
                        style={{
                          background: 'var(--accent)', color: '#fff',
                          padding: '0.3rem 0.75rem', borderRadius: 6,
                          fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Open ↗
                      </a>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
