'use client';

import { ITAttendanceLocation, ITAttendanceDispute } from '@/lib/types';

interface ITAttendanceToggleProps {
  isCheckedInToday: boolean;
  pendingDispute?: ITAttendanceDispute | null;
  location?: ITAttendanceLocation | null;
  dayNumber: number;
  totalDays: number;
  topicTitle?: string;
  onOpenCheckIn: () => void;
  onOpenDispute: () => void;
  disabled?: boolean;
}

export default function ITAttendanceToggle({
  isCheckedInToday,
  pendingDispute,
  location,
  dayNumber,
  totalDays,
  topicTitle,
  onOpenCheckIn,
  onOpenDispute,
  disabled = false,
}: ITAttendanceToggleProps) {
  const hasPendingDispute = Boolean(pendingDispute && pendingDispute.status === 'pending');

  const handleToggleClick = () => {
    if (disabled) return;
    if (isCheckedInToday) {
      // Toggle OFF -> Open dispute modal
      onOpenDispute();
    } else {
      // Toggle OFF -> ON -> Open check-in modal
      onOpenCheckIn();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        padding: '0.75rem 1rem',
        background: isCheckedInToday
          ? hasPendingDispute
            ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.04) 100%)'
            : 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.04) 100%)'
          : 'var(--surface-2, #1f2937)',
        border: isCheckedInToday
          ? hasPendingDispute
            ? '1.5px solid rgba(245, 158, 11, 0.35)'
            : '1.5px solid rgba(16, 185, 129, 0.35)'
          : '1px solid var(--border)',
        borderRadius: '12px',
        width: '100%',
      }}
    >
      {/* Left Details */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {isCheckedInToday ? '🎓 Counted as IT Today' : '⏳ IT Not Counted Today'}
          </span>

          {hasPendingDispute && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                color: '#f59e0b',
                background: 'rgba(245, 158, 11, 0.18)',
                padding: '0.15rem 0.55rem',
                borderRadius: '999px',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <span>⏳</span> Dispute Pending Manager Review
            </span>
          )}

          {isCheckedInToday && location && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#10b981',
                background: 'rgba(16, 185, 129, 0.15)',
                padding: '0.15rem 0.55rem',
                borderRadius: '999px',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <span>📍</span> {location.type}
              {location.detail ? ` (${location.detail})` : ''}
            </span>
          )}
        </div>

        <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          {isCheckedInToday ? (
            <span>
              Day {dayNumber} of {totalDays} is unlocked{topicTitle ? `: "${topicTitle}"` : ''}.
              {hasPendingDispute
                ? ' A support ticket is under review to dispute this day.'
                : ' Click the toggle to dispute if today is not an IT day.'}
            </span>
          ) : (
            <span>
              Toggle ON to record attendance, select location, and unlock Day {dayNumber} challenges.
            </span>
          )}
        </div>
      </div>

      {/* Right Interactive Toggle Switch */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={handleToggleClick}
          disabled={disabled}
          title={
            isCheckedInToday
              ? 'Click to turn OFF (dispute today as an IT day)'
              : 'Click to turn ON (count today as an IT day)'
          }
          style={{
            position: 'relative',
            width: '56px',
            height: '30px',
            borderRadius: '999px',
            background: isCheckedInToday
              ? hasPendingDispute
                ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                : 'linear-gradient(135deg, #10b981, #059669)'
              : 'var(--surface-3, #374151)',
            border: isCheckedInToday
              ? hasPendingDispute
                ? '1px solid rgba(245, 158, 11, 0.6)'
                : '1px solid rgba(16, 185, 129, 0.6)'
              : '1px solid var(--border)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            padding: 0,
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: isCheckedInToday
              ? hasPendingDispute
                ? '0 0 12px rgba(245, 158, 11, 0.4)'
                : '0 0 12px rgba(16, 185, 129, 0.4)'
              : 'none',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {/* Thumb circle */}
          <span
            style={{
              position: 'absolute',
              top: '2px',
              left: isCheckedInToday ? '28px' : '3px',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: '#ffffff',
              boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 900,
              color: isCheckedInToday
                ? hasPendingDispute
                  ? '#d97706'
                  : '#059669'
                : '#9ca3af',
            }}
          >
            {isCheckedInToday ? (hasPendingDispute ? '⏳' : '✓') : '✕'}
          </span>
        </button>

        <span
          style={{
            fontSize: '0.78rem',
            fontWeight: 800,
            color: isCheckedInToday
              ? hasPendingDispute
                ? '#f59e0b'
                : '#10b981'
              : 'var(--text-muted)',
            minWidth: '55px',
          }}
        >
          {isCheckedInToday ? (hasPendingDispute ? 'PENDING' : 'IT ON') : 'IT OFF'}
        </span>
      </div>
    </div>
  );
}
