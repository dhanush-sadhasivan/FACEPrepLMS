'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';

export default function QuestionsPanel({
  questions = [],
  contestSlug,
  contestId,
  platform = 'hackerrank',
}: {
  questions: any[];
  contestSlug: string;
  contestId: string;
  platform?: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();

  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all');

  // LeetCode specific state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addInput, setAddInput] = useState('');
  const [addingProblems, setAddingProblems] = useState(false);
  const [resyncing, setResyncing] = useState(false);

  // Local state for question status map
  const [enabledState, setEnabledState] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    questions.forEach((q) => {
      map[q.id] = q.is_enabled !== false;
    });
    return map;
  });

  // Inline category editing state
  const [domainState, setDomainState] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    questions.forEach((q) => {
      map[q.id] = q.domain || 'General';
    });
    return map;
  });
  const [editingDomainId, setEditingDomainId] = useState<string | null>(null);
  const [editingDomainValue, setEditingDomainValue] = useState('');
  const [savingDomainId, setSavingDomainId] = useState<string | null>(null);

  const toggleQuestionStatus = async (questionId: string, currentEnabled: boolean) => {
    setTogglingId(questionId);
    const newStatus = !currentEnabled;
    try {
      const res = await fetch(`/api/questions/${questionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: newStatus }),
      });

      if (res.ok) {
        setEnabledState((prev) => ({ ...prev, [questionId]: newStatus }));
        showToast(
          `Question ${newStatus ? 'enabled' : 'disabled & excluded from scraper'}`,
          newStatus ? 'success' : 'info'
        );
        router.refresh();
      } else {
        const data = await res.json();
        showToast(`Failed to update question: ${data.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error updating question status', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const startEditingDomain = (questionId: string) => {
    setEditingDomainId(questionId);
    setEditingDomainValue(domainState[questionId] || 'General');
  };

  const cancelEditingDomain = () => {
    setEditingDomainId(null);
    setEditingDomainValue('');
  };

  const saveDomain = async (questionId: string) => {
    const newDomain = editingDomainValue.trim() || 'General';
    setSavingDomainId(questionId);
    try {
      const res = await fetch(`/api/admin/questions/${questionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain }),
      });

      if (res.ok) {
        setDomainState((prev) => ({ ...prev, [questionId]: newDomain }));
        showToast(`Category updated to "${newDomain}"`, 'success');
        setEditingDomainId(null);
        setEditingDomainValue('');
        router.refresh();
      } else {
        const data = await res.json();
        showToast(`Failed to update category: ${data.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error updating category', 'error');
    } finally {
      setSavingDomainId(null);
    }
  };

  // Collect existing domain names for datalist suggestions
  const allDomains = useMemo(() =>
    Array.from(new Set(Object.values(domainState).filter(Boolean))),
    [domainState]
  );
  const rescrapeQuestions = async () => {
    setScraping(true);
    setScrapeError('');
    try {
      const scrapeRes = await fetch('/api/scrape/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: contestSlug }),
      });
      const scrapeData = await scrapeRes.json();
      if (!scrapeRes.ok) throw new Error(scrapeData.error || 'Scraper failed');

      const fetched = scrapeData.questions || scrapeData.challenges || [];
      if (fetched.length === 0) {
        setScrapeError('Scraper returned 0 questions. Check if the contest slug is correct and accessible on HackerRank.');
        return;
      }

      const mapped = fetched.map((q: any) => ({
        slug: q.slug,
        title: q.displayTitle || q.questionName || q.title || q.name || q.slug,
        domain: q.domain || 'General',
        difficulty: q.difficulty || 'Medium',
        max_score: q.maxScore ?? q.max_score ?? 10,
        hackerrank_url:
          q.questionLink ||
          q.hackerrank_url ||
          `https://www.hackerrank.com/contests/${contestSlug}/challenges/${q.slug}`,
      }));

      const insertRes = await fetch(`/api/contests/${contestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: mapped }),
      });
      const insertData = await insertRes.json();
      if (!insertRes.ok) throw new Error(insertData.error || 'Failed to save questions');

      showToast(`Successfully re-scraped ${mapped.length} question(s)!`, 'success');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setScrapeError(msg);
      showToast(`Re-scrape error: ${msg}`, 'error');
    } finally {
      setScraping(false);
    }
  };

  const handleAddLeetcodeProblems = async () => {
    if (!addInput.trim()) return;
    setAddingProblems(true);
    try {
      const res = await fetch('/api/leetcode/problem-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: addInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to lookup problems');
      if (!data.questions || data.questions.length === 0) {
        throw new Error('No valid LeetCode problems found in input');
      }

      const existingSlugs = new Set(questions.map((q: any) => q.slug));
      const newQuestions = data.questions.filter((q: any) => !existingSlugs.has(q.slug));

      if (newQuestions.length === 0) {
        showToast('All entered problems are already added to this contest', 'info');
        setShowAddModal(false);
        setAddInput('');
        return;
      }

      const merged = [
        ...questions.map((q: any) => ({
          slug: q.slug,
          title: q.title,
          domain: domainState[q.id] || q.domain || 'General',
          difficulty: q.difficulty || 'Medium',
          max_score: q.max_score ?? 10,
          url: q.url || q.hackerrank_url || `https://leetcode.com/problems/${q.slug}/`,
        })),
        ...newQuestions.map((q: any) => ({
          slug: q.slug,
          title: q.title,
          domain: q.domain || 'Algorithms',
          difficulty: q.difficulty || 'Medium',
          max_score: q.max_score ?? 10,
          url: q.url || `https://leetcode.com/problems/${q.slug}/`,
        })),
      ];

      const saveRes = await fetch(`/api/contests/${contestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: merged }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || 'Failed to save questions');

      showToast(`Successfully added ${newQuestions.length} problem(s)!`, 'success');
      setShowAddModal(false);
      setAddInput('');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error adding problems';
      showToast(msg, 'error');
    } finally {
      setAddingProblems(false);
    }
  };

  const handleResyncLeetcode = async () => {
    if (questions.length === 0) return;
    setResyncing(true);
    try {
      const slugs = questions.map((q: any) => q.slug);
      const res = await fetch('/api/leetcode/problem-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: slugs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to sync with LeetCode');

      const fetchedMap = new Map<string, any>((data.questions || []).map((q: any) => [q.slug, q]));
      const updated = questions.map((q: any) => {
        const fresh: any = fetchedMap.get(q.slug);
        return {
          slug: q.slug,
          title: fresh?.title || q.title,
          domain: domainState[q.id] || fresh?.domain || q.domain || 'Algorithms',
          difficulty: fresh?.difficulty || q.difficulty || 'Medium',
          max_score: fresh?.max_score ?? q.max_score ?? 10,
          url: `https://leetcode.com/problems/${q.slug}/`,
        };
      });

      const saveRes = await fetch(`/api/contests/${contestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: updated }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || 'Failed to save synced questions');

      showToast(`Successfully re-synced ${updated.length} problem(s) from LeetCode!`, 'success');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Re-sync error';
      showToast(msg, 'error');
    } finally {
      setResyncing(false);
    }
  };

  // Filtered Questions
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const isEnabled = enabledState[q.id] !== false;
      const search = searchQuery.toLowerCase().trim();
      const titleMatch = (q.title || '').toLowerCase().includes(search);
      const slugMatch = (q.slug || '').toLowerCase().includes(search);
      const currentDomain = domainState[q.id] || q.domain || '';
      const domainMatch = currentDomain.toLowerCase().includes(search);
      const matchesSearch = search === '' || titleMatch || slugMatch || domainMatch;

      if (!matchesSearch) return false;
      if (filterStatus === 'enabled') return isEnabled;
      if (filterStatus === 'disabled') return !isEnabled;
      return true;
    });
  }, [questions, enabledState, domainState, searchQuery, filterStatus]);

  // Group filtered questions by domain (using live domainState)
  const domainMap = useMemo(() => {
    const map = new Map<string, any[]>();
    filteredQuestions.forEach((q) => {
      const domain = domainState[q.id] || q.domain || 'General';
      if (!map.has(domain)) {
        map.set(domain, []);
      }
      map.get(domain)!.push(q);
    });
    return map;
  }, [filteredQuestions, domainState]);

  const domains = Array.from(domainMap.keys());
  const totalEnabled = Object.values(enabledState).filter(Boolean).length;
  const totalDisabled = questions.length - totalEnabled;

  const renderAddModal = () => (
    <div
      className="modal-overlay"
      onClick={() => { setShowAddModal(false); setAddInput(''); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '1rem',
      }}
    >
      <div
        className="card"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 540, width: '100%',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '1.5rem',
        }}
      >
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
          ➕ Add LeetCode Problems
        </h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
          Paste LeetCode problem links, slugs, or a public Problem List URL (one per line):
        </p>

        <textarea
          className="input"
          rows={6}
          value={addInput}
          onChange={e => setAddInput(e.target.value)}
          placeholder={`https://leetcode.com/problem-list/top-interview-questions/\nhttps://leetcode.com/problems/two-sum/\ntwo-sum`}
          style={{ fontFamily: 'monospace', fontSize: '0.85rem', width: '100%', marginBottom: '1rem' }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { setShowAddModal(false); setAddInput(''); }}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleAddLeetcodeProblems}
            disabled={addingProblems || !addInput.trim()}
            style={{ background: '#ffa116', borderColor: '#ffa116', color: '#000', fontWeight: 700 }}
          >
            {addingProblems ? '⏳ Importing…' : 'Import Problems'}
          </button>
        </div>
      </div>
    </div>
  );

  if (questions.length === 0) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div>
        <h3 style={{ fontWeight: 800, marginBottom: '0.5rem', fontSize: '1.15rem', color: 'var(--text-primary)' }}>
          {platform === 'leetcode' ? 'No LeetCode Problems Added' : 'No Questions Scraped'}
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: 480, margin: '0 auto 1.25rem' }}>
          {platform === 'leetcode'
            ? 'This LeetCode track has no problems configured yet. Click below to add problems or import from a LeetCode Problem List URL.'
            : (
              <>
                This contest has no questions in the database yet. Click below to scrape them directly from HackerRank using slug{' '}
                <code style={{ background: 'var(--surface-2)', padding: '0.1rem 0.4rem', borderRadius: 4, color: 'var(--accent)', fontWeight: 700 }}>{contestSlug}</code>.
              </>
            )}
        </p>

        {scrapeError && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--error)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: 'var(--error)', fontSize: '0.85rem', textAlign: 'left', maxWidth: 480, margin: '0 auto 1rem' }}>
            ⚠️ {scrapeError}
          </div>
        )}

        {platform === 'leetcode' ? (
          <button
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
            style={{ background: '#ffa116', borderColor: '#ffa116', color: '#000', fontWeight: 700 }}
          >
            ➕ Add LeetCode Problems
          </button>
        ) : (
          <button className="btn btn-primary" onClick={rescrapeQuestions} disabled={scraping}>
            {scraping ? '⏳ Scraping Questions…' : '🔍 Scrape Questions from HackerRank'}
          </button>
        )}

        {showAddModal && renderAddModal()}
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      {/* ── Top Header Toolbar ───────────────────────────────────────────── */}
      <div style={{ padding: '0.75rem 1.15rem', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>⚙️</span> Manage {platform === 'leetcode' ? 'Track Problems' : 'Contest Questions'} ({questions.length})
          </h2>
          <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {platform === 'leetcode'
              ? 'Enable or disable problems to control participant progress tracking'
              : 'Enable or disable questions to control visibility and progress scraping'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <span className="badge badge-success" style={{ fontSize: '0.72rem', fontWeight: 800 }}>
              🟢 {totalEnabled} Active
            </span>
            {totalDisabled > 0 && (
              <span className="badge badge-warning" style={{ fontSize: '0.72rem', fontWeight: 800 }}>
                🔴 {totalDisabled} Disabled
              </span>
            )}
          </div>

          {platform === 'leetcode' ? (
            <>
              <button
                className="btn btn-sm btn-secondary"
                onClick={handleResyncLeetcode}
                disabled={resyncing || questions.length === 0}
                style={{ fontSize: '0.78rem' }}
              >
                {resyncing ? '⏳ Syncing…' : '🔄 Re-sync Problem Details'}
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => setShowAddModal(true)}
                style={{ fontSize: '0.78rem', background: '#ffa116', borderColor: '#ffa116', color: '#000', fontWeight: 700 }}
              >
                ➕ Add Problems
              </button>
            </>
          ) : (
            <button className="btn btn-sm btn-secondary" onClick={rescrapeQuestions} disabled={scraping} style={{ fontSize: '0.78rem' }}>
              {scraping ? '⏳ Re-scraping…' : '🔄 Re-scrape from HackerRank'}
            </button>
          )}
        </div>
      </div>

      {/* ── Search & Filter Controls ────────────────────────────────────── */}
      <div className="search-filter-bar" style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none', marginBottom: 0, padding: '0.55rem 1.15rem' }}>
        <div className="search-box-wrapper" style={{ maxWidth: 320 }}>
          <span className="search-box-icon">🔍</span>
          <input
            type="text"
            className="search-box-input"
            placeholder="Search questions by title, slug, or domain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-pills">
          <button
            onClick={() => setFilterStatus('all')}
            className={`filter-pill ${filterStatus === 'all' ? 'active' : ''}`}
          >
            All Questions ({questions.length})
          </button>
          <button
            onClick={() => setFilterStatus('enabled')}
            className={`filter-pill ${filterStatus === 'enabled' ? 'active' : ''}`}
          >
            Active ({totalEnabled})
          </button>
          <button
            onClick={() => setFilterStatus('disabled')}
            className={`filter-pill ${filterStatus === 'disabled' ? 'active warning' : 'warning-outline'}`}
          >
            Disabled ({totalDisabled})
          </button>
        </div>
      </div>

      {/* ── Notice Banner ────────────────────────────────────────────────── */}
      <div style={{ background: 'rgba(99,102,241,0.06)', padding: '0.45rem 1.15rem', borderBottom: '1px solid var(--border)', fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <span>💡</span>
        <span>Disabled questions are hidden from trainers and excluded from points calculations &amp; progress scraping.</span>
      </div>

      {/* ── Questions List Grouped by Domain ────────────────────────────── */}
      <div style={{ padding: '0.85rem 1.15rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {scrapeError && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--error)', borderRadius: 8, padding: '0.6rem 0.75rem', color: 'var(--error)', fontSize: '0.82rem' }}>
            ⚠️ {scrapeError}
          </div>
        )}

        {domains.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No matching questions found for &quot;{searchQuery}&quot;.
          </div>
        ) : (
          domains.map((domain) => {
            const domainQs = domainMap.get(domain) || [];
            const domainActiveCount = domainQs.filter((q) => enabledState[q.id] !== false).length;
            const domainTotalPoints = domainQs.reduce((acc, curr) => acc + (curr.max_score || 10), 0);

            return (
              <details
                key={domain}
                open
                style={{
                  background: 'var(--surface-2)',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  padding: '0.65rem 0.85rem',
                }}
              >
                <summary
                  style={{
                    cursor: 'pointer',
                    fontWeight: 800,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.88rem',
                    color: 'var(--text-primary)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>📂 {domain}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      ({domainActiveCount} of {domainQs.length} active &bull; {domainTotalPoints} pts)
                    </span>
                  </div>

                  <span className="badge badge-accent" style={{ fontSize: '0.7rem', fontWeight: 800 }}>
                    {domainQs.length} Qs
                  </span>
                </summary>

                <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {domainQs.map((q, idx) => {
                    const isEnabled = enabledState[q.id] !== false;
                    const isToggling = togglingId === q.id;
                    const isEditingThisDomain = editingDomainId === q.id;
                    const isSavingThisDomain = savingDomainId === q.id;
                    const currentDomain = domainState[q.id] || q.domain || 'General';

                    return (
                      <div
                        key={q.id || idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.5rem 0.75rem',
                          borderRadius: 8,
                          background: isEnabled ? 'var(--surface)' : 'rgba(239,68,68,0.04)',
                          border: isEnabled ? '1px solid var(--border)' : '1px dashed rgba(239,68,68,0.3)',
                          opacity: isEnabled ? 1 : 0.65,
                          transition: 'all 0.18s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                          <span
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              background: isEnabled ? 'var(--surface-3)' : 'rgba(239,68,68,0.15)',
                              color: isEnabled ? 'var(--text-secondary)' : '#ef4444',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '0.7rem',
                              flexShrink: 0,
                            }}
                          >
                            {idx + 1}
                          </span>

                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.86rem', color: isEnabled ? 'var(--text-primary)' : 'var(--text-muted)', textDecoration: isEnabled ? 'none' : 'line-through' }}>
                              {q.title}
                            </div>

                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <span className="badge badge-muted" style={{ fontSize: '0.65rem', textTransform: 'capitalize' }}>
                                {q.difficulty || 'Medium'}
                              </span>
                              <span>⭐ {q.max_score || 10} Points</span>

                              {/* Inline Category Edit */}
                              {isEditingThisDomain ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <input
                                    type="text"
                                    list="inline-domain-list"
                                    value={editingDomainValue}
                                    onChange={e => setEditingDomainValue(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') saveDomain(q.id);
                                      if (e.key === 'Escape') cancelEditingDomain();
                                    }}
                                    autoFocus
                                    style={{
                                      fontSize: '0.72rem',
                                      padding: '0.1rem 0.35rem',
                                      borderRadius: '4px',
                                      border: '1px solid var(--accent)',
                                      background: 'var(--surface)',
                                      color: 'var(--text-primary)',
                                      width: '120px',
                                      fontFamily: 'Outfit, sans-serif',
                                    }}
                                  />
                                  <button
                                    onClick={() => saveDomain(q.id)}
                                    disabled={isSavingThisDomain}
                                    style={{
                                      background: 'var(--accent)',
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: '4px',
                                      fontSize: '0.65rem',
                                      padding: '0.1rem 0.3rem',
                                      cursor: 'pointer',
                                      fontWeight: 700,
                                    }}
                                  >
                                    {isSavingThisDomain ? '…' : '✓'}
                                  </button>
                                  <button
                                    onClick={cancelEditingDomain}
                                    style={{
                                      background: 'none',
                                      color: 'var(--text-muted)',
                                      border: '1px solid var(--border)',
                                      borderRadius: '4px',
                                      fontSize: '0.65rem',
                                      padding: '0.1rem 0.3rem',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    ✕
                                  </button>
                                </span>
                              ) : (
                                <span
                                  onClick={() => startEditingDomain(q.id)}
                                  title="Click to change category"
                                  style={{
                                    background: 'rgba(99,102,241,0.1)',
                                    color: 'var(--accent)',
                                    border: '1px solid rgba(99,102,241,0.25)',
                                    borderRadius: '4px',
                                    padding: '0.05rem 0.35rem',
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.2rem',
                                  }}
                                >
                                  📂 {currentDomain}
                                  <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>✎</span>
                                </span>
                              )}

                              {!isEnabled && (
                                <span style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.68rem' }}>
                                  [DISABLED / EXCLUDED]
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action Controls - Constant Column Alignment */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', flexShrink: 0, width: '180px' }}>
                          <button
                            className={`btn btn-sm ${isEnabled ? 'btn-ghost' : 'btn-secondary'}`}
                            onClick={() => toggleQuestionStatus(q.id, isEnabled)}
                            disabled={isToggling}
                            style={{
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              width: '95px',
                              height: '28px',
                              padding: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: isEnabled ? 'var(--success)' : '#ef4444',
                              borderColor: isEnabled ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)',
                              background: isEnabled ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                            }}
                          >
                            {isToggling ? 'Wait…' : isEnabled ? '🟢 Active' : '🔴 Disabled'}
                          </button>

                          <a
                            href={
                              platform === 'leetcode'
                                ? `https://leetcode.com/problems/${q.slug}/`
                                : q.hackerrank_url || `https://www.hackerrank.com/contests/${contestSlug}/challenges/${q.slug}`
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-ghost btn-sm"
                            style={{
                              fontSize: '0.74rem',
                              width: '70px',
                              height: '28px',
                              padding: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            Open ↗
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })
        )}

        {/* Domain suggestions datalist for inline editing */}
        <datalist id="inline-domain-list">
          {allDomains.map(d => (
            <option key={d} value={d} />
          ))}
        </datalist>

        {showAddModal && renderAddModal()}
      </div>
    </div>
  );
}
