'use client';

import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/components/Toast';

interface QuestionCategoryData {
  id: string;
  title: string;
  topic: string | null;
  domain: string;
  difficulty: string;
}

interface ManageTopicsModalProps {
  contestId: string;
  contestTitle: string;
  onClose: () => void;
}

export default function ManageTopicsModal({ contestId, contestTitle, onClose }: ManageTopicsModalProps) {
  const { showToast } = useToast();
  const [questions, setQuestions] = useState<QuestionCategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modifiedQuestionIds, setModifiedQuestionIds] = useState<Set<string>>(new Set());

  // Bulk apply state
  const [bulkDomain, setBulkDomain] = useState('');
  const [selectedForBulk, setSelectedForBulk] = useState<Set<string>>(new Set());

  // Load contest questions
  useEffect(() => {
    async function loadQuestions() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/roadmaps/contests/${contestId}/questions`);
        if (res.ok) {
          const data = await res.json();
          const qs: QuestionCategoryData[] = (data.questions || []).map((q: any) => ({
            id: q.id,
            title: q.title || '',
            topic: q.topic || null,
            domain: q.domain || 'General',
            difficulty: q.difficulty || 'Medium',
          }));
          setQuestions(qs);
        } else {
          showToast('Failed to load contest questions.', 'error');
        }
      } catch {
        showToast('Error fetching questions.', 'error');
      } finally {
        setLoading(false);
      }
    }
    loadQuestions();
  }, [contestId, showToast]);

  const handleDomainChange = (questionId: string, newDomain: string) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === questionId) {
        return { ...q, domain: newDomain || 'General' };
      }
      return q;
    }));
    setModifiedQuestionIds(prev => new Set(prev).add(questionId));
  };

  const handleTopicChange = (questionId: string, newTopic: string) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === questionId) {
        return { ...q, topic: newTopic ? newTopic : null };
      }
      return q;
    }));
    setModifiedQuestionIds(prev => new Set(prev).add(questionId));
  };

  const handleBulkApply = () => {
    if (!bulkDomain.trim() || selectedForBulk.size === 0) return;

    const trimmed = bulkDomain.trim();
    setQuestions(prev => prev.map(q => {
      if (selectedForBulk.has(q.id)) {
        return { ...q, domain: trimmed };
      }
      return q;
    }));
    setModifiedQuestionIds(prev => {
      const next = new Set(prev);
      selectedForBulk.forEach(id => next.add(id));
      return next;
    });

    showToast(`Applied "${trimmed}" to ${selectedForBulk.size} question(s)`, 'success');
    setSelectedForBulk(new Set());
    setBulkDomain('');
  };

  const toggleBulkSelect = (questionId: string) => {
    setSelectedForBulk(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedForBulk.size === questions.length) {
      setSelectedForBulk(new Set());
    } else {
      setSelectedForBulk(new Set(questions.map(q => q.id)));
    }
  };

  const handleSave = async () => {
    if (modifiedQuestionIds.size === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const updates = questions.filter(q => modifiedQuestionIds.has(q.id));
      await Promise.all(
        updates.map(q =>
          fetch(`/api/admin/questions/${q.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: q.topic, domain: q.domain }),
          })
        )
      );

      showToast(`Updated categories for ${updates.length} questions!`, 'success');
      onClose();
    } catch {
      showToast('Failed to save updated question categories.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Collect unique existing domains and topics for dropdown suggestions
  const existingDomains = useMemo(() =>
    Array.from(new Set(questions.map(q => q.domain).filter(Boolean))),
    [questions]
  );
  const existingTopics = useMemo(() =>
    Array.from(new Set(questions.map(q => q.topic).filter((t): t is string => Boolean(t)))),
    [questions]
  );

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem',
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '850px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              🏷️ Manage Question Categories
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
              Contest: <strong>{contestTitle}</strong> ({questions.length} questions)
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading questions…
            </div>
          ) : questions.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No questions found in this contest. Scrape the contest first to load questions.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Info text */}
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                The <strong>Category</strong> (domain) controls how questions are grouped in the contest view.
                The <strong>Topic</strong> is a secondary label for additional classification.
              </p>

              {/* Bulk Apply Section */}
              <div style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '0.65rem 0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                flexWrap: 'wrap',
              }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  ⚡ Bulk Apply:
                </span>
                <button
                  onClick={toggleSelectAll}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}
                >
                  {selectedForBulk.size === questions.length ? 'Deselect All' : 'Select All'}
                </button>
                <input
                  type="text"
                  list="bulk-domain-list"
                  value={bulkDomain}
                  placeholder="Category name..."
                  onChange={e => setBulkDomain(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: '140px',
                    fontSize: '0.8rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-2)',
                    background: 'var(--surface)',
                    color: 'var(--text-primary)',
                    fontFamily: 'Outfit, sans-serif',
                  }}
                />
                <datalist id="bulk-domain-list">
                  {existingDomains.map(d => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
                <button
                  onClick={handleBulkApply}
                  className="btn btn-primary btn-sm"
                  disabled={!bulkDomain.trim() || selectedForBulk.size === 0}
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}
                >
                  Apply to {selectedForBulk.size} selected
                </button>
              </div>

              {/* Question Rows */}
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  style={{
                    background: 'var(--surface-2)',
                    border: modifiedQuestionIds.has(q.id)
                      ? '1px solid var(--accent)'
                      : '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  {/* Title Row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={selectedForBulk.has(q.id)}
                      onChange={() => toggleBulkSelect(q.id)}
                      style={{ cursor: 'pointer', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', flex: 1, minWidth: 0 }}>
                      #{idx + 1}. 📄 {q.title}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--surface)', padding: '0.1rem 0.4rem', borderRadius: '4px', flexShrink: 0 }}>
                      {q.difficulty}
                    </span>
                  </div>

                  {/* Category & Topic Inputs */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {/* Domain / Category Input */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        📂 Category:
                      </label>
                      <input
                        type="text"
                        list={`domains-list-${contestId}`}
                        value={q.domain}
                        placeholder="e.g. Arrays, Strings, DP..."
                        onChange={e => handleDomainChange(q.id, e.target.value)}
                        style={{
                          flex: 1,
                          fontSize: '0.82rem',
                          padding: '0.3rem 0.6rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-2)',
                          background: 'var(--surface)',
                          color: 'var(--text-primary)',
                          fontFamily: 'Outfit, sans-serif',
                          fontWeight: 600,
                        }}
                      />
                    </div>

                    {/* Topic Input */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        🏷️ Topic:
                      </label>
                      <input
                        type="text"
                        list={`topics-list-${contestId}`}
                        value={q.topic || ''}
                        placeholder="Optional topic label..."
                        onChange={e => handleTopicChange(q.id, e.target.value)}
                        style={{
                          flex: 1,
                          fontSize: '0.82rem',
                          padding: '0.3rem 0.6rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-2)',
                          background: 'var(--surface)',
                          color: 'var(--text-primary)',
                          fontFamily: 'Outfit, sans-serif',
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}

              <datalist id={`domains-list-${contestId}`}>
                {existingDomains.map(domain => (
                  <option key={domain} value={domain} />
                ))}
              </datalist>
              <datalist id={`topics-list-${contestId}`}>
                {existingTopics.map(topic => (
                  <option key={topic} value={topic} />
                ))}
              </datalist>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {modifiedQuestionIds.size > 0
              ? `${modifiedQuestionIds.size} question(s) modified`
              : 'No changes yet'}
          </span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={onClose} className="btn btn-secondary" disabled={saving}>
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="btn btn-primary"
              disabled={saving || modifiedQuestionIds.size === 0}
            >
              {saving ? 'Saving…' : `💾 Save ${modifiedQuestionIds.size} Change(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
