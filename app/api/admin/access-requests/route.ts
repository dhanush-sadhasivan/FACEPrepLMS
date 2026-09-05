import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin' && profile?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const dbAdmin = getAdminClient();

  const { data: requests, error } = await dbAdmin
    .from('access_requests')
    .select('*, trainer:users!user_id(id, full_name, email, emp_id, team), contest:contests!contest_id(id, title, hackerrank_slug)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(`[GET /api/admin/access-requests] Error: ${error.message}`);
    return NextResponse.json({ error: 'Failed to fetch access requests' }, { status: 500 });
  }

  return NextResponse.json(requests || []);
}
