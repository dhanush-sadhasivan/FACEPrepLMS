'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type ProfileData = {
  full_name: string;
  emp_email: string;
  hackerrank_id: string;
};

export default function ProfileForm({ initialData }: { initialData: any }) {
  const [formData, setFormData] = useState<ProfileData>({
    full_name: initialData.full_name || '',
    emp_email: initialData.emp_email || initialData.email || '',
    hackerrank_id: initialData.hackerrank_id || '',
  });
  const [loading, setLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [hrError, setHrError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setHrError(null);

    if (formData.hackerrank_id && formData.hackerrank_id.trim() !== '') {
      const cleanHr = formData.hackerrank_id.trim();
      if (!['nil', 'null', 'n/a', 'undefined', 'none', '-'].includes(cleanHr.toLowerCase())) {
        setIsValidating(true);
        try {
          const vRes = await fetch(`/api/users/validate-hackerrank?username=${encodeURIComponent(cleanHr)}`);
          const vData = await vRes.json();
          if (!vData.valid) {
            const errTxt = vData.error || `HackerRank ID "${cleanHr}" does not exist on HackerRank.`;
            setHrError(errTxt);
            setMessage({ type: 'error', text: errTxt });
            setLoading(false);
            setIsValidating(false);
            return;
          }
        } catch {
          // ignore network timeout
        } finally {
          setIsValidating(false);
        }
      }
    }

    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update profile');
      }

      setMessage({ type: 'success', text: '✅ Profile updated successfully!' });
      router.refresh();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <form onSubmit={handleSubmit} className="profile-form-compact">
      {message && (
        <div className={`form-message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="form-compact-grid">
        <div className="form-group-compact">
          <label htmlFor="full_name">Full Name *</label>
          <input
            type="text"
            id="full_name"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>

        <div className="form-group-compact">
          <label htmlFor="emp_email">Employee Email</label>
          <input
            type="email"
            id="emp_email"
            name="emp_email"
            value={formData.emp_email}
            onChange={handleChange}
            disabled={loading}
            placeholder="e.g. user@company.com"
          />
        </div>

        <div className="form-group-compact full-width">
          <label htmlFor="hackerrank_id" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>HackerRank Username (for progress scraping)</span>
            {isValidating && <span style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>🔍 Verifying ID on HackerRank…</span>}
          </label>
          <input
            type="text"
            id="hackerrank_id"
            name="hackerrank_id"
            placeholder="e.g. john_hr"
            value={formData.hackerrank_id}
            onChange={(e) => {
              setHrError(null);
              handleChange(e);
            }}
            disabled={loading}
            style={hrError ? { borderColor: '#ef4444', background: 'rgba(239,68,68,0.05)' } : {}}
          />
          {hrError && <span style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '0.25rem', display: 'block', fontWeight: 600 }}>⚠️ {hrError}</span>}
        </div>
      </div>

      <div className="form-action-row">
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Changes apply across assigned contests and roadmaps immediately.
        </span>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving Changes...' : '💾 Save Profile'}
        </button>
      </div>
    </form>
  );
}
