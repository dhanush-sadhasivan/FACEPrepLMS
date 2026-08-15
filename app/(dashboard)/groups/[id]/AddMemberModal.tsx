'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AddMemberModal({ groupId, availableUsers }: { groupId: string; availableUsers: any[] }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredUsers = availableUsers.filter((u) =>
    (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.emp_id || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.team || '').toLowerCase().includes(search.toLowerCase())
  );

  const toggleUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    const ids = filteredUsers.map((u) => u.id);
    setSelectedUserIds(Array.from(new Set([...selectedUserIds, ...ids])));
  };

  const clearSelection = () => {
    setSelectedUserIds([]);
  };

  const handleSave = async () => {
    if (selectedUserIds.length === 0) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedUserIds }),
      });
      if (res.ok) {
        setIsOpen(false);
        setSelectedUserIds([]);
        router.refresh();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button className="btn btn-primary" onClick={() => setIsOpen(true)}>
        + Add Members
      </button>

      {isOpen && (
        <div className="modal-overlay" onClick={() => setIsOpen(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 680, width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 className="modal-title" style={{ fontSize: '1.2rem', fontWeight: 700 }}>Add Members to Group</h2>
              <button
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {/* Search and Selection Helpers */}
            <div style={{ marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="input"
                  placeholder="Search by name, emp ID, or team..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid var(--border)' }}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    &times;
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                <span>Showing {filteredUsers.length} of {availableUsers.length} user(s)</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }} onClick={selectAllFiltered}>
                    Select Filtered ({filteredUsers.length})
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }} onClick={clearSelection}>
                    Clear All
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable User Table Container */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                border: '1px solid var(--border)',
                borderRadius: 8,
                maxHeight: 340,
                marginBottom: '1rem',
                background: 'var(--surface)',
              }}
            >
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 5, boxShadow: '0 1px 0 var(--border)' }}>
                    <th style={{ width: 40, textAlign: 'center', padding: '0.6rem 0.5rem' }}>✓</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Name</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Emp ID</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Team</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => {
                    const isSelected = selectedUserIds.includes(u.id);
                    return (
                      <tr
                        key={u.id}
                        onClick={() => toggleUser(u.id)}
                        style={{
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(255,165,0,0.08)' : 'transparent',
                          transition: 'background 0.15s',
                        }}
                      >
                        <td style={{ textAlign: 'center', padding: '0.6rem 0.5rem' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleUser(u.id)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: 500 }}>{u.full_name}</td>
                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{u.emp_id || 'N/A'}</td>
                        <td style={{ padding: '0.6rem 0.75rem' }}>
                          <span className="badge badge-muted" style={{ fontSize: '0.75rem' }}>{u.team || 'N/A'}</span>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                        No available users found matching "{search}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Selected: <strong>{selectedUserIds.length}</strong> user(s)
              </span>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-secondary" onClick={() => setIsOpen(false)}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={isSubmitting || selectedUserIds.length === 0}
                >
                  {isSubmitting ? 'Adding Users...' : `Add Selected Users (${selectedUserIds.length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
