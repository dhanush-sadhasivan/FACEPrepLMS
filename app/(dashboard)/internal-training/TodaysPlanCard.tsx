'use client';

import { useState } from 'react';
import { ITDayPlan, ITDayQuestion } from '@/lib/types';
import RedirectWarningModal from './RedirectWarningModal';

interface TodaysPlanCardProps {
  dayPlan: ITDayPlan | null;
  currentDay: number;
  totalDays: number;
  extendedDays: number;
  onQuestionClickConfirmed: (question: ITDayQuestion) => Promise<void>;
  onToggleCustomComplete: (questionId: string, isCompleted: boolean) => Promise<void>;
}

export default function TodaysPlanCard({
  dayPlan,
  currentDay,
  totalDays,
  extendedDays,
  onQuestionClickConfirmed,
  onToggleCustomComplete,
}: TodaysPlanCardProps) {
  const [selectedQuestionForModal, setSelectedQuestionForModal] = useState<ITDayQuestion | null>(null);
  const [updatingQId, setUpdatingQId] = useState<string | null>(null);

  const handleLaunchClick = (q: ITDayQuestion) => {
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

  if (!dayPlan) {
    const isFinished = currentDay > totalDays + extendedDays;
    return (
      <div className="todays-plan-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>
          {isFinished ? '🎉' : '☕'}
        </div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
          {isFinished
            ? 'All Planned Training Modules Completed!'
            : 'No Scheduled Topic for Today'}
        </h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto', lineHeight: 1.5 }}>
          {isFinished
            ? 'You have completed all scheduled days in this IT roadmap. Check your pending questions below if any remain.'
            : 'Today might be a non-working day or outside your active day plan schedule. You can practice any pending questions from prior days below.'}
        </p>
      </div>
    );
  }

  const questions = dayPlan.questions || [];
  const completedCount = questions.filter((q) => q.is_completed).length;
  const progressPct = questions.length > 0 ? Math.round((completedCount / questions.length) * 100) : 0;

  return (
    <div className="todays-plan-card">
      {/* Header */}
      <div className="todays-plan-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <span className="day-badge-large">
              <span>🗓️</span> Day {dayPlan.day_number} of {totalDays}
            </span>
            {dayPlan.calculated_date && (
              <span className="date-pill">
                📅 {new Date(dayPlan.calculated_date + 'T00:00:00').toLocaleDateString('en-IN', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            )}
            {extendedDays > 0 && (
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)', padding: '0.25rem 0.55rem', borderRadius: '6px' }}>
                ⏳ +{extendedDays} Extended Days Active
              </span>
            )}
          </div>

          <h2 className="todays-topic-title">{dayPlan.topic_title}</h2>
          {dayPlan.description && <p className="todays-topic-desc">{dayPlan.description}</p>}
        </div>

        {/* Progress Pill */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Today&apos;s Progress
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: progressPct === 100 ? '#10b981' : 'var(--accent)', marginTop: '0.2rem' }}>
            {completedCount}/{questions.length} Solved ({progressPct}%)
          </div>
        </div>
      </div>

      {/* Resources Box (if any) */}
      {dayPlan.resources && dayPlan.resources.length > 0 && (
        <div className="resources-box">
          <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            📚 Recommended Learning Resources &amp; Notes:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
            {dayPlan.resources.map((res, rIdx) => (
              <a
                key={rIdx}
                href={res.url}
                target="_blank"
                rel="noopener noreferrer"
                className="resource-chip"
              >
                <span>🔗</span> {res.title || 'Resource Link'} ↗
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Questions Section */}
      <div>
        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '1rem 0 0.5rem 0' }}>
          🎯 Practice Questions ({questions.length})
        </h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 0.85rem 0' }}>
          Click <strong>&quot;Launch Problem ↗&quot;</strong> to solve the challenge. Solving through this portal records your IT day attendance.
        </p>

        {questions.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--surface-2)', borderRadius: '12px' }}>
            No questions assigned for this day yet.
          </div>
        ) : (
          <div className="questions-list">
            {questions.map((q) => (
              <div
                key={q.id}
                className={`question-row-card ${q.is_completed ? 'completed' : ''}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: 0 }}>
                  <span className={`q-status-badge ${q.is_completed ? 'solved' : 'pending'}`}>
                    {q.is_completed ? '✅ Solved' : '⏳ Pending'}
                  </span>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        {q.title}
                      </span>
                      {q.difficulty && (
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'var(--surface)', padding: '0.15rem 0.45rem', borderRadius: '6px', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                          {q.difficulty}
                        </span>
                      )}
                    </div>
                    {q.description && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        {q.description}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {/* For custom questions, show checkbox */}
                  {q.question_type === 'custom' && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer', marginRight: '0.4rem' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(q.is_completed)}
                        disabled={updatingQId === q.id}
                        onChange={() => handleToggleCheck(q)}
                        style={{ width: 16, height: 16, accentColor: '#10b981' }}
                      />
                      Mark Done
                    </label>
                  )}

                  <button
                    type="button"
                    onClick={() => handleLaunchClick(q)}
                    className="btn btn-primary btn-sm"
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      background: q.is_completed ? 'var(--surface-3)' : 'linear-gradient(135deg, var(--accent), #8b5cf6)',
                      color: q.is_completed ? 'var(--text-primary)' : '#fff',
                      border: q.is_completed ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    {q.is_completed ? 'Review Problem ↗' : 'Launch Problem ↗'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
