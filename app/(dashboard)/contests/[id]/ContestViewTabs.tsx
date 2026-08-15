'use client';

import { useState } from 'react';
import LeaderboardTable from './LeaderboardTable';
import QuestionsPanel from './QuestionsPanel';

interface QuestionItem {
  id: string;
  title: string;
  slug: string;
  domain?: string;
  difficulty?: string;
  max_score?: number;
  hackerrank_url?: string;
}

interface ContestViewTabsProps {
  contestId: string;
  contestSlug: string;
  leaderboard: any[];
  questions: QuestionItem[];
  lastScraped: string | null;
  isAdminOrManager: boolean;
}

export default function ContestViewTabs({
  contestId,
  contestSlug,
  leaderboard,
  questions,
  lastScraped,
  isAdminOrManager,
}: ContestViewTabsProps) {
  // Leaderboard active by default for Admin/Manager; Topic Questions for Trainers!
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'topics' | 'manage'>(
    isAdminOrManager ? 'leaderboard' : 'topics'
  );
  const [openTopics, setOpenTopics] = useState<Record<string, boolean>>({});

  // Group questions by domain/topic
  const domainMap = new Map<string, QuestionItem[]>();
  questions.forEach(q => {
    const domain = q.domain || 'General';
    if (!domainMap.has(domain)) {
      domainMap.set(domain, []);
    }
    domainMap.get(domain)!.push(q);
  });

  const domains = Array.from(domainMap.keys());

  const toggleTopic = (domain: string) => {
    setOpenTopics(prev => ({ ...prev, [domain]: !prev[domain] }));
  };

  return (
    <div style={{ marginTop: '1.5rem' }}>
      {/* Tab Navigation Buttons */}
      <div style={{
        display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)',
        marginBottom: '1.5rem', paddingBottom: '0.25rem', flexWrap: 'wrap',
      }}>
        {isAdminOrManager && (
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`btn ${activeTab === 'leaderboard' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
          >
            🏆 Full Leaderboard ({leaderboard.length})
          </button>
        )}

        <button
          onClick={() => setActiveTab('topics')}
          className={`btn ${activeTab === 'topics' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
        >
          📂 Topic-wise Questions ({domains.length} Topics · {questions.length} Questions)
        </button>

        {isAdminOrManager && (
          <button
            onClick={() => setActiveTab('manage')}
            className={`btn ${activeTab === 'manage' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginLeft: 'auto' }}
          >
            ⚙️ Manage Questions ({questions.length})
          </button>
        )}
      </div>

      {/* ── TAB 1: LEADERBOARD (ADMIN & MANAGER ONLY) ────────────────────────── */}
      {activeTab === 'leaderboard' && isAdminOrManager && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>📊 Full Contest Leaderboard</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Showing {leaderboard.length} assigned participants
            </span>
          </div>
          <LeaderboardTable contestId={contestId} data={leaderboard} lastScraped={lastScraped} questions={questions} isAdminOrManager={isAdminOrManager} />
        </div>
      )}

      {/* ── TAB 2: TOPIC-WISE QUESTIONS DROPDOWNS ──────────────────────────── */}
      {activeTab === 'topics' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>📂 Topic-wise Questions</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                Select a topic dropdown below to view questions and open them directly in HackerRank.
              </p>
            </div>
            <button
              onClick={() => {
                const anyOpen = domains.some(d => Boolean(openTopics[d]));
                const nextState: Record<string, boolean> = {};
                domains.forEach(d => { nextState[d] = !anyOpen; });
                setOpenTopics(nextState);
              }}
              className="btn btn-secondary btn-sm"
            >
              {domains.some(d => Boolean(openTopics[d])) ? 'Collapse All Dropdowns' : 'Expand All Dropdowns'}
            </button>
          </div>

          {questions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div>
              <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>No Questions Available</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Questions for this contest haven&apos;t been added yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {domains.map((domain, dIdx) => {
                const qList = domainMap.get(domain) || [];
                const isOpen = openTopics[domain] ?? false; // Collapsed by default

                return (
                  <div
                    key={domain}
                    style={{
                      border: '1px solid var(--border)', borderRadius: 12,
                      background: 'var(--surface)', overflow: 'hidden',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    {/* Topic Header Dropdown Toggle */}
                    <div
                      onClick={() => toggleTopic(domain)}
                      style={{
                        padding: '1rem 1.25rem', background: 'var(--surface-2)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        cursor: 'pointer', userSelect: 'none',
                        borderBottom: isOpen ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.2rem' }}>{isOpen ? '📂' : '📁'}</span>
                        <div>
                          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                            Topic {dIdx + 1}: {domain}
                          </h3>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {qList.length} {qList.length === 1 ? 'question' : 'questions'}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span className="badge badge-accent" style={{ fontWeight: 700 }}>
                          {qList.length} Qs
                        </span>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                          {isOpen ? '▲' : '▼'}
                        </span>
                      </div>
                    </div>

                    {/* Topic Questions List */}
                    {isOpen && (
                      <div style={{ padding: '0.5rem 1.25rem 1rem 1.25rem' }}>
                        {qList.map((q, qIdx) => (
                          <div
                            key={q.id || qIdx}
                            style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '0.75rem 0', borderBottom: qIdx === qList.length - 1 ? 'none' : '1px solid var(--border)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                              <span style={{
                                width: 24, height: 24, borderRadius: '50%', background: 'var(--surface-3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0,
                                marginTop: '0.1rem',
                              }}>
                                {qIdx + 1}
                              </span>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                                  {q.title}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'flex', gap: '0.75rem' }}>
                                  <span className="badge badge-muted" style={{ textTransform: 'capitalize' }}>
                                    {q.difficulty || 'Medium'}
                                  </span>
                                  <span>⭐ {q.max_score || 10} Points</span>
                                  <code style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{q.slug}</code>
                                </div>
                              </div>
                            </div>

                            <a
                              href={q.hackerrank_url || `https://www.hackerrank.com/contests/${contestSlug}/challenges/${q.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-primary btn-sm"
                              style={{ flexShrink: 0, marginLeft: '1rem' }}
                            >
                              Open in HackerRank ↗
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: MANAGE QUESTIONS (ADMIN / MANAGER ONLY) ─────────────────── */}
      {activeTab === 'manage' && isAdminOrManager && (
        <div>
          <QuestionsPanel questions={questions} contestSlug={contestSlug} contestId={contestId} />
        </div>
      )}
    </div>
  );
}
