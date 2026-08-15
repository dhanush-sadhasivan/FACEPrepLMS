import { createClient } from '@/lib/supabase/server';
import UserTable from './UserTable';
import BulkImport from './BulkImport';
import { User } from '@/lib/types';
import './page.css';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching users:', error);
  }

  const typedUsers: User[] = users || [];

  return (
    <div className="users-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">Manage users, roles, and teams. Total users: {typedUsers.length}</p>
        </div>
        <div className="header-actions">
          {/* Add user button is handled inside UserTable for modal state, or we can lift it up. 
              We'll let UserTable handle the single Add User modal to keep state contained. */}
        </div>
      </div>

      <div className="card mt-6">
        <UserTable initialUsers={typedUsers} />
      </div>
      
      <div className="card mt-6">
        <BulkImport />
      </div>
    </div>
  );
}
