'use client';
import { useState } from 'react';

export default function LockedContestView({ contestId, title, start, end }: any) {
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const requestAccess = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contestId, message })
      });
      if (!res.ok) throw new Error('Failed to request access');
      setSuccess(true);
      setShowModal(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="locked-view">
      <div className="locked-icon">🔒</div>
      <h2 className="text-2xl font-bold mb-2">{title}</h2>
      <p className="text-muted mb-6">This contest is not currently active.</p>
      <div className="mb-6 text-sm text-left bg-[var(--bg)] p-4 rounded border border-[var(--border)]">
        <div><strong>Starts:</strong> {new Date(start).toLocaleString()}</div>
        <div><strong>Ends:</strong> {new Date(end).toLocaleString()}</div>
      </div>
      
      {success ? (
        <div className="text-green-500 font-medium">Access extension requested. You will be notified when approved.</div>
      ) : (
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          Request Access Extension
        </button>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Request Access</h3>
            <p className="text-sm text-muted mb-4">Provide a reason for requesting access outside of the active contest window.</p>
            <textarea 
              className="form-input w-full h-24 mb-4" 
              placeholder="Reason for extension..."
              value={message}
              onChange={e => setMessage(e.target.value)}
            ></textarea>
            <div className="flex justify-end gap-2">
              <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={requestAccess} disabled={submitting || !message.trim()}>
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
