'use client';

import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/components/Toast';

interface TargetMetadata {
  teams: string[];
  groups: { id: string; name: string }[];
  users: { id: string; full_name: string; emp_id: string; email: string; team?: string; role: string }[];
}

interface CreateAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateAnnouncementModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateAnnouncementModalProps) {
  const { showToast } = useToast();

  const [loadingMeta, setLoadingMeta] = useState(false);
  const [metadata, setMetadata] = useState<TargetMetadata>({
    teams: [],
    groups: [],
    users: [],
  });

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'team' | 'group' | 'individual'>('all');
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    async function fetchMetadata() {
      setLoadingMeta(true);
      try {
        const res = await fetch('/api/notifications/announcements');
        if (res.ok) {
          const data = await res.json();
          setMetadata(data);
        }
      } catch (err) {
        console.error('Error fetching targeting metadata:', err);
      } finally {
        setLoadingMeta(false);
      }
    }

    fetchMetadata();
  }, [isOpen]);

  // Toggle helper for arrays
  const toggleItem = (list: string[], item: string) => {
    return list.includes(item) ? list.filter((i) => i !== item) : [...list, item];
  };

  // Filtered users for individual selection
  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase().trim();
    if (!q) return metadata.users;
    return metadata.users.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.emp_id?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.team?.toLowerCase().includes(q)
    );
  }, [metadata.users, userSearch]);

  // Estimated recipient count
  const estimatedCount = useMemo(() => {
    if (targetType === 'all') return metadata.users.length;
    if (targetType === 'team') {
      if (selectedTeams.length === 0) return 0;
      return metadata.users.filter((u) => u.team && selectedTeams.includes(u.team)).length;
    }
    if (targetType === 'group') {
      return selectedGroupIds.length > 0 ? `Targeting ${selectedGroupIds.length} group(s)` : 0;
    }
    if (targetType === 'individual') return selectedUserIds.length;
    return 0;
  }, [targetType, selectedTeams, selectedGroupIds, selectedUserIds, metadata.users]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      showToast('Please enter an announcement title', 'error');
      return;
    }
    if (!message.trim()) {
      showToast('Please enter the announcement message', 'error');
      return;
    }
    if (targetType === 'team' && selectedTeams.length === 0) {
      showToast('Please select at least one team', 'error');
      return;
    }
    if (targetType === 'group' && selectedGroupIds.length === 0) {
      showToast('Please select at least one group', 'error');
      return;
    }
    if (targetType === 'individual' && selectedUserIds.length === 0) {
      showToast('Please select at least one trainer', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/notifications/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          message,
          targetType,
          targetTeams: selectedTeams,
          targetGroupIds: selectedGroupIds,
          targetUserIds: selectedUserIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch announcement');
      }

      showToast(`🎉 Announcement broadcasted to ${data.recipientCount} recipient(s)!`, 'success');
      setTitle('');
      setMessage('');
      setSelectedTeams([]);
      setSelectedGroupIds([]);
      setSelectedUserIds([]);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to send announcement', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
      <div
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface, #1e293b)',
          border: '1px solid var(--border, #334155)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '640px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📢</span> Broadcast New Announcement
            </h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Send targeted notifications and alerts to teams, groups, or trainers.
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ padding: '0.4rem 0.6rem', fontSize: '1.2rem', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {/* 1. Target Scope Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              1. Target Audience Scope
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
              {[
                { id: 'all', label: '🌐 All Users', desc: 'Broadcast to everyone' },
                { id: 'team', label: '🏢 Specific Teams', desc: 'Target by department/team' },
                { id: 'group', label: '👥 Specific Groups', desc: 'Target by cohort group' },
                { id: 'individual', label: '👤 Specific Trainers', desc: 'Pick individual trainers' },
              ].map((t) => {
                const isSelected = targetType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTargetType(t.id as any)}
                    style={{
                      padding: '0.65rem 0.75rem',
                      borderRadius: '10px',
                      border: `1.5px solid ${isSelected ? 'var(--accent, #6366f1)' : 'var(--border)'}`,
                      background: isSelected ? 'rgba(99,102,241,0.12)' : 'var(--surface-2, #0f172a)',
                      color: isSelected ? 'var(--accent, #6366f1)' : 'var(--text-secondary)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{t.label}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{t.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sub-selector based on Target Scope */}
          {targetType === 'team' && (
            <div style={{ background: 'var(--surface-2, #0f172a)', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Select Target Teams ({selectedTeams.length} selected):
              </div>
              {metadata.teams.length === 0 ? (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No teams detected.</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {metadata.teams.map((team) => {
                    const isSel = selectedTeams.includes(team);
                    return (
                      <button
                        key={team}
                        type="button"
                        onClick={() => setSelectedTeams(toggleItem(selectedTeams, team))}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '8px',
                          border: `1px solid ${isSel ? 'var(--accent)' : 'var(--border)'}`,
                          background: isSel ? 'var(--accent)' : 'var(--surface)',
                          color: isSel ? '#ffffff' : 'var(--text-primary)',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {isSel ? '✓ ' : '+ '} {team}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {targetType === 'group' && (
            <div style={{ background: 'var(--surface-2, #0f172a)', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Select Target Groups ({selectedGroupIds.length} selected):
              </div>
              {metadata.groups.length === 0 ? (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No groups found.</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {metadata.groups.map((group) => {
                    const isSel = selectedGroupIds.includes(group.id);
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => setSelectedGroupIds(toggleItem(selectedGroupIds, group.id))}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '8px',
                          border: `1px solid ${isSel ? 'var(--accent)' : 'var(--border)'}`,
                          background: isSel ? 'var(--accent)' : 'var(--surface)',
                          color: isSel ? '#ffffff' : 'var(--text-primary)',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {isSel ? '✓ ' : '+ '} {group.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {targetType === 'individual' && (
            <div style={{ background: 'var(--surface-2, #0f172a)', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Select Individual Trainers ({selectedUserIds.length} selected):
                </div>
                {selectedUserIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedUserIds([])}
                    style={{ fontSize: '0.75rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                  >
                    Clear selection
                  </button>
                )}
              </div>

              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="🔍 Search trainers by name, emp ID, or email..."
                style={{
                  width: '100%',
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.82rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem',
                }}
              />

              <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {filteredUsers.map((u) => {
                  const isSel = selectedUserIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.35rem 0.55rem',
                        borderRadius: '6px',
                        background: isSel ? 'rgba(99,102,241,0.15)' : 'var(--surface)',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => setSelectedUserIds(toggleItem(selectedUserIds, u.id))}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{u.full_name}</span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>({u.emp_id || u.email})</span>
                      {u.team && (
                        <span style={{ marginLeft: 'auto', fontSize: '0.72rem', background: 'var(--surface-3)', padding: '0.1rem 0.35rem', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                          {u.team}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Announcement Details */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
              2. Announcement Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Schedule Update for Week 3 Internal Training"
              required
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
              3. Announcement Message / Details *
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write the full announcement text, key instructions, links, or expectations for the trainers..."
              rows={4}
              required
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text-primary)',
                fontSize: '0.88rem',
                lineHeight: 1.5,
                resize: 'vertical',
              }}
            />
          </div>

          {/* Recipient Estimate Banner */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', padding: '0.65rem 0.85rem', borderRadius: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.84rem', color: 'var(--accent, #6366f1)', fontWeight: 700 }}>
              <span>🎯</span> Scope Summary:
            </div>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {typeof estimatedCount === 'number' ? `~${estimatedCount} recipient(s)` : estimatedCount}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !title.trim() || !message.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800 }}
            >
              {submitting ? 'Sending...' : '🚀 Broadcast Announcement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
