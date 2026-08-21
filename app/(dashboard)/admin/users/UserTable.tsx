'use client';

import { useState, useMemo } from 'react';
import { User } from '@/lib/types';
import { useToast } from '@/components/Toast';

interface UserTableProps {
  initialUsers: User[];
}

interface CreatedCredentials {
  full_name: string;
  email: string;
  tempPassword?: string;
  role: string;
}

function cleanValue(val?: string | null): string {
  if (!val) return '';
  const str = String(val).trim();
  if (['nil', 'null', 'n/a', 'undefined', 'none', '-'].includes(str.toLowerCase())) {
    return '';
  }
  return str;
}

function displayValue(val?: string | null): React.ReactNode {
  const cleaned = cleanValue(val);
  if (!cleaned) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  return cleaned;
}

function getInitials(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

type UserSortField = 'full_name' | 'emp_id' | 'team' | 'manager' | 'hackerrank_id' | 'role';
type SortDirection = 'asc' | 'desc' | null;

export default function UserTable({ initialUsers = [] }: UserTableProps) {
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // 3-state Sorting State (Normal -> Asc / A-Z -> Desc / Z-A -> Normal)
  const [sortField, setSortField] = useState<UserSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (field: UserSortField) => {
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

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<CreatedCredentials | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<User> & { password?: string }>({});
  const [resetCustomPassword, setResetCustomPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Role Counts
  const counts = useMemo(() => {
    const admin = users.filter((u) => u.role?.toLowerCase() === 'admin').length;
    const manager = users.filter((u) => u.role?.toLowerCase() === 'manager').length;
    const trainer = users.filter((u) => u.role?.toLowerCase() === 'trainer').length;
    return { all: users.length, admin, manager, trainer };
  }, [users]);

  // Filtering
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.emp_id?.toLowerCase().includes(q) ||
        u.team?.toLowerCase().includes(q) ||
        u.hackerrank_id?.toLowerCase().includes(q) ||
        u.manager?.toLowerCase().includes(q);

      const matchesRole = roleFilter === 'All' || u.role?.toLowerCase() === roleFilter.toLowerCase();

      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const sortedUsers = useMemo(() => {
    if (!sortField || !sortDirection) return filteredUsers;

    return [...filteredUsers].sort((a, b) => {
      const valA = (a[sortField] || '').toString().toLowerCase();
      const valB = (b[sortField] || '').toString().toLowerCase();

      return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  }, [filteredUsers, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / itemsPerPage));
  const currentUsers = sortedUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const renderSortHeader = (label: string, field: UserSortField, style?: React.CSSProperties) => {
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

  const handleOpenEdit = (user: User) => {
    setSelectedUser(user);
    setFormData({
      full_name: cleanValue(user.full_name),
      email: cleanValue(user.email),
      emp_id: cleanValue(user.emp_id),
      role: user.role,
      team: cleanValue(user.team),
      manager: cleanValue(user.manager),
      hackerrank_id: cleanValue(user.hackerrank_id),
    });
    setIsEditModalOpen(true);
  };

  const handleOpenDelete = (user: User) => {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };

  const handleOpenReset = (user: User) => {
    setSelectedUser(user);
    setResetCustomPassword('');
    setIsResetModalOpen(true);
  };

  const handleOpenAdd = () => {
    setFormData({ role: 'trainer', password: '' });
    setIsAddModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (isEditModalOpen && selectedUser) {
        const res = await fetch(`/api/users/${selectedUser.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          const updated = await res.json();
          setUsers(users.map((u) => (u.id === updated.id ? updated : u)));
          setIsEditModalOpen(false);
          showToast('User updated successfully', 'success');
        } else {
          const errorData = await res.json();
          showToast(`Failed to update user: ${errorData.error}`, 'error');
        }
      } else if (isAddModalOpen) {
        const res = await fetch(`/api/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          const created = await res.json();
          setUsers([created, ...users]);
          setIsAddModalOpen(false);
          setCreatedCredentials({
            full_name: created.full_name,
            email: created.email,
            tempPassword: created.tempPassword,
            role: created.role,
          });
          showToast('User created successfully!', 'success');
        } else {
          const errorData = await res.json();
          showToast(`Failed to add user: ${errorData.error || 'Unknown error'}`, 'error');
        }
      }
    } catch (err) {
      console.error(err);
      showToast('An error occurred', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTriggerResetPassword = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/users/${selectedUser.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetCustomPassword }),
      });
      const data = await res.json();

      if (res.ok) {
        setIsResetModalOpen(false);
        setCreatedCredentials({
          full_name: data.full_name || selectedUser.full_name,
          email: data.email || selectedUser.email,
          tempPassword: data.tempPassword,
          role: selectedUser.role,
        });
        showToast('Password reset successfully! Temporary password generated.', 'success');
      } else {
        showToast(`Failed to reset password: ${data.error}`, 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('An error occurred while resetting password', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, { method: 'DELETE' });
      if (res.ok) {
        setUsers(users.filter((u) => u.id !== selectedUser.id));
        setIsDeleteModalOpen(false);
        showToast('User deleted successfully', 'success');
      } else {
        showToast('Failed to delete user', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('An error occurred', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Credentials copied to clipboard!', 'info');
  };

  const renderRoleBadge = (role?: string) => {
    const r = role?.toLowerCase() || 'trainer';
    if (r === 'admin') {
      return (
        <span className="role-badge admin">
          👑 Admin
        </span>
      );
    }
    if (r === 'manager') {
      return (
        <span className="role-badge manager">
          🛡️ Manager
        </span>
      );
    }
    return (
      <span className="role-badge trainer">
        🎓 Trainer
      </span>
    );
  };

  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, filteredUsers.length);

  return (
    <div className="user-table-wrapper">
      {/* Controls Header & Filter Tabs */}
      <div className="table-controls-bar">
        {/* Role Tabs */}
        <div className="role-filter-tabs">
          <button
            className={`role-tab-btn ${roleFilter === 'All' ? 'active' : ''}`}
            onClick={() => { setRoleFilter('All'); setCurrentPage(1); }}
          >
            All Users <span className="tab-count-pill">{counts.all}</span>
          </button>
          <button
            className={`role-tab-btn ${roleFilter === 'Admin' ? 'active' : ''}`}
            onClick={() => { setRoleFilter('Admin'); setCurrentPage(1); }}
          >
            👑 Admins <span className="tab-count-pill">{counts.admin}</span>
          </button>
          <button
            className={`role-tab-btn ${roleFilter === 'Manager' ? 'active' : ''}`}
            onClick={() => { setRoleFilter('Manager'); setCurrentPage(1); }}
          >
            🛡️ Managers <span className="tab-count-pill">{counts.manager}</span>
          </button>
          <button
            className={`role-tab-btn ${roleFilter === 'Trainer' ? 'active' : ''}`}
            onClick={() => { setRoleFilter('Trainer'); setCurrentPage(1); }}
          >
            🎓 Trainers <span className="tab-count-pill">{counts.trainer}</span>
          </button>
        </div>

        {/* Search & Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div className="search-box-wrapper">
            <span className="search-box-icon">🔍</span>
            <input
              type="text"
              className="search-box-input"
              placeholder="Search user, ID, team..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            />
          </div>

          <button className="btn btn-primary" onClick={handleOpenAdd}>
            ➕ Add Single User
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="table-card">
        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                {renderSortHeader('User Details', 'full_name')}
                {renderSortHeader('Emp ID', 'emp_id')}
                {renderSortHeader('Team', 'team')}
                {renderSortHeader('Manager', 'manager')}
                {renderSortHeader('HackerRank ID', 'hackerrank_id')}
                {renderSortHeader('Role', 'role')}
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentUsers.map((u) => (
                <tr key={u.id}>
                  {/* User Cell: Avatar + Full Name + Email */}
                  <td>
                    <div className="user-identity-cell">
                      <div className="user-avatar">{getInitials(u.full_name)}</div>
                      <div className="user-name-box">
                        <span className="user-full-name">{u.full_name || 'Unnamed User'}</span>
                        <span className="user-email-text">{u.email}</span>
                      </div>
                    </div>
                  </td>

                  {/* Emp ID */}
                  <td>
                    {cleanValue(u.emp_id) ? (
                      <span className="emp-id-badge">{cleanValue(u.emp_id)}</span>
                    ) : (
                      displayValue(u.emp_id)
                    )}
                  </td>

                  {/* Team */}
                  <td>
                    {cleanValue(u.team) ? (
                      <span className="meta-chip">🏢 {cleanValue(u.team)}</span>
                    ) : (
                      displayValue(u.team)
                    )}
                  </td>

                  {/* Manager */}
                  <td>
                    {cleanValue(u.manager) ? (
                      <span className="meta-chip">👤 {cleanValue(u.manager)}</span>
                    ) : (
                      displayValue(u.manager)
                    )}
                  </td>

                  {/* HackerRank ID */}
                  <td>
                    {cleanValue(u.hackerrank_id) ? (
                      <span className="meta-chip hackerrank">⚡ {cleanValue(u.hackerrank_id)}</span>
                    ) : (
                      displayValue(u.hackerrank_id)
                    )}
                  </td>

                  {/* Role */}
                  <td>{renderRoleBadge(u.role)}</td>

                  {/* Actions */}
                  <td>
                    <div className="action-btn-group">
                      <button
                        className="action-icon-btn"
                        onClick={() => handleOpenReset(u)}
                        title="Reset password & generate temporary credentials"
                      >
                        🔑 Reset
                      </button>
                      <button
                        className="action-icon-btn"
                        onClick={() => handleOpenEdit(u)}
                        title="Edit user details"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="action-icon-btn delete-btn"
                        onClick={() => handleOpenDelete(u)}
                        title="Delete user"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {currentUsers.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-users-state">
                      <div className="empty-users-icon">🔍</div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0.25rem 0' }}>
                        No users found
                      </h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {search
                          ? `No matches for "${search}". Try adjusting your search query or filters.`
                          : 'No users created under this role category yet.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredUsers.length > 0 && (
          <div className="pagination-bar">
            <div>
              Showing <strong>{startIndex}</strong> to <strong>{endIndex}</strong> of{' '}
              <strong>{filteredUsers.length}</strong> users
            </div>

            <div className="pagination-controls">
              <button
                className="page-num-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                title="Previous Page"
              >
                ‹
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  className={`page-num-btn ${pageNum === currentPage ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              ))}

              <button
                className="page-num-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                title="Next Page"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 560 }}>
            <h2 className="modal-title">{isEditModalOpen ? '✏️ Edit User Details' : '➕ Add New User'}</h2>
            <form onSubmit={handleSave}>
              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="label">Full Name *</label>
                  <input required type="text" name="full_name" className="input" value={formData.full_name || ''} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="label">Email *</label>
                  <input required type="email" name="email" className="input" value={formData.email || ''} onChange={handleChange} disabled={isEditModalOpen} />
                </div>
                <div className="form-group">
                  <label className="label">Emp ID *</label>
                  <input required type="text" name="emp_id" className="input" value={formData.emp_id || ''} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="label">Role *</label>
                  <select name="role" className="input" value={formData.role || 'trainer'} onChange={handleChange}>
                    <option value="trainer">🎓 Trainer</option>
                    <option value="manager">🛡️ Manager</option>
                    <option value="admin">👑 Admin</option>
                  </select>
                </div>
                {isAddModalOpen && (
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="label">Temporary Password (Optional)</label>
                    <input
                      type="text"
                      name="password"
                      className="input"
                      placeholder="Leave blank to auto-generate password"
                      value={formData.password || ''}
                      onChange={handleChange}
                    />
                  </div>
                )}
                <div className="form-group">
                  <label className="label">Team</label>
                  <input type="text" name="team" className="input" placeholder="e.g. Engineering" value={formData.team || ''} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="label">Manager (Optional)</label>
                  <input type="text" name="manager" className="input" placeholder="Manager Name" value={formData.manager || ''} onChange={handleChange} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="label">HackerRank ID (Optional)</label>
                  <input type="text" name="hackerrank_id" className="input" placeholder="e.g. john_hr" value={formData.hackerrank_id || ''} onChange={handleChange} />
                </div>
              </div>
              <div className="modal-actions mt-6" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : '💾 Save User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Reset Password Modal */}
      {isResetModalOpen && selectedUser && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 480 }}>
            <h2 className="modal-title">🔑 Reset Password</h2>
            <p className="text-muted mb-4" style={{ fontSize: '0.88rem' }}>
              Generate a temporary password for <strong>{selectedUser.full_name}</strong> (<code>{selectedUser.email}</code>). They will be forced to set a new password on their next login.
            </p>
            <div className="form-group mb-4">
              <label className="label">Temporary Password (Optional)</label>
              <input
                type="text"
                className="input"
                placeholder="Leave blank for auto-generated password"
                value={resetCustomPassword}
                onChange={(e) => setResetCustomPassword(e.target.value)}
              />
            </div>
            <div className="modal-actions mt-6" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsResetModalOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleTriggerResetPassword} disabled={isSubmitting}>
                {isSubmitting ? 'Resetting...' : '🔑 Reset & Generate Temp Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Created / Reset Credentials Modal */}
      {createdCredentials && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 480 }}>
            <h2 className="modal-title" style={{ color: 'var(--success)' }}>🎉 Temporary Password Set</h2>
            <p className="text-muted mb-4" style={{ fontSize: '0.88rem' }}>
              Credentials for <strong>{createdCredentials.full_name}</strong> (<code>{createdCredentials.email}</code>):
            </p>
            <div style={{ background: 'var(--surface-2)', padding: '1rem', borderRadius: 8, border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: '0.88rem' }}>
              <div className="mb-2"><strong>Email:</strong> {createdCredentials.email}</div>
              <div><strong>Temp Password:</strong> <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{createdCredentials.tempPassword}</span></div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.75rem', fontStyle: 'italic' }}>
              User will be forced to change this temporary password upon their next login.
            </p>
            <div className="modal-actions mt-6" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => copyToClipboard(`Email: ${createdCredentials.email}\nPassword: ${createdCredentials.tempPassword}`)}
              >
                📋 Copy Credentials
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setCreatedCredentials(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {isDeleteModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 460 }}>
            <h2 className="modal-title" style={{ color: 'var(--error)' }}>🗑️ Delete User</h2>
            <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
              Are you sure you want to delete <strong>{selectedUser?.full_name}</strong> (<code>{selectedUser?.email}</code>)? This action cannot be undone.
            </p>
            <div className="modal-actions mt-6" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setIsDeleteModalOpen(false)}>Cancel</button>
              <button className="btn" onClick={handleDelete} disabled={isSubmitting} style={{ background: 'var(--error)', color: '#fff' }}>
                {isSubmitting ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
