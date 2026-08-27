'use client';

import { useState, useMemo } from 'react';
import { useToast } from '@/components/Toast';

export interface TrainerUser {
  id: string;
  full_name: string;
  emp_id?: string;
  email?: string;
  team?: string;
  role?: string;
  hackerrank_id?: string;
  leetcode_id?: string;
}

interface CreateGroupAndAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableTrainers: TrainerUser[];
  defaultGroupName?: string;
  onGroupCreated: (newGroup: { id: string; name: string }, memberCount: number) => void;
}

export default function CreateGroupAndAssignModal({
  isOpen,
  onClose,
  availableTrainers,
  defaultGroupName = '',
  onGroupCreated,
}: CreateGroupAndAssignModalProps) {
  const { showToast } = useToast();

  const [groupName, setGroupName] = useState(defaultGroupName);
  const [search, setSearch] = useState('');
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Extract distinct teams for filtering
  const distinctTeams = useMemo(() => {
    const teamsSet = new Set<string>();
    availableTrainers.forEach((t) => {
      if (t.team && t.team.trim() && t.team !== 'N/A') {
        teamsSet.add(t.team.trim());
      }
    });
    return Array.from(teamsSet).sort();
  }, [availableTrainers]);

  // Filter trainers based on search query and selected team
  const filteredTrainers = useMemo(() => {
    const q = search.toLowerCase().trim();
    return availableTrainers.filter((t) => {
      const matchesSearch =
        !q ||
        (t.full_name || '').toLowerCase().includes(q) ||
        (t.emp_id || '').toLowerCase().includes(q) ||
        (t.email || '').toLowerCase().includes(q) ||
        (t.team || '').toLowerCase().includes(q) ||
        (t.hackerrank_id || '').toLowerCase().includes(q) ||
        (t.leetcode_id || '').toLowerCase().includes(q);

      const matchesTeam =
        selectedTeamFilter === 'all' || (t.team || '').trim() === selectedTeamFilter;

      return matchesSearch && matchesTeam;
    });
  }, [availableTrainers, search, selectedTeamFilter]);

  const toggleTrainer = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    const ids = filteredTrainers.map((t) => t.id);
    setSelectedUserIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const clearSelection = () => {
    setSelectedUserIds([]);
  };

  const handleCreateAndAssign = async () => {
    const trimmedName = groupName.trim();
    if (!trimmedName) {
      showToast('Please enter a group name', 'error');
      return;
    }

    if (selectedUserIds.length === 0) {
      showToast('Please select at least one trainer for the group', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create Group
      const groupRes = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName }),
      });

      const groupData = await groupRes.json();
      if (!groupRes.ok) {
        throw new Error(groupData.error || 'Failed to create group');
      }

      // 2. Add Selected Trainers to Group
      const membersRes = await fetch(`/api/groups/${groupData.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedUserIds }),
      });

      if (!membersRes.ok) {
        const memErr = await membersRes.json();
        throw new Error(memErr.error || 'Failed to add trainers to group');
      }

      showToast(`Group "${groupData.name}" created with ${selectedUserIds.length} trainer(s) & assigned!`, 'success');
      onGroupCreated(groupData, selectedUserIds.length);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create group';
      showToast(`Group creation error: ${msg}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1050 }}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 720,
          width: '92%',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          boxShadow: 'var(--shadow-xl)',
          padding: '1.5rem',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            paddingBottom: '0.85rem',
            borderBottom: '1px solid var(--border)',
            marginBottom: '1rem',
          }}
        >
          <div>
            <h2
              className="modal-title"
              style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <span>👥</span> Create New Group &amp; Assign Trainers
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
              Create a trainer group on the fly and assign it directly to this contest.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        {/* Group Name Input */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Group Name *
            </label>
            {defaultGroupName && groupName !== defaultGroupName && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.72rem', padding: '0.1rem 0.4rem', color: 'var(--accent)' }}
                onClick={() => setGroupName(defaultGroupName)}
              >
                Use &quot;{defaultGroupName}&quot;
              </button>
            )}
          </div>
          <input
            type="text"
            className="input"
            placeholder="e.g. Gitam Batch A, Python Sprint Cohort..."
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            style={{ width: '100%', fontSize: '0.9rem' }}
            autoFocus
          />
        </div>

        {/* Search, Filter & Quick-action Bar */}
        <div
          style={{
            background: 'var(--surface-2)',
            padding: '0.75rem',
            borderRadius: 10,
            border: '1px solid var(--border)',
            marginBottom: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <input
                type="text"
                className="input"
                placeholder="Search trainers by name, emp ID, email, team..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%', paddingLeft: '2rem', fontSize: '0.84rem' }}
              />
              <span
                style={{
                  position: 'absolute',
                  left: '0.65rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                  pointerEvents: 'none',
                }}
              >
                🔍
              </span>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: '0.65rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '1rem',
                  }}
                >
                  &times;
                </button>
              )}
            </div>

            {/* Team Filter Dropdown */}
            {distinctTeams.length > 0 && (
              <select
                className="input"
                value={selectedTeamFilter}
                onChange={(e) => setSelectedTeamFilter(e.target.value)}
                style={{ minWidth: 140, fontSize: '0.84rem' }}
              >
                <option value="all">All Teams ({availableTrainers.length})</option>
                {distinctTeams.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Action Row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
              fontSize: '0.8rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>
                Showing <strong>{filteredTrainers.length}</strong> of {availableTrainers.length} trainer(s)
              </span>
              {selectedUserIds.length > 0 && (
                <span
                  style={{
                    background: 'rgba(16,185,129,0.15)',
                    color: '#10b981',
                    fontWeight: 800,
                    padding: '0.1rem 0.5rem',
                    borderRadius: '999px',
                    fontSize: '0.74rem',
                  }}
                >
                  ✓ {selectedUserIds.length} Selected
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.74rem', padding: '0.15rem 0.5rem' }}
                onClick={selectAllFiltered}
              >
                Select Filtered ({filteredTrainers.length})
              </button>
              {selectedUserIds.length > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '0.74rem', padding: '0.15rem 0.5rem', color: 'var(--text-muted)' }}
                  onClick={clearSelection}
                >
                  Clear Selection
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Trainer Checklist */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            border: '1px solid var(--border)',
            borderRadius: 10,
            maxHeight: '340px',
            marginBottom: '1rem',
            background: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {filteredTrainers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>👥</div>
              <div style={{ fontWeight: 600 }}>No trainers match the filter</div>
              <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                Try adjusting your search query or team filter.
              </div>
            </div>
          ) : (
            filteredTrainers.map((trainer) => {
              const isSelected = selectedUserIds.includes(trainer.id);
              const initial = (trainer.full_name || '?').charAt(0).toUpperCase();

              return (
                <div
                  key={trainer.id}
                  onClick={() => toggleTrainer(trainer.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(99,102,241,0.08)' : 'transparent',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'var(--surface-2)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // Handled by row click
                      style={{ cursor: 'pointer', width: 16, height: 16, flexShrink: 0 }}
                    />

                    {/* Avatar Initial */}
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: isSelected ? 'var(--accent)' : 'var(--surface-3)',
                        color: isSelected ? '#fff' : 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.85rem',
                        fontWeight: 800,
                        flexShrink: 0,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {initial}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                          {trainer.full_name}
                        </span>
                        {trainer.emp_id && (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              color: 'var(--text-muted)',
                              background: 'var(--surface-2)',
                              padding: '0.05rem 0.35rem',
                              borderRadius: 4,
                            }}
                          >
                            #{trainer.emp_id}
                          </span>
                        )}
                        {trainer.team && trainer.team !== 'N/A' && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              background: 'rgba(59,130,246,0.12)',
                              color: '#3b82f6',
                              padding: '0.05rem 0.4rem',
                              borderRadius: '999px',
                            }}
                          >
                            {trainer.team}
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          marginTop: '0.1rem',
                          display: 'flex',
                          gap: '0.65rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        {trainer.email && <span>✉️ {trainer.email}</span>}
                        {trainer.hackerrank_id && <span>🟢 HR: {trainer.hackerrank_id}</span>}
                        {trainer.leetcode_id && <span>🟠 LC: {trainer.leetcode_id}</span>}
                      </div>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: isSelected ? 'var(--accent)' : 'var(--text-muted)',
                      flexShrink: 0,
                      marginLeft: '0.5rem',
                    }}
                  >
                    {isSelected ? '✓ Selected' : '+ Add'}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid var(--border)',
            paddingTop: '1rem',
          }}
        >
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleCreateAndAssign}
            disabled={isSubmitting || !groupName.trim() || selectedUserIds.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}
          >
            {isSubmitting ? (
              <>
                <span className="spinner-border spinner-border-sm" />
                Creating Group…
              </>
            ) : (
              <>
                <span>🎉</span> Create &amp; Assign to Contest ({selectedUserIds.length})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
