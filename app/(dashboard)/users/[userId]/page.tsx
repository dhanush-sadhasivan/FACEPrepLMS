import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import UserProfileClient from './UserProfileClient';
import './page.css';

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: viewer } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const viewerRole: string = viewer?.role ?? 'trainer';

  if (viewerRole === 'trainer' && userId !== user.id) {
    redirect('/dashboard');
  }

  const dbAdmin = getAdminClient();
  const { data: profileData, error } = await dbAdmin.rpc(
    'get_user_performance_profile',
    { target_user_id: userId }
  );

  if (error || !profileData || (profileData as any).error) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>😕</div>
        <div>User profile not found.</div>
      </div>
    );
  }

  return (
    <UserProfileClient
      data={profileData as any}
      viewerRole={viewerRole}
      currentUserId={user.id}
    />
  );
}