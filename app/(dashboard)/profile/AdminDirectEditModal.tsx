'use client';

import { useState } from 'react';
import { parseHackerrankUsername, sanitizeField } from '@/lib/utils';
import { parseLeetcodeUsername } from '@/lib/leetcode';
import { useToast } from '@/components/Toast';

interface AdminDirectEditModalProps {
  initialData: {
    id: string;
    full_name: string;
    email: string;
    emp_email?: string | null;
    emp_id: string;
    team?: string | null;
    manager?: string | null;
    hackerrank_id?: string | null;
    leetcode_id?: string | null;
  };
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated: (updatedUser: any) => void;
}

export default function AdminDirectEditModal({
  initialData,
  isOpen,
  onClose,
  onProfileUpdated,
}: AdminDirectEditModalProps) {
  const { showToast } = useToast();
  const [fullName, setFullName] = useState(initialData.full_name || '');
  const [empEmail, setEmpEmail] = useState(initialData.emp_email || initialData.email || '');
  const [hackerrankId, setHackerrankId] = useState(initialData.hackerrank_id || '');
  const [leetcodeId, setLeetcodeId] = useState(initialData.leetcode_id || '');
  
  const [submitting, setSubmitting] = useState(false);
  const [validatingLc, setValidatingLc] = useState(false);
  const [lcStatus, setLcStatus] = useState<{ valid?: boolean; message?: string; isDuplicate?: boolean } | null>(null);

  if (!isOpen) return null;

  const handleValidateLeetcode = async (handle: string) => {
    const clean = parseLeetcodeUsername(handle);
    if (!clean) {
      setLcStatus(null);
      return;
    }
    setValidatingLc(true);
    setLcStatus(null);
    try {
      const res = await fetch(`/api/users/validate-leetcode?username=${encodeURIComponent(clean)}&excludeUserId=${encodeURIComponent(initialData.id)}`);
      const data = await res.json();
      if (!data.valid) {
        setLcStatus({ valid: false, message: data.error || 'LeetCode profile not found.', isDuplicate: data.isDuplicate });
      } else {
        setLcStatus({ valid: true, message: `✅ Verified: ${data.username} (${data.solvedTotal ?? 0} solved)` });
      }
    } catch {
      setLcStatus({ valid: true, message: 'Could not verify live, changes will still save.' });
    } finally {
      setValidatingLc(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanName = sanitizeField(fullName);
    const cleanEmpEmail = sanitizeField(empEmail);
    const cleanHr = parseHackerrankUsername(hackerrankId);
    const cleanLc = parseLeetcodeUsername(leetcodeId);

    if (!cleanName) {
      showToast('Full name is required.', 'error');
      return;
    }

    setSubmitting(true);
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

      showToast('✅ Profile updated successfully!', 'success');
      onProfileUpdated(data);
      onClose();
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal" style={{ maxWidth: 540, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 className="modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>✏️</span> Edit Administrator Profile
          </h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            style={{ fontSize: '1.2rem', padding: '0.2rem 0.5rem', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="label">Full Name *</label>
              <input
                type="text"
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label className="label">Employee Work Email</label>
              <input
                type="email"
                className="input"
                value={empEmail}
                onChange={(e) => setEmpEmail(e.target.value)}
                placeholder="e.g. user@company.com"
                disabled={submitting}
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="label">HackerRank Handle / URL</label>
              <input
                type="text"
                className="input"
                value={hackerrankId}
                onChange={(e) => setHackerrankId(e.target.value)}
                placeholder="e.g. john_hr or profile URL"
                disabled={submitting}
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <label className="label" style={{ margin: 0 }}>
                  LeetCode Handle / URL (Must be Unique)
                </label>
                {validatingLc && <span style={{ fontSize: '0.75rem', color: '#ffa116' }}>🔍 Checking uniqueness…</span>}
              </div>
              <input
                type="text"
                className="input"
                value={leetcodeId}
                onChange={(e) => {
                  setLeetcodeId(e.target.value);
                  setLcStatus(null);
                }}
                onBlur={(e) => handleValidateLeetcode(e.target.value)}
                placeholder="e.g. john_lc or profile URL"
                disabled={submitting}
                style={lcStatus && !lcStatus.valid ? { borderColor: '#ef4444', background: 'rgba(239,68,68,0.04)' } : {}}
              />
              {lcStatus && (
                <span style={{ fontSize: '0.75rem', marginTop: '0.3rem', display: 'block', color: lcStatus.valid ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                  {lcStatus.message}
                </span>
              )}
            </div>
          </div>

          <div className="modal-actions mt-6" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || (lcStatus ? !lcStatus.valid && lcStatus.isDuplicate : false)}
            >
              {submitting ? 'Saving Changes…' : '💾 Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
