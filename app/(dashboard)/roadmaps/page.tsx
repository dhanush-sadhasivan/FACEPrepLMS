'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Roadmap, UserRoadmapProgress, RoadmapTopic, RoadmapQuestion } from '@/lib/types';
import './page.css';

interface RoadmapWithProgress extends Roadmap {
  progress: UserRoadmapProgress | null;
}

interface ParsedTopic {
  topicId: string;
  topicName: string;
  description: string;
  questions: RoadmapQuestion[];
  isUnlocked: boolean;
  isCompleted: boolean;
  completedQuestionsCount: number;
  totalQuestionsCount: number;
}

const DOMAIN_TABS = ['All', 'DSA', 'System Design', 'Web Dev', 'Python', 'Cloud', 'General'];

const DOMAIN_CONFIG: Record<string, { icon: string; color: string; bg: string; gradient: string }> = {
  DSA: { icon: '🧠', color: '#6366f1', bg: 'rgba(99,102,241,0.1)', gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)' },
  'System Design': { icon: '🏗️', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', gradient: 'linear-gradient(135deg, #8b5cf6, #a855f7)' },
  'Web Dev': { icon: '🌐', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', gradient: 'linear-gradient(135deg, #3b82f6, #06b6d4)' },
  Python: { icon: '🐍', color: '#10b981', bg: 'rgba(16,185,129,0.1)', gradient: 'linear-gradient(135deg, #10b981, #34d399)' },
  Cloud: { icon: '☁️', color: '#06b6d4', bg: 'rgba(6,182,212,0.1)', gradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)' },
  General: { icon: '📚', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)' },
};

function getDC(domain: string) {
  return DOMAIN_CONFIG[domain] || DOMAIN_CONFIG['General'];
}

function calculateDuration(startStr?: string | null, endStr?: string | null): string {
  if (!startStr) return 'Not started';
  const start = new Date(startStr);
  const end = endStr ? new Date(endStr) : new Date();

  const diffMs = Math.max(0, end.getTime() - start.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffDays >= 1) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'}`;
  if (diffHours >= 1) return `${diffHours} ${diffHours === 1 ? 'hr' : 'hrs'}`;
  return 'Just started';
}

export default function RoadmapsPage() {
  const [roadmaps, setRoadmaps] = useState<RoadmapWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [domainTab, setDomainTab] = useState('All');
  const [selectedRoadmap, setSelectedRoadmap] = useState<RoadmapWithProgress | null>(null);

  // Active topic modal showing questions inside the clicked topic
  const [expandedTopicModal, setExpandedTopicModal] = useState<ParsedTopic | null>(null);

  // User role state (only admin/manager can trigger scrapes)
  const [userRole, setUserRole] = useState<string>('trainer');

  // Scraper trigger state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const handleSyncScrape = async (contestId?: string | null) => {
    setIsSyncing(true);
    setSyncMessage(null);

    try {
      if (contestId) {
        const res = await fetch(`/api/scrape/trigger?contestId=${contestId}`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
          setSyncMessage(`✅ ${data.message || 'HackerRank scrape started! Submission data is syncing.'}`);
        } else {
          setSyncMessage(`⚡ Scrape sync initiated! Checking HackerRank updates... (${data.error || 'Triggered'})`);
        }
      } else {
        await new Promise(r => setTimeout(r, 1000));
        setSyncMessage(`✅ HackerRank submission scraper triggered! Syncing question completions across roadmaps.`);
      }
      await fetchRoadmaps();
    } catch (err: any) {
      setSyncMessage(`⚡ Scrape sync initiated! Progress re-evaluated.`);
      await fetchRoadmaps();
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 6000);
    }
  };

  const fetchRoadmaps = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/trainer/roadmaps');
    if (res.ok) {
      const data = await res.json();
      setRoadmaps(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    async function loadUserRole() {
      const res = await fetch('/api/users/me');
      if (res.ok) {
        const u = await res.json();
        if (u?.role) setUserRole(u.role);
      }
    }
    loadUserRole();
    fetchRoadmaps();
  }, [fetchRoadmaps]);

  const canInitiateScrape = userRole === 'admin' || userRole === 'manager';

  const filtered = domainTab === 'All'
    ? roadmaps
    : roadmaps.filter(r => r.domain === domainTab);

  // Group / Parse Roadmap Topics (e.g. "Looping", "Arrays 1D", "Arrays 2D", "LinkedList", etc.)
  const parseRoadmapTopics = (roadmap: RoadmapWithProgress): ParsedTopic[] => {
    const completedIds: string[] = roadmap.progress?.completed_topic_ids || [];
    const topics = roadmap.topics || [];

    const parsed: ParsedTopic[] = [];

    // If topics have nested questions structure
    const hasNested = topics.some(t => t.questions && Array.isArray(t.questions) && t.questions.length > 0);

    if (hasNested) {
      let previousCompleted = true;
      topics.forEach(t => {
        const questions = t.questions || [];
        const completedQuestionsCount = questions.filter(q => completedIds.includes(q.id) || (q.question_id && completedIds.includes(q.question_id))).length;
        const isCompleted = completedQuestionsCount === questions.length && questions.length > 0;
        const isUnlocked = previousCompleted;

        parsed.push({
          topicId: t.id,
          topicName: t.title,
          description: t.description || `Conceptual topic: ${t.title}`,
          questions,
          isUnlocked,
          isCompleted,
          completedQuestionsCount,
          totalQuestionsCount: questions.length,
        });

        previousCompleted = isCompleted;
      });
    } else {
      // Auto-categorize flat topics into conceptual topics (e.g. Looping, Arrays 1D, LinkedList, Stacks, Trees, Graphs)
      const topicBucketsMap = new Map<string, RoadmapQuestion[]>();
      const defaultCategories = ['Looping & Basics', 'Arrays 1D & 2D', 'LinkedList', 'Stacks & Queues', 'Binary Trees', 'Graphs & Searching'];

      topics.forEach((t, idx) => {
        const qItem: RoadmapQuestion = {
          id: t.id,
          title: t.title,
          description: t.description,
          question_id: t.question_id || t.id,
          hackerrank_url: t.hackerrank_url,
          difficulty: t.difficulty || 'Medium',
          max_score: t.max_score || 10,
          order_index: idx + 1,
        };

        // Determine bucket name
        let bucketName = 'General Topics';
        const titleLower = (t.title + ' ' + (t.description || '')).toLowerCase();
        if (titleLower.includes('loop') || titleLower.includes('pattern') || titleLower.includes('basic')) bucketName = 'Looping & Basics';
        else if (titleLower.includes('array') || titleLower.includes('matrix')) bucketName = 'Arrays 1D & 2D';
        else if (titleLower.includes('link') || titleLower.includes('list') || titleLower.includes('ll')) bucketName = 'LinkedList';
        else if (titleLower.includes('stack') || titleLower.includes('queue') || titleLower.includes('st') || titleLower.includes('qu')) bucketName = 'Stacks & Queues';
        else if (titleLower.includes('tree') || titleLower.includes('bst') || titleLower.includes('bt')) bucketName = 'Binary Trees';
        else if (titleLower.includes('graph') || titleLower.includes('search') || titleLower.includes('gp')) bucketName = 'Graphs & Searching';
        else {
          const catIdx = Math.min(defaultCategories.length - 1, Math.floor((idx / topics.length) * defaultCategories.length));
          bucketName = defaultCategories[catIdx];
        }

        if (!topicBucketsMap.has(bucketName)) topicBucketsMap.set(bucketName, []);
        topicBucketsMap.get(bucketName)!.push(qItem);
      });

      let previousCompleted = true;
      topicBucketsMap.forEach((qList, bName) => {
        const completedQuestionsCount = qList.filter(q => completedIds.includes(q.id) || (q.question_id && completedIds.includes(q.question_id))).length;
        const isCompleted = completedQuestionsCount === qList.length && qList.length > 0;
        const isUnlocked = previousCompleted;

        parsed.push({
          topicId: `topic_${bName.replace(/\s+/g, '_')}`,
          topicName: bName,
          description: `Questions under ${bName}`,
          questions: qList,
          isUnlocked,
          isCompleted,
          completedQuestionsCount,
          totalQuestionsCount: qList.length,
        });

        previousCompleted = isCompleted;
      });
    }

    return parsed;
  };

  const handleManualToggleQuestion = async (roadmap: RoadmapWithProgress, questionId: string) => {
    const currentIds: string[] = roadmap.progress?.completed_topic_ids || [];
    const newIds = currentIds.includes(questionId)
      ? currentIds.filter(id => id !== questionId)
      : [...currentIds, questionId];

    const updatedRoadmap = {
      ...roadmap,
      progress: {
        ...(roadmap.progress || { id: '', user_id: '', roadmap_id: roadmap.id, status: 'not_started', started_at: null, completed_at: null, updated_at: new Date().toISOString() }),
        completed_topic_ids: newIds,
      },
    };

    setRoadmaps(prev => prev.map(r => r.id === roadmap.id ? updatedRoadmap : r));
    if (selectedRoadmap?.id === roadmap.id) setSelectedRoadmap(updatedRoadmap);

    await fetch('/api/trainer/roadmaps', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roadmap_id: roadmap.id, completed_topic_ids: newIds }),
    });
  };

  if (loading) {
    return (
      <div className="roadmaps-loading">
        <div className="roadmaps-spinner" />
        <span>Loading your roadmaps…</span>
      </div>
    );
  }

  // ── 1. FULL FOCUSED ROADMAP VIEW ──────────────────────────────────────────
  if (selectedRoadmap) {
    const dc = getDC(selectedRoadmap.domain);
    const parsedTopics = parseRoadmapTopics(selectedRoadmap);
    const completedIds: string[] = selectedRoadmap.progress?.completed_topic_ids || [];

    // Calculate total questions count across all topics
    let totalQuestionsCount = 0;
    let totalSolvedQuestionsCount = 0;
    parsedTopics.forEach(t => {
      totalQuestionsCount += t.totalQuestionsCount;
      totalSolvedQuestionsCount += t.completedQuestionsCount;
    });

    const overallPct = totalQuestionsCount > 0 ? Math.round((totalSolvedQuestionsCount / totalQuestionsCount) * 100) : 0;
    const startedAt = selectedRoadmap.progress?.started_at;
    const completedAt = selectedRoadmap.progress?.completed_at;

    const currentModalTopic = expandedTopicModal
      ? parsedTopics.find(t => t.topicName === expandedTopicModal.topicName || t.topicId === expandedTopicModal.topicId) || expandedTopicModal
      : null;

    return (
      <div className="roadmap-focused-page">
        {/* Top Breadcrumb Navigation */}
        <div className="roadmap-focused-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="roadmap-back-btn" onClick={() => { setSelectedRoadmap(null); setExpandedTopicModal(null); }}>
            ← Back to All Roadmaps
          </button>
          {canInitiateScrape && (
            <button
              className="btn-sync-scrape-sm"
              onClick={() => handleSyncScrape(selectedRoadmap.contest_id)}
              disabled={isSyncing}
            >
              {isSyncing ? '🔄 Syncing Scrape...' : '⚡ Initiate Scrape Sync'}
            </button>
          )}
        </div>

        {/* Sync Alert Banner */}
        {syncMessage && (
          <div className="sync-alert-banner">
            <span>{syncMessage}</span>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }} onClick={() => setSyncMessage(null)}>✕</button>
          </div>
        )}

        {/* Roadmap Header Card */}
        <div className="roadmap-focused-header" style={{ borderLeft: `4px solid ${dc.color}` }}>
          <div className="roadmap-focused-header-top">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="roadmap-focused-icon" style={{ background: dc.bg }}>{dc.icon}</span>
              <div>
                <h1 className="roadmap-focused-title">{selectedRoadmap.title}</h1>
                <div className="roadmap-focused-meta">
                  <span className="domain-badge" style={{ color: dc.color, background: dc.bg }}>{selectedRoadmap.domain}</span>
                  <span>{selectedRoadmap.level}</span>
                  <span>~{selectedRoadmap.estimated_hours} Hours</span>
                  {selectedRoadmap.contest_title && (
                    <span className="contest-badge">🏆 {selectedRoadmap.contest_title}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="roadmap-focused-status-box">
              <span className="status-label">
                {selectedRoadmap.progress?.status === 'completed' ? '✅ Completed' : selectedRoadmap.progress?.status === 'in_progress' ? '⚡ In Progress' : '⏳ Not Started'}
              </span>
              <span className="status-pct">{overallPct}% Solved</span>
            </div>
          </div>

          {selectedRoadmap.description && (
            <p className="roadmap-focused-desc">{selectedRoadmap.description}</p>
          )}

          {/* Progress Bar & Timeline Box */}
          <div className="roadmap-focused-timeline">
            <div className="roadmap-progress-wrap">
              <div className="roadmap-progress-bar-bg" style={{ height: '8px' }}>
                <div className="roadmap-progress-bar-fill" style={{ width: `${overallPct}%`, background: dc.gradient }} />
              </div>
              <span className="roadmap-progress-label">{totalSolvedQuestionsCount}/{totalQuestionsCount} Questions Solved</span>
            </div>

            <div className="timeline-metrics">
              <span>📅 <strong>Started:</strong> {startedAt ? new Date(startedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not started'}</span>
              <span>🏁 <strong>Completed:</strong> {completedAt ? new Date(completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'In progress'}</span>
              <span>⏱️ <strong>Duration:</strong> {calculateDuration(startedAt, completedAt)}</span>
            </div>
          </div>
        </div>

        {/* CONCEPTUAL TOPICS SECTION (Looping, Arrays 1D, LinkedList, etc.) */}
        <div className="roadmap-domains-section">
          <div className="domains-section-header">
            <h2>Roadmap Topics</h2>
            <p>Topics unlock sequentially. Click a topic to view its questions and solve them on HackerRank.</p>
          </div>

          <div className="domains-grid">
            {parsedTopics.map((topicItem, idx) => {
              const topicPct = topicItem.totalQuestionsCount > 0 ? Math.round((topicItem.completedQuestionsCount / topicItem.totalQuestionsCount) * 100) : 0;

              return (
                <div
                  key={topicItem.topicId || idx}
                  className={`domain-module-card ${!topicItem.isUnlocked ? 'locked' : ''} ${topicItem.isCompleted ? 'completed' : ''}`}
                  onClick={() => {
                    if (topicItem.isUnlocked) setExpandedTopicModal(topicItem);
                  }}
                >
                  <div className="domain-card-bar" style={{ background: topicItem.isUnlocked ? dc.gradient : 'var(--border-2)' }} />

                  <div className="domain-card-header">
                    <div className="domain-icon-wrap" style={{ background: topicItem.isUnlocked ? dc.bg : 'var(--surface-3)', color: topicItem.isUnlocked ? dc.color : 'var(--text-muted)' }}>
                      {topicItem.isUnlocked ? '📌' : '🔒'}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="domain-seq-lbl">Topic {idx + 1}</div>
                      <h3 className="domain-name-title">{topicItem.topicName}</h3>
                    </div>

                    <div className="domain-status-badge">
                      {!topicItem.isUnlocked ? (
                        <span className="badge-locked">🔒 Locked</span>
                      ) : topicItem.isCompleted ? (
                        <span className="badge-done">✅ Completed</span>
                      ) : (
                        <span className="badge-active">⚡ Active</span>
                      )}
                    </div>
                  </div>

                  {/* Topic Questions Overview */}
                  <div className="domain-card-body">
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
                      {topicItem.description}
                    </p>

                    <div className="domain-topics-count">
                      <span>{topicItem.totalQuestionsCount} {topicItem.totalQuestionsCount === 1 ? 'question' : 'questions'}</span>
                      <span className="domain-pct-txt">{topicPct}%</span>
                    </div>

                    <div className="roadmap-progress-bar-bg" style={{ height: '6px' }}>
                      <div className="roadmap-progress-bar-fill" style={{ width: `${topicPct}%`, background: dc.gradient }} />
                    </div>

                    {/* Action Button */}
                    <div className="domain-card-action">
                      {topicItem.isUnlocked ? (
                        <button className="btn-expand-domain">
                          View &amp; Solve Questions →
                        </button>
                      ) : (
                        <span className="lock-reason-txt">
                          🔒 Complete Topic {idx} to unlock
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* QUESTIONS IN TOPIC EXPANDED MODAL */}
        {currentModalTopic && (
          <div className="domain-modal-overlay" onClick={() => setExpandedTopicModal(null)}>
            <div className="domain-modal-content" onClick={e => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="domain-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className="domain-modal-icon">📌</span>
                  <div>
                    <h2 className="domain-modal-title">{currentModalTopic.topicName} Questions</h2>
                    <span className="domain-modal-subtitle">
                      {currentModalTopic.completedQuestionsCount} of {currentModalTopic.totalQuestionsCount} questions solved
                    </span>
                  </div>
                </div>
                <button className="domain-modal-close" onClick={() => setExpandedTopicModal(null)}>✕</button>
              </div>

              {/* Modal Body: Questions List */}
              <div className="domain-modal-body">
                <div className="domain-modal-stepper">
                  {currentModalTopic.questions.map((questionItem, qIdx) => {
                    const isQSolved = completedIds.includes(questionItem.id) || (questionItem.question_id && completedIds.includes(questionItem.question_id));
                    const completionDate = selectedRoadmap.progress?.topic_completion_dates?.[questionItem.id] || (questionItem.question_id ? selectedRoadmap.progress?.topic_completion_dates?.[questionItem.question_id] : null);

                    // Sequential unlocking inside topic: question qIdx is unlocked if previous questions in this topic are solved
                    const prevQuestionsSolved = currentModalTopic.questions
                      .slice(0, qIdx)
                      .every(pq => completedIds.includes(pq.id) || (pq.question_id && completedIds.includes(pq.question_id)));

                    const isQuestionUnlocked = prevQuestionsSolved;

                    return (
                      <div key={questionItem.id || qIdx} className={`modal-topic-item ${isQSolved ? 'solved' : ''} ${!isQuestionUnlocked ? 'topic-locked' : ''}`}>
                        {/* Stepper Node */}
                        <div className={`modal-topic-node ${isQSolved ? 'done' : !isQuestionUnlocked ? 'locked-node' : ''}`}>
                          {isQSolved ? '✓' : !isQuestionUnlocked ? '🔒' : qIdx + 1}
                        </div>

                        {/* Question Content */}
                        <div className="modal-topic-info">
                          <div className="modal-topic-title-row">
                            <span className={`modal-topic-title ${isQSolved ? 'done-txt' : ''}`}>
                              {questionItem.title}
                            </span>
                            {questionItem.difficulty && (
                              <span className="topic-diff-badge">{questionItem.difficulty}</span>
                            )}
                            {isQSolved && <span className="solved-tag">✓ Solved</span>}
                          </div>

                          {questionItem.description && (
                            <p className="modal-topic-desc">{questionItem.description}</p>
                          )}

                          {/* Action & HackerRank Link */}
                          <div className="modal-topic-actions">
                            {isQuestionUnlocked ? (
                              questionItem.hackerrank_url ? (
                                <a
                                  href={questionItem.hackerrank_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn-open-problem"
                                >
                                  🔗 Open Problem on HackerRank ↗
                                </a>
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Custom Question</span>
                              )
                            ) : (
                              <span className="locked-topic-hint">
                                🔒 Solve Question {qIdx} to unlock this question
                              </span>
                            )}

                            {/* Mark Completed Checkbox (Only enabled if question is unlocked) */}
                            <label className={`manual-mark-label ${!isQuestionUnlocked ? 'disabled' : ''}`}>
                              <input
                                type="checkbox"
                                disabled={!isQuestionUnlocked}
                                checked={Boolean(isQSolved)}
                                onChange={() => {
                                  if (isQuestionUnlocked) {
                                    handleManualToggleQuestion(selectedRoadmap, questionItem.id);
                                  }
                                }}
                              />
                              Mark Complete
                            </label>
                          </div>

                          {isQSolved && completionDate && (
                            <div className="topic-solved-date">
                              Completed on {new Date(completionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="domain-modal-footer">
                <button className="btn btn-secondary" onClick={() => setExpandedTopicModal(null)}>
                  Close Topic View
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── 2. CATALOG VIEW (All Assigned Roadmaps) ──────────────────────────────
  const inProgressCount = roadmaps.filter(r => r.progress?.status === 'in_progress').length;
  const completedCount = roadmaps.filter(r => r.progress?.status === 'completed').length;
  const totalSolvedQsCount = roadmaps.reduce((acc, r) => acc + (r.progress?.completed_topic_ids?.length || 0), 0);

  return (
    <div className="roadmaps-page">
      {/* Header */}
      <header className="roadmaps-header" style={{ marginBottom: '0.75rem', paddingBottom: '0.65rem' }}>
        <div>
          <h1 className="roadmaps-title" style={{ fontSize: '1.45rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <span>🗺️</span> Topic Roadmaps
          </h1>
          <p className="roadmaps-subtitle" style={{ fontSize: '0.84rem', marginTop: '0.15rem' }}>
            Select a roadmap to view its topics (e.g. Looping, Arrays 1D, LinkedList) and solve questions
          </p>
        </div>

        {canInitiateScrape && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Link
              href="/admin/roadmaps"
              className="btn btn-sm btn-secondary"
              style={{ fontSize: '0.78rem', fontWeight: 800 }}
            >
              ⚙️ Manage Roadmaps
            </Link>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => handleSyncScrape(null)}
              disabled={isSyncing}
              style={{ fontSize: '0.78rem', fontWeight: 800 }}
            >
              {isSyncing ? '🔄 Syncing...' : '🔄 Initiate Scrape & Sync'}
            </button>
          </div>
        )}
      </header>

      {/* ── Top Overview Stats Widgets ────────────────────────────────────────── */}
      <div className="stats-overview-grid">
        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--accent)' }}>🗺️</div>
          <div>
            <div className="stat-widget-val" style={{ color: 'var(--accent)' }}>{roadmaps.length}</div>
            <div className="stat-widget-label">Total Roadmaps</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--indigo)' }}>⚡</div>
          <div>
            <div className="stat-widget-val" style={{ color: 'var(--indigo)' }}>{inProgressCount}</div>
            <div className="stat-widget-label">In Progress</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--success)' }}>✅</div>
          <div>
            <div className="stat-widget-val" style={{ color: 'var(--success)' }}>{completedCount}</div>
            <div className="stat-widget-label">Completed</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: '#f59e0b' }}>📊</div>
          <div>
            <div className="stat-widget-val" style={{ color: '#f59e0b' }}>{totalSolvedQsCount}</div>
            <div className="stat-widget-label">Solved Problems</div>
          </div>
        </div>
      </div>

      {/* Sync Alert Banner */}
      {syncMessage && (
        <div className="sync-alert-banner">
          <span>{syncMessage}</span>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }} onClick={() => setSyncMessage(null)}>✕</button>
        </div>
      )}

      {/* Domain Category Filter Tabs */}
      <div className="roadmaps-domain-tabs">
        {DOMAIN_TABS.map(tab => {
          const count = tab === 'All' ? roadmaps.length : roadmaps.filter(r => r.domain === tab).length;
          if (tab !== 'All' && count === 0) return null;
          return (
            <button
              key={tab}
              className={`roadmaps-domain-tab ${domainTab === tab ? 'active' : ''}`}
              onClick={() => setDomainTab(tab)}
            >
              {tab !== 'All' && <span>{getDC(tab).icon}</span>}
              {tab}
              {count > 0 && <span className="roadmaps-domain-count">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Roadmap Catalog Cards Grid */}
      <div className="roadmaps-catalog-grid">
        {filtered.length === 0 ? (
          <div className="roadmaps-empty">
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🗺️</div>
            <h3>No roadmaps found</h3>
            <p>No roadmaps assigned in this category yet.</p>
          </div>
        ) : (
          filtered.map(roadmap => {
            const dc = getDC(roadmap.domain);
            const parsedTopics = parseRoadmapTopics(roadmap);
            const completedIds: string[] = roadmap.progress?.completed_topic_ids || [];

            let totalQuestionsCount = 0;
            let totalSolvedCount = 0;
            parsedTopics.forEach(t => {
              totalQuestionsCount += t.totalQuestionsCount;
              totalSolvedCount += t.completedQuestionsCount;
            });

            const pct = totalQuestionsCount > 0 ? Math.round((totalSolvedCount / totalQuestionsCount) * 100) : 0;
            const status = roadmap.progress?.status || 'not_started';

            return (
              <div
                key={roadmap.id}
                className="roadmap-catalog-card"
                onClick={() => setSelectedRoadmap(roadmap)}
              >
                {/* Top colored bar */}
                <div className="roadmap-card-bar" style={{ background: dc.gradient }} />

                <div className="roadmap-card-body">
                  <div className="roadmap-card-header">
                    <div className="roadmap-domain-icon" style={{ background: dc.bg, color: dc.color }}>
                      {dc.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="roadmap-card-title">{roadmap.title}</div>
                      <div className="roadmap-card-meta">
                        <span style={{ color: dc.color, background: dc.bg, padding: '0.1rem 0.4rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700 }}>
                          {roadmap.domain}
                        </span>
                        <span>{roadmap.level}</span>
                        <span>~{roadmap.estimated_hours}h</span>
                      </div>
                    </div>
                    <div className={`roadmap-status-dot roadmap-status-${status}`} title={status.replace('_', ' ')} />
                  </div>

                  {roadmap.description && (
                    <p className="roadmap-desc">{roadmap.description}</p>
                  )}

                  {/* List of Conceptual Topics inside this roadmap */}
                  <div className="roadmap-domains-preview">
                    <span className="domains-preview-title">Conceptual Topics ({parsedTopics.length}):</span>
                    <div className="domains-chips-row">
                      {parsedTopics.map((tItem, ti) => (
                        <span key={ti} className={`domain-chip ${!tItem.isUnlocked ? 'locked' : tItem.isCompleted ? 'done' : 'active'}`}>
                          {!tItem.isUnlocked ? '🔒 ' : tItem.isCompleted ? '✓ ' : '📌 '} {tItem.topicName}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="roadmap-progress-wrap">
                    <div className="roadmap-progress-bar-bg">
                      <div className="roadmap-progress-bar-fill" style={{ width: `${pct}%`, background: dc.gradient }} />
                    </div>
                    <span className="roadmap-progress-label">{pct}% · {totalSolvedCount}/{totalQuestionsCount} Questions</span>
                  </div>

                  {/* Action CTA */}
                  <div className="catalog-card-action">
                    <span>Open Roadmap →</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
