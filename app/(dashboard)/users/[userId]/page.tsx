import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getUserPerformanceProfile } from '@/lib/user-performance-profile';
import UserProfileClient from './UserProfileClient';
import './page.css';

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  let { userId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  if (userId === 'me') {
    userId = user.id;
  }

  const { data: viewer } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const viewerRole: string = viewer?.role ?? 'trainer';

  if (viewerRole === 'trainer' && userId !== user.id) {
    redirect('/dashboard');
  }

  const result = await getUserPerformanceProfile(userId);

  if (!result.success || !result.data) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>😕</div>
        <div style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
          User Profile Not Found
        </div>
        <div style={{ fontSize: '0.85rem' }}>
          {result.error || 'The requested user could not be found or has not participated in any tracked activities.'}
        </div>
      </div>
    );
  }

  return (
    <UserProfileClient
      data={result.data}
      viewerRole={viewerRole}
      currentUserId={user.id}
    />
  );
}