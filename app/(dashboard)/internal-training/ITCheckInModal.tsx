'use client';

import { useState } from 'react';
import { ITAttendanceLocation, ITLocationType } from '@/lib/types';

interface ITCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (location: ITAttendanceLocation) => Promise<void>;
  topicTitle?: string;
  dayNumber: number;
  totalDays: number;
  isSubmitting?: boolean;
}

const PREDEFINED_LOCATIONS: { id: ITLocationType; label: string; icon: string; requiresDetail?: boolean; detailPlaceholder?: string }[] = [
  { id: 'Coimbatore-office', label: 'Coimbatore Office', icon: '🏢' },
  { id: 'Chennai-office', label: 'Chennai Office', icon: '🏢' },
  { id: 'Vijayawada-office', label: 'Vijayawada Office', icon: '🏢' },
  { id: 'Hyderabad-office', label: 'Hyderabad Office', icon: '🏢' },
  { id: 'Work from Home', label: 'Work from Home (WFH)', icon: '🏠', requiresDetail: true, detailPlaceholder: 'e.g. Reason or home location' },
  { id: 'Outstation', label: 'Outstation / Client Location', icon: '✈️', requiresDetail: true, detailPlaceholder: 'e.g. College name, client location, city' },
];

export default function ITCheckInModal({
  isOpen,
  onClose,
  onConfirm,
  topicTitle,
  dayNumber,
  totalDays,
  isSubmitting = false,
}: ITCheckInModalProps) {
  const [selectedType, setSelectedType] = useState<ITLocationType>('Coimbatore-office');
  const [detailText, setDetailText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeOption = PREDEFINED_LOCATIONS.find((l) => l.id === selectedType);
  const requiresDetail = activeOption?.requiresDetail;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (requiresDetail && !detailText.trim()) {
      setErrorMsg(`Please specify details for ${activeOption?.label || selectedType}.`);
      return;
    }

    try {
      await onConfirm({
        type: selectedType,
        detail: detailText.trim() || undefined,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record check-in');
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 10000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div
        className="modal"
        style={{
          maxWidth: 540,
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
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.3))',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            📍
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Count Today as IT Day
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
              Confirm your training location to unlock Day {dayNumber} curriculum.
            </p>
          </div>
        </div>

        {/* Topic preview box */}
        <div
          style={{
            background: 'var(--surface-2, #1f2937)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '0.85rem 1rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase' }}>
              Unlocking Day {dayNumber} of {totalDays}
            </div>
            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.15rem' }}>
              {topicTitle || `Day ${dayNumber} Curriculum`}
            </div>
          </div>
          <span className="badge badge-success" style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem' }}>
            Ready to Begin
          </span>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Location Selector */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.6rem' }}>
              Select Training Location (Required) *
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {PREDEFINED_LOCATIONS.map((loc) => {
                const isSelected = selectedType === loc.id;
                return (
                  <label
                    key={loc.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: isSelected
                        ? '1.5px solid var(--accent, #6366f1)'
                        : '1px solid var(--border)',
                      background: isSelected
                        ? 'rgba(99, 102, 241, 0.12)'
                        : 'var(--surface-2)',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: isSelected ? 800 : 600,
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="radio"
                      name="it_location"
                      value={loc.id}
                      checked={isSelected}
                      onChange={() => setSelectedType(loc.id)}
                      style={{ accentColor: '#6366f1' }}
                    />
                    <span>{loc.icon}</span>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {loc.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Conditional Detail Input */}
          {requiresDetail && (
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                {selectedType === 'Outstation' ? 'Mention College / Client / City Details *' : 'Mention WFH Reason / Details *'}
              </label>
              <input
                type="text"
                className="input"
                required
                value={detailText}
                onChange={(e) => setDetailText(e.target.value)}
                placeholder={activeOption?.detailPlaceholder || 'Please provide details…'}
                style={{
                  width: '100%',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  borderRadius: '8px',
                  padding: '0.65rem 0.85rem',
                  fontSize: '0.85rem',
                }}
              />
            </div>
          )}

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
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              {isSubmitting ? '⏳ Recording IT Day…' : '✨ Confirm & Count IT Today'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
