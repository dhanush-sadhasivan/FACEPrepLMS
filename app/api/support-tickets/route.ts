import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { parseHackerrankUsername, sanitizeField } from '@/lib/utils';
import { parseLeetcodeUsername } from '@/lib/leetcode';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  const isAdminOrManager = profile?.role === 'admin' || profile?.role === 'manager';

  const dbAdmin = getAdminClient();

  try {
    let query = dbAdmin
      .from('support_tickets')
      .select('*, requester:users!user_id(id, full_name, email, emp_id, team), resolver:users!resolved_by(id, full_name, email)')
      .order('created_at', { ascending: false });

    if (!isAdminOrManager) {
      query = query.eq('user_id', user.id);
    }

    const { data: tickets, error } = await query;
    if (error) {
      console.error('[GET /api/support-tickets] DB error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(tickets || []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { full_name, emp_email, hackerrank_id, leetcode_id, reason } = body;

    const cleanName = sanitizeField(full_name);
    const cleanEmpEmail = sanitizeField(emp_email);
    const cleanHr = parseHackerrankUsername(hackerrank_id);
    const cleanLc = parseLeetcodeUsername(leetcode_id);
    const cleanReason = sanitizeField(reason) || 'Profile details update request';

    if (!cleanName) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
    }

    const dbAdmin = getAdminClient();

    // 1. Fetch current profile
    const { data: currentProfile, error: profErr } = await dbAdmin
      .from('users')
      .select('id, full_name, email, emp_email, emp_id, team, manager, hackerrank_id, leetcode_id')
      .eq('id', user.id)
      .single();

    if (profErr || !currentProfile) {
      return NextResponse.json({ error: 'Failed to fetch current user profile' }, { status: 400 });
    }

    // 2. Check if LeetCode ID is unique across other users
    if (cleanLc) {
      const { data: existingUsers } = await dbAdmin
        .from('users')
        .select('id, full_name, email, leetcode_id')
        .ilike('leetcode_id', cleanLc)
        .neq('id', user.id);

      if (existingUsers && existingUsers.length > 0) {
        const match = existingUsers[0];
        return NextResponse.json({
          error: `LeetCode ID "${cleanLc}" is already assigned to ${match.full_name} (${match.email}). LeetCode accounts must be unique per user.`,
        }, { status: 409 });
      }
    }

    // 3. Create the support ticket
    const requestedChanges = {
      full_name: cleanName,
      emp_email: cleanEmpEmail,
      hackerrank_id: cleanHr,
      leetcode_id: cleanLc,
      reason: cleanReason,
    };

    const currentValues = {
      full_name: currentProfile.full_name,
      emp_email: currentProfile.emp_email || '',
      hackerrank_id: currentProfile.hackerrank_id || '',
      leetcode_id: currentProfile.leetcode_id || '',
    };

    const { data: ticket, error: ticketErr } = await dbAdmin
      .from('support_tickets')
      .insert({
        user_id: user.id,
        type: 'profile_update',
        requested_changes: requestedChanges,
        current_values: currentValues,
        status: 'pending',
      })
      .select()
      .single();

    if (ticketErr) {
      console.error('[POST /api/support-tickets] Insert error:', ticketErr.message);
      return NextResponse.json({ error: ticketErr.message }, { status: 500 });
    }

    // 4. Notify all Admins and Managers
    const { data: managers } = await dbAdmin
      .from('users')
      .select('id')
      .in('role', ['admin', 'manager']);

    if (managers && managers.length > 0) {
      const notifications = managers.map((m: { id: string }) => ({
        user_id: m.id,
        type: 'system' as const,
        title: 'New Profile Change Request',
        message: `${currentProfile.full_name} requested a profile update: "${cleanReason}"`,
        related_id: ticket.id,
      }));
      await dbAdmin.from('notifications').insert(notifications);
    }

    return NextResponse.json({ ok: true, ticket }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to submit support ticket' }, { status: 500 });
  }
}
