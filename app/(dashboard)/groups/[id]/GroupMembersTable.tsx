'use client';

import { useState, useMemo } from 'react';
import RemoveMemberButton from './RemoveMemberButton';

interface GroupMember {
  id: string;
  full_name: string | null;
  emp_id: string | null;
  team: string | null;
  role: string;
}

interface GroupMembersTableProps {
  groupId: string;
  members: GroupMember[];
}

type GroupMemberSortField = 'full_name' | 'emp_id' | 'team' | 'role';
type SortDirection = 'asc' | 'desc' | null;

function getInitials(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

function renderRoleBadge(role?: string) {
  const r = role?.toLowerCase() || 'trainer';
  if (r === 'admin') return <span className="role-badge admin">👑 Admin</span>;
  if (r === 'manager') return <span className="role-badge manager">🛡️ Manager</span>;
  return <span className="role-badge trainer">🎓 Trainer</span>;
}

export default function GroupMembersTable({ groupId, members }: GroupMembersTableProps) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<GroupMemberSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (field: GroupMemberSortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      setSortField(null);
      setSortDirection(null);
    }
  };

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        (m.full_name || '').toLowerCase().includes(q) ||
        (m.emp_id || '').toLowerCase().includes(q) ||
        (m.team || '').toLowerCase().includes(q) ||
        (m.role || '').toLowerCase().includes(q)
      );
    });
  }, [members, search]);

  const sortedMembers = useMemo(() => {
    if (!sortField || !sortDirection) return filteredMembers;

    return [...filteredMembers].sort((a, b) => {
      const valA = (a[sortField] || '').toString().toLowerCase();
      const valB = (b[sortField] || '').toString().toLowerCase();

      return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  }, [filteredMembers, sortField, sortDirection]);

  const renderSortHeader = (label: string, field: GroupMemberSortField, style?: React.CSSProperties) => {
    const isActive = sortField === field;
    return (
      <th
        onClick={() => handleSort(field)}
        style={{
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'color 0.15s ease',
          color: isActive ? 'var(--accent)' : undefined,
          ...style,
        }}
        title={`Sort by ${label} (${isActive ? (sortDirection === 'asc' ? 'A-Z / Ascending' : 'Z-A / Descending') : 'Click to sort'})`}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <span>{label}</span>
          <span style={{ fontSize: '0.75rem', opacity: isActive ? 1 : 0.4 }}>
            {isActive ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
          </span>
        </div>
      </th>
    );
  };

  return (
    <>
      {members.length > 5 && (
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <input
            type="text"
            placeholder="Search roster members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              color: 'var(--text-primary)',
              fontSize: '0.84rem',
              outline: 'none',
              maxWidth: 300,
            }}
          />
        </div>
      )}

      <div className="members-table-container">
        <table className="members-table">
          <thead>
            <tr>
              {renderSortHeader('Member Details', 'full_name')}
              {renderSortHeader('Emp ID', 'emp_id')}
              {renderSortHeader('Team', 'team')}
              {renderSortHeader('Role', 'role')}
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedMembers.map((member) => (
              <tr key={member.id}>
                {/* User Cell */}
                <td>
                  <div className="member-identity-cell">
                    <div className="member-avatar">{getInitials(member.full_name)}</div>
                    <span className="member-name">{member.full_name || 'Unnamed User'}</span>
                  </div>
                </td>

                {/* Emp ID */}
                <td>
                  {member.emp_id ? (
                    <span className="emp-id-badge">{member.emp_id}</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                  )}
                </td>

                {/* Team */}
                <td>
                  {member.team ? (
                    <span className="meta-chip">🏢 {member.team}</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                  )}
                </td>

                {/* Role */}
                <td>{renderRoleBadge(member.role)}</td>

                {/* Actions */}
                <td style={{ textAlign: 'right' }}>
                  <RemoveMemberButton groupId={groupId} userId={member.id} userName={member.full_name || ''} />
                </td>
              </tr>
            ))}

            {sortedMembers.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <div className="empty-users-state">
                    <div className="empty-users-icon">👥</div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0.25rem 0' }}>
                      {search ? 'No matching members found' : 'No members assigned to this group'}
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {search
                        ? 'Try adjusting your search query.'
                        : 'Click "+ Add Member" above to enroll trainers and managers into this cohort.'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
