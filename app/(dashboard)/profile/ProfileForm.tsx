'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseHackerrankUsername, sanitizeField } from '@/lib/utils';
import { parseLeetcodeUsername } from '@/lib/leetcode';

type ProfileData = {
  full_name: string;
  emp_email: string;
  hackerrank_id: string;
  leetcode_id: string;
};

export default function ProfileForm({ initialData }: { initialData: any }) {
  const [formData, setFormData] = useState<ProfileData>({
    full_name: initialData.full_name || '',
    emp_email: initialData.emp_email || initialData.email || '',
    hackerrank_id: initialData.hackerrank_id || '',
    leetcode_id: initialData.leetcode_id || '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const cleanName = sanitizeField(formData.full_name);
    const cleanEmpEmail = sanitizeField(formData.emp_email);
    const cleanHr = parseHackerrankUsername(formData.hackerrank_id);
    const cleanLc = parseLeetcodeUsername(formData.leetcode_id);

    if (!cleanName) {
      setMessage({ type: 'error', text: 'Full Name is required.' });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: cleanName,
          emp_email: cleanEmpEmail,
          hackerrank_id: cleanHr,
          leetcode_id: cleanLc,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      setFormData({
        full_name: data.full_name || cleanName,
        emp_email: data.emp_email || cleanEmpEmail || '',
        hackerrank_id: data.hackerrank_id || '',
        leetcode_id: data.leetcode_id || '',
      });

      setMessage({ type: 'success', text: '✅ Profile updated successfully! Changes saved across all dashboards.' });
      router.refresh();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update profile' });
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
          <label htmlFor="hackerrank_id">
            <span>HackerRank Username (for progress scraping)</span>
          </label>
          <input
            type="text"
            id="hackerrank_id"
            name="hackerrank_id"
            placeholder="e.g. john_hr or profile URL"
            value={formData.hackerrank_id}
            onChange={handleChange}
            disabled={loading}
          />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
            Enter your HackerRank username or profile URL.
          </span>
        </div>

        <div className="form-group-compact full-width">
          <label htmlFor="leetcode_id">
            <span>LeetCode Username (for LeetCode progress scraping)</span>
          </label>
          <input
            type="text"
            id="leetcode_id"
            name="leetcode_id"
            placeholder="e.g. john_lc or profile URL"
            value={formData.leetcode_id}
            onChange={handleChange}
            disabled={loading}
          />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
            Enter your LeetCode username or profile URL.
          </span>
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
