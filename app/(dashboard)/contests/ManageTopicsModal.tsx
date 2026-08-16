'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';

interface QuestionTopicData {
  id: string;
  title: string;
  topic: string | null;
  difficulty: string;
}

interface ManageTopicsModalProps {
  contestId: string;
  contestTitle: string;
  onClose: () => void;
}

export default function ManageTopicsModal({ contestId, contestTitle, onClose }: ManageTopicsModalProps) {
  const { showToast } = useToast();
  const [questions, setQuestions] = useState<QuestionTopicData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modifiedQuestionIds, setModifiedQuestionIds] = useState<Set<string>>(new Set());

  // Load contest questions
  useEffect(() => {
    async function loadQuestions() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/roadmaps/contests/${contestId}/questions`);
        if (res.ok) {
          const data = await res.json();
          const qs: QuestionTopicData[] = (data.questions || []).map((q: any) => ({
            id: q.id,
            title: q.title || '',
            topic: q.topic || null,
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

  const handleTopicChange = (questionId: string, newTopic: string) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === questionId) {
        return { ...q, topic: newTopic ? newTopic : null };
      }
      return q;
    }));
    setModifiedQuestionIds(prev => new Set(prev).add(questionId));
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
            body: JSON.stringify({ topic: q.topic }),
          })
        )
      );

      showToast(`Updated topics for ${updates.length} questions in DB!`, 'success');
      onClose();
    } catch {
      showToast('Failed to save updated question topics.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Collect unique existing topics in this contest for dropdown suggestions
  const existingTopics = Array.from(
    new Set(questions.map(q => q.topic).filter((t): t is string => Boolean(t)))
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
        maxWidth: '750px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              🏷️ Manage Question Topics
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
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                Review and edit the DB topic assigned to each question. Unclassified questions have an empty topic field.
              </p>

              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  style={{
                    background: 'var(--surface-2)',
                    border: q.topic ? '1px solid var(--border)' : '1px solid var(--warning)',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      #{idx + 1}. 📄 {q.title}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--surface)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                      {q.difficulty}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      DB Topic:
                    </label>

                    {/* Topic Input with DataList suggestions */}
                    <input
                      type="text"
                      list={`topics-list-${contestId}`}
                      value={q.topic || ''}
                      placeholder="Enter topic name (e.g. Arrays, Looping)..."
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
              ))}

              <datalist id={`topics-list-${contestId}`}>
                {existingTopics.map(topic => (
                  <option key={topic} value={topic} />
                ))}
              </datalist>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button onClick={onClose} className="btn btn-secondary" disabled={saving}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn btn-primary"
            disabled={saving || modifiedQuestionIds.size === 0}
          >
            {saving ? 'Saving to DB…' : `💾 Save ${modifiedQuestionIds.size} Modified Topic(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
