'use client';

import { useState, useMemo } from 'react';
import { User } from '@/lib/types';
import { useRouter } from 'next/navigation';
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

export default function UserTable({ initialUsers }: UserTableProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

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

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.emp_id?.toLowerCase().includes(search.toLowerCase()) ||
        u.team?.toLowerCase().includes(search.toLowerCase());

      const matchesRole = roleFilter === 'All' || u.role === roleFilter.toLowerCase();

      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const currentUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleOpenEdit = (user: User) => {
    setSelectedUser(user);
    // Sanitize values so "Nil" / "null" strings are cleaned to "" in the form inputs
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
          setUsers(users.map(u => u.id === updated.id ? updated : u));
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
        setUsers(users.filter(u => u.id !== selectedUser.id));
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

  const getRoleBadgeClass = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin': return 'badge-orange';
      case 'manager': return 'badge-blue';
      default: return 'badge-gray';
    }
  };

  return (
    <div className="user-table-wrapper">
      <div className="table-controls mb-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="search-filter-group" style={{ display: 'flex', gap: '0.75rem', flex: 1, maxWidth: 600 }}>
          <input
            type="text"
            className="input search-input"
            placeholder="Search by name, ID, email, team..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="select filter-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{ width: 140 }}
          >
            <option value="All">All Roles</option>
            <option value="Admin">Admin</option>
            <option value="Manager">Manager</option>
            <option value="Trainer">Trainer</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          + Add User
        </button>
      </div>

      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Emp ID</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Team</th>
              <th>Manager</th>
              <th>HackerRank ID</th>
              <th>Role</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentUsers.map(u => (
              <tr key={u.id}>
                <td>{displayValue(u.emp_id)}</td>
                <td className="font-medium">{displayValue(u.full_name)}</td>
                <td className="text-muted">{displayValue(u.email)}</td>
                <td>{displayValue(u.team)}</td>
                <td>{displayValue(u.manager)}</td>
                <td>{displayValue(u.hackerrank_id)}</td>
                <td>
                  <span className={`badge ${getRoleBadgeClass(u.role)}`}>
                    {u.role}
                  </span>
                </td>
                <td className="text-right" style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-ghost btn-sm mr-2" onClick={() => handleOpenReset(u)} title="Reset password with temporary password">
                    🔑 Reset
                  </button>
                  <button className="btn btn-ghost btn-sm mr-2" onClick={() => handleOpenEdit(u)}>
                    Edit
                  </button>
                  <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleOpenDelete(u)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {currentUsers.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-muted">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination mt-4">
          <button
            className="btn btn-secondary btn-sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
          >
            Previous
          </button>
          <span className="text-sm">Page {currentPage} of {totalPages}</span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
          >
            Next
          </button>
        </div>
      )}

      {/* Add / Edit Modal */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 560 }}>
            <h2 className="modal-title">{isEditModalOpen ? 'Edit User' : 'Add New User'}</h2>
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
                  <select name="role" className="select" value={formData.role || 'trainer'} onChange={handleChange}>
                    <option value="trainer">Trainer</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
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
                  {isSubmitting ? 'Saving...' : 'Save User'}
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
            <p className="text-muted mb-4" style={{ fontSize: '0.9rem' }}>
              Generate a temporary password for <strong>{selectedUser.full_name}</strong> (<code>{selectedUser.email}</code>). They will be forced to set a new password on their next login.
            </p>
            <div className="form-group mb-4">
              <label className="label">Temporary Password (Optional)</label>
              <input
                type="text"
                className="input"
                placeholder="Leave blank for auto-generated password"
                value={resetCustomPassword}
                onChange={e => setResetCustomPassword(e.target.value)}
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
            <p className="text-muted mb-4" style={{ fontSize: '0.9rem' }}>
              Credentials for <strong>{createdCredentials.full_name}</strong> (<code>{createdCredentials.email}</code>):
            </p>
            <div style={{ background: 'var(--surface-2)', padding: '1rem', borderRadius: 8, border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: '0.9rem' }}>
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
            <h2 className="modal-title">Delete User</h2>
            <p style={{ color: 'var(--text-muted)' }}>Are you sure you want to delete <strong>{selectedUser?.full_name}</strong>? This action cannot be undone.</p>
            <div className="modal-actions mt-6" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setIsDeleteModalOpen(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={isSubmitting}>
                {isSubmitting ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
