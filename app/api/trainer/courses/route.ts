import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/trainer/courses — Fetch courses assigned to the logged-in user
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch user's group memberships
  const { data: groupMemberships } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id);
  const groupIds = (groupMemberships || []).map((g: { group_id: string }) => g.group_id);

  // Direct user assignments
  const { data: directAssignments } = await supabase
    .from('course_assignments')
    .select('*, course:courses(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Group-based assignments
  let groupAssignments: unknown[] = [];
  if (groupIds.length > 0) {
    const { data: ga } = await supabase
      .from('course_assignments')
      .select('*, course:courses(*)')
      .in('group_id', groupIds)
      .order('created_at', { ascending: false });
    groupAssignments = ga || [];
  }

  // Combine and deduplicate by course_id
  const seen = new Set<string>();
  const combined = [...(directAssignments || []), ...groupAssignments].filter((a: unknown) => {
    const assignment = a as { course_id: string };
    if (seen.has(assignment.course_id)) return false;
    seen.add(assignment.course_id);
    return true;
  });

  return NextResponse.json(combined);
}
