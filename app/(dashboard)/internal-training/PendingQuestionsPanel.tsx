'use client';

import { useState } from 'react';
import { ITDayPlan, ITDayQuestion } from '@/lib/types';
import RedirectWarningModal from './RedirectWarningModal';

interface PendingQuestionsPanelProps {
  pendingByDay: ITDayPlan[];
  onQuestionClickConfirmed: (question: ITDayQuestion) => Promise<void>;
  onToggleCustomComplete: (questionId: string, isCompleted: boolean) => Promise<void>;
}

export default function PendingQuestionsPanel({
  pendingByDay,
  onQuestionClickConfirmed,
  onToggleCustomComplete,
}: PendingQuestionsPanelProps) {
  const [selectedQuestionForModal, setSelectedQuestionForModal] = useState<ITDayQuestion | null>(null);
  const [updatingQId, setUpdatingQId] = useState<string | null>(null);

  const totalPending = pendingByDay.reduce((acc, dp) => acc + (dp.questions?.length || 0), 0);

  const handleLaunch = (q: ITDayQuestion) => {
    setSelectedQuestionForModal(q);
  };

  const handleConfirmRedirect = async () => {
    if (!selectedQuestionForModal) return;
    const q = selectedQuestionForModal;
    setSelectedQuestionForModal(null);
    await onQuestionClickConfirmed(q);
  };

  const handleToggleCheck = async (q: ITDayQuestion) => {
    setUpdatingQId(q.id);
    try {
      await onToggleCustomComplete(q.id, !q.is_completed);
    } finally {
      setUpdatingQId(null);
    }
  };

  return (
    <div className="pending-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.85rem' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>⏳</span> Previous Days Pending Questions
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
            Uncompleted challenges from earlier training days that need your attention.
          </p>
        </div>

        {totalPending > 0 && (
          <span style={{ fontSize: '0.82rem', fontWeight: 800, background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '0.3rem 0.75rem', borderRadius: '8px' }}>
            🚨 {totalPending} {totalPending === 1 ? 'Problem Pending' : 'Problems Pending'}
          </span>
        )}
      </div>

      {pendingByDay.length === 0 ? (
        <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', background: 'var(--surface-2)', borderRadius: '14px', border: '1px dashed var(--border)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✨</div>
          <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.35rem 0' }}>
            All Previous Days Completed!
          </h4>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: 0 }}>
            Awesome consistency! You have zero backlog from previous training days.
          </p>
        </div>
      ) : (
        pendingByDay.map((dp) => (
          <div key={dp.id} className="pending-group-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--accent)', background: 'var(--accent-muted)', padding: '0.2rem 0.55rem', borderRadius: '6px' }}>
                  Day {dp.day_number}
                </span>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  {dp.topic_title}
                </span>
              </div>

              {dp.calculated_date && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  🗓️ Scheduled: {dp.calculated_date}
                </span>
              )}
            </div>

            <div className="questions-list" style={{ marginTop: '0.5rem' }}>
              {(dp.questions || []).map((q) => (
                <div key={q.id} className="question-row-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                    <span
                      className={`q-status-badge ${q.needs_portal_click ? 'needs-confirm' : 'pending'}`}
                      style={q.needs_portal_click ? { background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' } : undefined}
                    >
                      {q.needs_portal_click ? '🔶 Solved — Confirm' : '⏳ Pending'}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        {q.title}
                      </div>
                      {q.needs_portal_click && (
                        <div style={{ fontSize: '0.74rem', color: '#f59e0b', fontWeight: 700, marginTop: '0.15rem' }}>
                          ⚠️ Solved on HackerRank — click &quot;Confirm &amp; Launch&quot; to register your completion
                        </div>
                      )}
                      {q.difficulty && !q.needs_portal_click && (
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          📊 {q.difficulty} &bull; {q.question_type === 'hackerrank' ? '🏆 HackerRank' : '✏️ Custom Task'}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {q.question_type === 'custom' && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(q.is_completed)}
                          disabled={updatingQId === q.id}
                          onChange={() => handleToggleCheck(q)}
                          style={{ width: 15, height: 15, accentColor: '#10b981' }}
                        />
                        Mark Done
                      </label>
                    )}

                    <button
                      type="button"
                      onClick={() => handleLaunch(q)}
                      className="btn btn-primary btn-sm"
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        background: q.needs_portal_click ? 'linear-gradient(135deg, #f59e0b, #ea580c)' : undefined,
                      }}
                    >
                      {q.needs_portal_click ? 'Confirm & Launch ↗' : 'Solve Problem ↗'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Redirect Warning Modal */}
      {selectedQuestionForModal && (
        <RedirectWarningModal
          isOpen={true}
          questionTitle={selectedQuestionForModal.title}
          targetUrl={selectedQuestionForModal.url}
          onConfirm={handleConfirmRedirect}
          onCancel={() => setSelectedQuestionForModal(null)}
        />
      )}
    </div>
  );
}
