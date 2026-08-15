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
    if (!confirm(`Are you sure you want to delete ${group.name}?`)) return;
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
    <div className="page-header flex justify-between items-start">
      {isEditing ? (
        <div className="flex gap-2 items-center">
          <input className="input text-xl font-bold" value={name} onChange={e => setName(e.target.value)} autoFocus />
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={isSubmitting}>Save</button>
          <button className="btn btn-secondary btn-sm" onClick={() => { setIsEditing(false); setName(group.name); }}>Cancel</button>
        </div>
      ) : (
        <div>
          <h1 className="page-title flex items-center gap-4">
            {group.name}
            <button className="btn btn-ghost btn-sm" onClick={() => setIsEditing(true)}>✎ Edit</button>
          </h1>
          <p className="page-subtitle">Created {new Date(group.created_at).toLocaleDateString()}</p>
        </div>
      )}
      
      <button className="btn btn-danger btn-sm" onClick={handleDelete}>Delete Group</button>
    </div>
  );
}
