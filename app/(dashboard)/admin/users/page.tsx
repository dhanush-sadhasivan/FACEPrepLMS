import { createClient } from '@/lib/supabase/server';
import UserTable from './UserTable';
import BulkImport from './BulkImport';
import { User } from '@/lib/types';
import './page.css';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const supabase = await createClient();

  // Try with updater join first; fall back to plain select if the join fails
  // (e.g. if migration 09 adding updated_by column hasn't been applied)
  let fetchedUsers: any[] | null = null;
  let fetchError: any = null;

  const { data: usersWithJoin, error: joinError } = await supabase
    .from('users')
    .select('*, updater:users!updated_by(id, full_name, role)')
    .order('created_at', { ascending: false });

  if (joinError) {
    console.warn('Users fetch with updater join failed, falling back to plain select:', joinError.message);
    const { data: usersPlain, error: plainError } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    fetchedUsers = usersPlain;
    fetchError = plainError;
  } else {
    fetchedUsers = usersWithJoin;
  }

  if (fetchError) {
    console.error('Error fetching users:', fetchError);
  }

  const typedUsers: User[] = fetchedUsers || [];

  const adminCount = typedUsers.filter((u) => u.role?.toLowerCase() === 'admin').length;
  const managerCount = typedUsers.filter((u) => u.role?.toLowerCase() === 'manager').length;
  const trainerCount = typedUsers.filter((u) => u.role?.toLowerCase() === 'trainer').length;

  return (
    <div className="users-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">
            Manage user accounts, roles, group assignments, and batch credentials.
          </p>
        </div>
      </div>

      {/* Top Stats Overview Widgets */}
      <div className="stats-overview-grid">
        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--text-primary)' }}>👥</div>
          <div>
            <div className="stat-widget-val">{typedUsers.length}</div>
            <div className="stat-widget-label">Total Users</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--accent)' }}>👑</div>
          <div>
            <div className="stat-widget-val" style={{ color: 'var(--accent)' }}>{adminCount}</div>
            <div className="stat-widget-label">System Admins</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--indigo)' }}>🛡️</div>
          <div>
            <div className="stat-widget-val" style={{ color: 'var(--indigo)' }}>{managerCount}</div>
            <div className="stat-widget-label">Managers</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--success)' }}>🎓</div>
          <div>
            <div className="stat-widget-val" style={{ color: 'var(--success)' }}>{trainerCount}</div>
            <div className="stat-widget-label">Trainers</div>
          </div>
        </div>
      </div>

      {/* Section Separator */}
      <div className="section-separator">
        <div className="separator-line" />
        <div className="separator-badge">
          <span>👥</span> USER DIRECTORY & CREDENTIALS
        </div>
        <div className="separator-line" />
      </div>

      {/* Main User Table */}
      <UserTable initialUsers={typedUsers} />

      {/* Section Separator */}
      <div className="section-separator">
        <div className="separator-line" />
        <div className="separator-badge">
          <span>📥</span> CSV BATCH ACCOUNTS IMPORT
        </div>
        <div className="separator-line" />
      </div>

      {/* Bulk Import Tool */}
      <BulkImport />
    </div>
  );
}
