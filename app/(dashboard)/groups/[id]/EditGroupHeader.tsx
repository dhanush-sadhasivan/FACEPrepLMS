'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function EditGroupHeader({ group }: { group: any }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || name === group.name) {
      setIsEditing(false);
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setIsEditing(false);
        router.refresh();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${group.name}? This action cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/groups/${group.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/groups');
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="group-detail-banner">
      <div className="group-header-info">
        <div className="group-avatar-icon">👥</div>
        <div>
          {isEditing ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                className="input"
                style={{ fontSize: '1.2rem', fontWeight: 800, padding: '0.3rem 0.6rem' }}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={isSubmitting}>
                💾 Save
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setIsEditing(false);
                  setName(group.name);
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div>
              <h1 className="group-header-title">
                {group.name}
                <button className="edit-name-btn" onClick={() => setIsEditing(true)}>
                  ✏️ Edit
                </button>
              </h1>
              <p className="page-subtitle" style={{ margin: 0 }}>
                Created on {new Date(group.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          )}
        </div>
      </div>

      <button className="btn btn-secondary btn-sm" onClick={handleDelete} style={{ color: 'var(--error)', borderColor: 'rgba(239,68,68,0.3)' }}>
        🗑️ Delete Group
      </button>
    </div>
  );
}
