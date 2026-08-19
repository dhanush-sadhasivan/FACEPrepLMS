import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import InternalTrainingClient from './InternalTrainingClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function InternalTrainingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const dbAdmin = getAdminClient();

  // 1. Fetch user profile
  const { data: profile } = await dbAdmin
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  const role = profile.role || 'trainer';
  const isAdminOrManager = role === 'admin' || role === 'manager';

  // 2. Fetch assigned IT roadmaps (only roadmaps allocated directly to this user or their groups)
  const { data: memberships } = await dbAdmin
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id);

  const userGroupIds = (memberships || []).map((m: any) => m.group_id);

  // Fetch assignments
  const { data: assignments } = await dbAdmin
    .from('roadmap_assignments')
    .select('roadmap_id, user_id, group_id');

  const assignedRoadmapIds = new Set<string>();
  (assignments || []).forEach((a: any) => {
    if (a.user_id === user.id) assignedRoadmapIds.add(a.roadmap_id);
    if (a.group_id && userGroupIds.includes(a.group_id)) assignedRoadmapIds.add(a.roadmap_id);
  });

  let itRoadmaps: any[] = [];
  if (assignedRoadmapIds.size > 0) {
    const { data: rms } = await dbAdmin
      .from('roadmaps')
      .select('id, title, domain, is_it_roadmap')
      .in('id', Array.from(assignedRoadmapIds))
      .eq('is_it_roadmap', true)
      .order('created_at', { ascending: false });
    itRoadmaps = rms || [];
  }

  const { data: authUserData } = await dbAdmin.auth.admin.getUserById(user.id);
  const metadata = authUserData?.user?.user_metadata || {};

  const currentUser = {
    id: profile.id,
    full_name: profile.full_name,
    role: profile.role,
    it_days_count: profile.it_days_count ?? metadata.it_days_count ?? 0,
    last_it_check_date: profile.last_it_check_date || metadata.last_it_check_date || null,
  };

  const assignedRoadmaps = itRoadmaps.map((r: any) => ({
    id: r.id,
    title: r.title,
    domain: r.domain,
  }));

  return (
    <InternalTrainingClient
      currentUser={currentUser}
      assignedRoadmaps={assignedRoadmaps}
    />
  );
}
