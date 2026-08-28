import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { generateAndUploadCdnSnapshots } from '@/lib/cdn-cache';
import { revalidatePath, revalidateTag } from 'next/cache';

type Params = Promise<{ id: string }>;

export async function PATCH(req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: caller } = await supabase.from('users').select('id, full_name, role').eq('id', user.id).single();
  if (caller?.role !== 'admin' && caller?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden: Only Admins and Managers can review support tickets.' }, { status: 403 });
  }

  const dbAdmin = getAdminClient();

  try {
    const body = await req.json();
    const { action, admin_notes } = body; // action: 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Action must be "approve" or "reject"' }, { status: 400 });
    }

    // 1. Fetch the ticket
    const { data: ticket, error: ticketErr } = await dbAdmin
      .from('support_tickets')
      .select('*, requester:users!user_id(id, full_name, email, emp_id, team, hackerrank_id, leetcode_id)')
      .eq('id', id)
      .single();

    if (ticketErr || !ticket) {
      return NextResponse.json({ error: 'Support ticket not found' }, { status: 404 });
    }

    const resolvedAt = new Date().toISOString();

    if (action === 'approve') {
      const requested = ticket.requested_changes || {};
      const targetUserId = ticket.user_id;

      // Uniqueness check for LeetCode ID before updating
      if (requested.leetcode_id) {
        const { data: existing } = await dbAdmin
          .from('users')
          .select('id, full_name, email')
          .ilike('leetcode_id', requested.leetcode_id)
          .neq('id', targetUserId);

        if (existing && existing.length > 0) {
          const match = existing[0];
          return NextResponse.json({
            error: `Cannot approve: LeetCode ID "${requested.leetcode_id}" is already assigned to ${match.full_name} (${match.email}).`,
          }, { status: 409 });
        }
      }

      // 2. Apply requested changes to public.users
      const updatePayload: Record<string, any> = {
        updated_by: user.id,
        updated_at: resolvedAt,
      };
      if (requested.full_name) updatePayload.full_name = requested.full_name;
      if (requested.emp_email !== undefined) updatePayload.emp_email = requested.emp_email || null;
      if (requested.hackerrank_id !== undefined) updatePayload.hackerrank_id = requested.hackerrank_id || null;
      if (requested.leetcode_id !== undefined) updatePayload.leetcode_id = requested.leetcode_id || null;

      let { error: userUpdateErr } = await dbAdmin
        .from('users')
        .update(updatePayload)
        .eq('id', targetUserId);

      if (userUpdateErr) {
        if (
          userUpdateErr.message?.includes('updated_at') ||
          userUpdateErr.message?.includes('updated_by') ||
          userUpdateErr.code === 'PGRST204' ||
          userUpdateErr.code === 'PGRST200' ||
          userUpdateErr.code === '42703'
        ) {
          console.warn('[support-tickets/resolve] User update failed with audit columns, retrying without audit fields...');
          const fallbackPayload = { ...updatePayload };
          delete fallbackPayload.updated_by;
          delete fallbackPayload.updated_at;

          const fallbackRes = await dbAdmin
            .from('users')
            .update(fallbackPayload)
            .eq('id', targetUserId);
          userUpdateErr = fallbackRes.error;
        }
      }

      if (userUpdateErr) {
        console.error('[support-tickets/resolve] User update error:', userUpdateErr.message);
        return NextResponse.json({ error: `Failed to update user profile: ${userUpdateErr.message}` }, { status: 500 });
      }

      // 3. Mark ticket resolved with audit tracking
      const { data: updatedTicket, error: resErr } = await dbAdmin
        .from('support_tickets')
        .update({
          status: 'resolved',
          resolved_by: user.id,
          resolved_at: resolvedAt,
          admin_notes: admin_notes || 'Approved and profile updated by admin.',
          updated_at: resolvedAt,
        })
        .eq('id', id)
        .select('*, requester:users!user_id(id, full_name, email), resolver:users!resolved_by(id, full_name, email)')
        .single();

      if (resErr) {
        return NextResponse.json({ error: resErr.message }, { status: 500 });
      }

      // 4. Notify user
      await dbAdmin.from('notifications').insert({
        user_id: targetUserId,
        type: 'system',
        title: 'Profile Change Request Approved',
        message: `Your profile change request has been approved and applied by ${caller.full_name}.`,
        related_id: id,
      });

      // 5. Invalidate & refresh CDN snapshots
      try {
        generateAndUploadCdnSnapshots().catch(() => {});
        revalidateTag('leaderboard', 'max');
        revalidateTag('global-stats', 'max');
        revalidatePath('/admin/helpdesk');
        revalidatePath('/profile');
        revalidatePath('/admin/users');
        revalidatePath('/dashboard');
        revalidatePath('/contests');
      } catch {}

      return NextResponse.json({ ok: true, ticket: updatedTicket, action: 'approved' });
    } else {
      // Reject action
      const { data: updatedTicket, error: resErr } = await dbAdmin
        .from('support_tickets')
        .update({
          status: 'rejected',
          resolved_by: user.id,
          resolved_at: resolvedAt,
          admin_notes: admin_notes || 'Request declined by administrator.',
          updated_at: resolvedAt,
        })
        .eq('id', id)
        .select('*, requester:users!user_id(id, full_name, email), resolver:users!resolved_by(id, full_name, email)')
        .single();

      if (resErr) {
        return NextResponse.json({ error: resErr.message }, { status: 500 });
      }

      // Notify user
      await dbAdmin.from('notifications').insert({
        user_id: ticket.user_id,
        type: 'system',
        title: 'Profile Change Request Declined',
        message: `Your profile change request was declined by ${caller.full_name}.${admin_notes ? ` Note: "${admin_notes}"` : ''}`,
        related_id: id,
      });

      try {
        revalidatePath('/admin/helpdesk');
        revalidatePath('/profile');
      } catch {}

      return NextResponse.json({ ok: true, ticket: updatedTicket, action: 'rejected' });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error resolving support ticket' }, { status: 500 });
  }
}
