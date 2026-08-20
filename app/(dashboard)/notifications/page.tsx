import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import NotificationList from './NotificationList';
import './page.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const dbAdmin = getAdminClient();

  // Fetch all notifications for user
  const { data: notifications, error } = await dbAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching notifications:', error);
  }

  // Fetch user role for admin/manager views
  const { data: profile } = await dbAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const allNotifications = notifications || [];
  const unreadCount = allNotifications.filter((n) => !n.is_read).length;
  const announcementsCount = allNotifications.filter((n) => n.type === 'announcement' || (n.title && n.title.includes('📢'))).length;
  const accessRequestsCount = allNotifications.filter((n) => n.type === 'access_request').length;
  const systemAlertsCount = allNotifications.filter((n) => (n.type === 'system' || n.type === 'contest_assigned') && !(n.title && n.title.includes('📢'))).length;

  return (
    <div className="notifications-page">
      {/* Header */}
      <header className="notifications-header">
        <div>
          <h1 className="notifications-title">Notifications &amp; Announcements</h1>
          <p className="notifications-subtitle">
            Stay informed about broadcast announcements, contest assignments, platform updates, and access requests.
          </p>
        </div>
      </header>

      {/* Top Overview Stats Widgets */}
      <div className="stats-overview-grid">
        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--accent)' }}>🔔</div>
          <div>
            <div className="stat-widget-val" style={{ color: 'var(--accent)' }}>{allNotifications.length}</div>
            <div className="stat-widget-label">Total Alerts</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: '#ef4444' }}>🔴</div>
          <div>
            <div className="stat-widget-val" style={{ color: '#ef4444' }}>{unreadCount}</div>
            <div className="stat-widget-label">Unread</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--accent)' }}>📢</div>
          <div>
            <div className="stat-widget-val" style={{ color: 'var(--accent)' }}>{announcementsCount}</div>
            <div className="stat-widget-label">Announcements</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--indigo)' }}>🔒</div>
          <div>
            <div className="stat-widget-val" style={{ color: 'var(--indigo)' }}>{accessRequestsCount}</div>
            <div className="stat-widget-label">Access Requests</div>
          </div>
        </div>
      </div>

      {/* Section Separator */}
      <div className="section-separator" style={{ margin: '1.5rem 0 1rem' }}>
        <div className="separator-line" />
        <div className="separator-badge">
          <span>🔔</span> SYSTEM ALERTS &amp; NOTIFICATIONS
        </div>
        <div className="separator-line" />
      </div>

      <div className="notifications-content">
        <NotificationList 
          initialNotifications={allNotifications} 
          userRole={profile?.role || 'user'}
        />
      </div>
    </div>
  );
}
