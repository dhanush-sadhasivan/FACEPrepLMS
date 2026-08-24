'use client';

import { useState } from 'react';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface AutoScrapeConfigModalProps {
  initialAllowedDays: number[];
  onClose: () => void;
  onSaved: (days: number[]) => void;
}

export default function AutoScrapeConfigModal({
  initialAllowedDays,
  onClose,
  onSaved,
}: AutoScrapeConfigModalProps) {
  const [allowedDays, setAllowedDays] = useState<number[]>(initialAllowedDays);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (day: number) => {
    setAllowedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/scrape/auto-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowed_days: allowedDays }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      const data = await res.json();
      onSaved(data.allowed_days);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, maxWidth: 440, width: '100%',
        padding: '1.5rem', boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.15rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              ⚙️ Configure Auto-Scrape Days
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Select which days of the week auto-scraping runs
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.2rem', lineHeight: 1, padding: '0.2rem' }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Day Toggles */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          {DAY_LABELS.map((label, idx) => {
            const isSelected = allowedDays.includes(idx);
            return (
              <button
                key={idx}
                onClick={() => toggleDay(idx)}
                style={{
                  flex: '1 0 calc(14% - 0.5rem)', minWidth: 46,
                  padding: '0.55rem 0.25rem',
                  borderRadius: 10,
                  border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: isSelected
                    ? 'linear-gradient(135deg, var(--accent) 0%, #e87a00 100%)'
                    : 'var(--surface-2)',
                  color: isSelected ? '#fff' : 'var(--text-muted)',
                  fontWeight: isSelected ? 800 : 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 2px 10px var(--accent-glow)' : 'none',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Info Row */}
        <div style={{
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '0.65rem 0.9rem', marginBottom: '1.1rem',
          fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.55,
        }}>
          <div>⏰ <strong>Time window:</strong> 10:00 AM – 6:00 PM IST (fixed)</div>
          <div>🔁 <strong>Frequency:</strong> Every 30 minutes</div>
          <div style={{ marginTop: '0.3rem' }}>
            <strong>Selected:</strong>{' '}
            {allowedDays.length === 0
              ? <span style={{ color: 'var(--error, #ef4444)' }}>None — scraping is disabled</span>
              : allowedDays.map((d) => DAY_LABELS[d]).join(', ')}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8, padding: '0.55rem 0.75rem', marginBottom: '0.85rem',
            fontSize: '0.8rem', color: '#ef4444',
          }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ minWidth: 130 }}
          >
            {saving ? 'Saving...' : '💾 Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
