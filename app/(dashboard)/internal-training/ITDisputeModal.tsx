'use client';

import { useState } from 'react';
import { ITAttendanceLocation } from '@/lib/types';

interface ITDisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  currentLocation?: ITAttendanceLocation | null;
  dayNumber: number;
  roadmapTitle?: string;
  isSubmitting?: boolean;
}

export default function ITDisputeModal({
  isOpen,
  onClose,
  onConfirm,
  currentLocation,
  dayNumber,
  roadmapTitle,
  isSubmitting = false,
}: ITDisputeModalProps) {
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const clean = reason.trim();
    if (!clean || clean.length < 5) {
      setErrorMsg('Please provide a detailed reason (at least 5 characters).');
      return;
    }

    try {
      await onConfirm(clean);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit dispute ticket');
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 10000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div
        className="modal"
        style={{
          maxWidth: 520,
          background: 'var(--surface-1, #111827)',
          border: '1px solid var(--border, rgba(255,255,255,0.1))',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              border: '1px solid rgba(245, 158, 11, 0.3)',
            }}
          >
            ⚠️
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Dispute Today&apos;s IT Attendance
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
              Request to uncount today as an Internal Training day.
            </p>
          </div>
        </div>

        {/* Informational Callout */}
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '10px',
            padding: '0.85rem 1rem',
            marginBottom: '1.25rem',
            fontSize: '0.82rem',
            color: 'var(--text-primary)',
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 800, color: '#f59e0b', marginBottom: '0.25rem' }}>
            ℹ️ How this works:
          </div>
          Submitting this dispute creates a support ticket for your manager/admin.
          Today&apos;s IT status <strong>remains counted</strong> while under review. Once approved by your manager, your IT day count will be safely reversed.
        </div>

        {/* Current status chip */}
        <div
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '0.65rem 0.85rem',
            marginBottom: '1.25rem',
            fontSize: '0.8rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Roadmap: </span>
            <strong>{roadmapTitle || 'Internal Training'}</strong>
            <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)' }}>(Day {dayNumber})</span>
          </div>
          {currentLocation && (
            <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent)', fontSize: '0.72rem' }}>
              📍 {currentLocation.type} {currentLocation.detail ? `(${currentLocation.detail})` : ''}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Reason Input */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Reason for Disputing Today&apos;s IT Attendance *
            </label>
            <textarea
              className="input"
              rows={4}
              required
              placeholder="e.g. Attended college placement drive instead of IT, on leave, emergency task assigned, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                borderRadius: '8px',
                padding: '0.75rem 0.85rem',
                fontSize: '0.85rem',
                resize: 'vertical',
              }}
            />
          </div>

          {errorMsg && (
            <div style={{ padding: '0.6rem 0.85rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, marginBottom: '1rem' }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
              style={{ fontSize: '0.85rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
              style={{
                fontSize: '0.85rem',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: '#fff',
              }}
            >
              {isSubmitting ? '⏳ Submitting Dispute…' : '📩 Raise Support Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
