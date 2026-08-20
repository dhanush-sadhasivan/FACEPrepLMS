import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type Params = Promise<{ id: string }>;

export async function PATCH(req: Request, { params }: { params: Params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: caller } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (caller?.role !== 'admin' && caller?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  try {
    const body = await req.json();
    const { full_name, emp_id, role, team, manager, hackerrank_id } = body;

    if (hackerrank_id && hackerrank_id.trim() !== '') {
      const cleanHr = hackerrank_id.trim();
      if (!['nil', 'null', 'n/a', 'undefined', 'none', '-'].includes(cleanHr.toLowerCase())) {
        try {
          const hrRes = await fetch(`https://www.hackerrank.com/rest/hackers/${encodeURIComponent(cleanHr)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            cache: 'no-store',
          });
          if (hrRes.status === 404) {
            return NextResponse.json({ error: `HackerRank ID "${cleanHr}" does not exist on HackerRank. Please check the spelling.` }, { status: 400 });
          }
          if (hrRes.ok) {
            const hrData = await hrRes.json().catch(() => null);
            if (hrData?.status === false || (hrData && !hrData.model)) {
              return NextResponse.json({ error: `HackerRank ID "${cleanHr}" does not exist on HackerRank. Please check the spelling.` }, { status: 400 });
            }
          }
        } catch {
          // silent fallback
        }
      }
    }

    const supabaseAdmin = getAdminClient();
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ full_name, emp_id, role, team, manager, hackerrank_id })
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: caller } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (caller?.role !== 'admin' && caller?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  try {
    const supabaseAdmin = getAdminClient();
    const { error: dbError } = await supabaseAdmin.from('users').delete().eq('id', id);
    if (dbError) throw dbError;
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authError) throw authError;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
