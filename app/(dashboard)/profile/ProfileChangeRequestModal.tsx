'use client';

import { useState } from 'react';
import { parseHackerrankUsername, sanitizeField } from '@/lib/utils';
import { parseLeetcodeUsername } from '@/lib/leetcode';
import { useToast } from '@/components/Toast';

interface ProfileChangeRequestModalProps {
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
  onTicketCreated: () => void;
}

export default function ProfileChangeRequestModal({
  initialData,
  isOpen,
  onClose,
  onTicketCreated,
}: ProfileChangeRequestModalProps) {
  const { showToast } = useToast();
  const [fullName, setFullName] = useState(initialData.full_name || '');
  const [empEmail, setEmpEmail] = useState(initialData.emp_email || initialData.email || '');
  const [hackerrankId, setHackerrankId] = useState(initialData.hackerrank_id || '');
  const [leetcodeId, setLeetcodeId] = useState(initialData.leetcode_id || '');
  const [reason, setReason] = useState('');
  
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
      setLcStatus({ valid: true, message: 'Could not verify live, will be reviewed by admin.' });
    } finally {
      setValidatingLc(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      showToast('Please provide a reason for the requested change.', 'error');
      return;
    }

    const cleanName = sanitizeField(fullName);
    const cleanEmpEmail = sanitizeField(empEmail);
    const cleanHr = parseHackerrankUsername(hackerrankId);
    const cleanLc = parseLeetcodeUsername(leetcodeId);

    if (!cleanName) {
      showToast('Full name is required.', 'error');
      return;
    }

    // Check if any change was actually requested
    const nameChanged = cleanName !== (initialData.full_name || '');
    const emailChanged = (cleanEmpEmail || '') !== (initialData.emp_email || initialData.email || '');
    const hrChanged = (cleanHr || '') !== (initialData.hackerrank_id || '');
    const lcChanged = (cleanLc || '') !== (initialData.leetcode_id || '');

    if (!nameChanged && !emailChanged && !hrChanged && !lcChanged) {
      showToast('No changes detected compared to your current profile.', 'info');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/support-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: cleanName,
          emp_email: cleanEmpEmail,
          hackerrank_id: cleanHr,
          leetcode_id: cleanLc,
          reason: reason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit profile change request');
      }

      showToast('🎉 Profile change ticket submitted! An admin/manager will review and apply the updates.', 'success');
      onTicketCreated();
      onClose();
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal" style={{ maxWidth: 580, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 className="modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🎫</span> Request Profile Change
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

        <div style={{ padding: '0.75rem 1rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          💡 <strong>Note:</strong> Profile edits require administrator review to preserve contest leaderboard rankings. Once approved, changes take effect immediately across all leaderboards.
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
              <label className="label">Employee Email</label>
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
              <label className="label">
                <span>HackerRank Handle / URL</span>
              </label>
              <input
                type="text"
                className="input"
                value={hackerrankId}
                onChange={(e) => setHackerrankId(e.target.value)}
                placeholder="e.g. john_hr or https://www.hackerrank.com/profile/john_hr"
                disabled={submitting}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                Current: <code>{initialData.hackerrank_id || 'None'}</code>
              </span>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <label className="label" style={{ margin: 0 }}>
                  <span>LeetCode Handle / URL (Must be Unique)</span>
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
                placeholder="e.g. john_lc or https://leetcode.com/u/john_lc/"
                disabled={submitting}
                style={lcStatus && !lcStatus.valid ? { borderColor: '#ef4444', background: 'rgba(239,68,68,0.04)' } : {}}
              />
              {lcStatus && (
                <span style={{ fontSize: '0.75rem', marginTop: '0.3rem', display: 'block', color: lcStatus.valid ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                  {lcStatus.message}
                </span>
              )}
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                Current: <code>{initialData.leetcode_id || 'None'}</code>
              </span>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="label">Reason / Comments for Change *</label>
              <textarea
                className="input"
                rows={3}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Updated my HackerRank username, fixed typo in employee email, new LeetCode account link..."
                disabled={submitting}
                style={{ resize: 'vertical', minHeight: 70 }}
              />
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
              {submitting ? 'Submitting Request…' : '📤 Submit Request for Approval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
