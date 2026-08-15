import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import NotificationList from './NotificationList';
import './page.css';

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch all notifications for user
  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching notifications:', error);
  }

  // Fetch user role for admin/manager views
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  return (
    <div className="notifications-page">
      <header className="notifications-header">
        <h1>Notifications</h1>
      </header>
      <div className="notifications-content">
        <NotificationList 
          initialNotifications={notifications || []} 
          userRole={profile?.role || 'user'}
        />
      </div>
    </div>
  );
}
