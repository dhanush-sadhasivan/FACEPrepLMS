import { createClient } from '@/lib/supabase/server';
import { getUserPerformanceProfile } from '@/lib/user-performance-profile';
import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  let userId = id;
  if (userId === 'me') {
    userId = user.id;
  }

  // Fetch viewer role
  const { data: viewer } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const viewerRole = viewer?.role ?? 'trainer';

  // Trainers can only view their own profile
  if (viewerRole === 'trainer' && userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const result = await getUserPerformanceProfile(userId);
  if (!result.success || !result.data) {
    return NextResponse.json({ error: result.error || 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ ...result.data, viewerRole });
}