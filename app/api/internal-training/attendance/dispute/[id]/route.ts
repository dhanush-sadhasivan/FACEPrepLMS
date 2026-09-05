import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

type Params = Promise<{ id: string }>;

// PATCH /api/internal-training/attendance/dispute/[id]
// Admin/Manager resolves an IT attendance dispute
export async function PATCH(req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: caller } = await supabase.from('users').select('id, full_name, role').eq('id', user.id).single();
  if (caller?.role !== 'admin' && caller?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden: Only Admins and Managers can review IT attendance disputes.' }, { status: 403 });
  }

  const dbAdmin = getAdminClient();

  try {
    const body = await req.json();
    const { action, admin_notes } = body; // action: 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Action must be "approve" or "reject"' }, { status: 400 });
    }

    // 1. Fetch the dispute ticket
    const { data: dispute, error: disputeErr } = await dbAdmin
      .from('it_attendance_disputes')
      .select('*, requester:users!user_id(id, full_name, email, emp_id, team), roadmap:roadmaps!roadmap_id(id, title)')
      .eq('id', id)
      .single();

    if (disputeErr || !dispute) {
      return NextResponse.json({ error: 'IT Attendance dispute ticket not found' }, { status: 404 });
    }

    const resolvedAt = new Date().toISOString();
    const targetUserId = dispute.user_id;
    const roadmapId = dispute.roadmap_id;

    if (action === 'approve') {
      // 2. Decrement IT days on the per-roadmap progress row
      const { data: progress } = await dbAdmin
        .from('it_trainer_progress')
        .select('*')
        .eq('user_id', targetUserId)
        .eq('roadmap_id', roadmapId)
        .maybeSingle();

      if (progress) {
        const currentDaysLogged = progress.it_days_logged || 0;
        const newDaysLogged = Math.max(0, currentDaysLogged - 1);
        const shouldClearCheckInDate =
          progress.last_check_in_date === dispute.check_in_date ||
          Boolean(progress.last_check_in_date && dispute.check_in_date && progress.last_check_in_date.slice(0, 10) === dispute.check_in_date.slice(0, 10));

        await dbAdmin
          .from('it_trainer_progress')
          .update({
            it_days_logged: newDaysLogged,
            current_day: newDaysLogged,
            last_check_in_date: shouldClearCheckInDate ? null : progress.last_check_in_date,
            updated_at: resolvedAt,
          })
          .eq('user_id', targetUserId)
          .eq('roadmap_id', roadmapId);
      }

      // 3. Adjust global users.it_days_count if applicable
      const { data: userProfile } = await dbAdmin
        .from('users')
        .select('it_days_count, last_it_check_date')
        .eq('id', targetUserId)
        .single();

      const isUserCheckInMatching =
        userProfile &&
        (userProfile.last_it_check_date === dispute.check_in_date ||
          Boolean(userProfile.last_it_check_date && dispute.check_in_date && userProfile.last_it_check_date.slice(0, 10) === dispute.check_in_date.slice(0, 10)));

      if (isUserCheckInMatching) {
        const { data: allUserItProgress } = await dbAdmin
          .from('it_trainer_progress')
          .select('it_days_logged')
          .eq('user_id', targetUserId);

        const maxRoadmapDays = Math.max(
          ...((allUserItProgress || []).map((p: any) => p.it_days_logged || 0)),
          0
        );

        const newGlobalCount = Math.max(0, maxRoadmapDays);
        await dbAdmin
          .from('users')
          .update({
            it_days_count: newGlobalCount,
            last_it_check_date: null,
          })
          .eq('id', targetUserId);

        try {
          const { data: authUserData } = await dbAdmin.auth.admin.getUserById(targetUserId);
          const metadata = authUserData?.user?.user_metadata || {};
          await dbAdmin.auth.admin.updateUserById(targetUserId, {
            user_metadata: {
              ...metadata,
              it_days_count: newGlobalCount,
              last_it_check_date: null,
            },
          });
        } catch (authErr) {
          console.warn('[attendance/dispute/resolve] Auth metadata update failed:', authErr);
        }
      }

      // 4. Mark dispute resolved with audit info
      const { data: updatedDispute, error: updateErr } = await dbAdmin
        .from('it_attendance_disputes')
        .update({
          status: 'resolved',
          resolved_by: user.id,
          resolved_at: resolvedAt,
          admin_notes: admin_notes || 'Approved: Not counted as an IT day.',
          updated_at: resolvedAt,
        })
        .eq('id', id)
        .select('*, requester:users!user_id(id, full_name, email, emp_id, team), roadmap:roadmaps!roadmap_id(id, title), resolver:users!resolved_by(id, full_name, email)')
        .single();

      if (updateErr) {
        console.error('[attendance/dispute/resolve] Error updating dispute status:', updateErr);
        return NextResponse.json({ error: 'Failed to update dispute status' }, { status: 500 });
      }

      // 5. Notify trainer
      try {
        await dbAdmin.from('notifications').insert({
          user_id: targetUserId,
          type: 'system',
          title: 'IT Attendance Dispute Approved ✅',
          message: `Your IT attendance dispute for "${dispute.roadmap?.title || 'Training'}" (${dispute.check_in_date}) was approved by ${caller.full_name}. The IT day count has been adjusted.`,
          related_id: id,
        });
      } catch (notifErr) {
        console.warn('[attendance/dispute/resolve] Notification error:', notifErr);
      }

      try {
        revalidatePath('/internal-training');
        revalidatePath('/admin/helpdesk');
      } catch {}

      return NextResponse.json({ ok: true, dispute: updatedDispute, action: 'approved' });
    } else {
      // Reject action
      const { data: updatedDispute, error: updateErr } = await dbAdmin
        .from('it_attendance_disputes')
        .update({
          status: 'rejected',
          resolved_by: user.id,
          resolved_at: resolvedAt,
          admin_notes: admin_notes || 'Dispute declined by administrator.',
          updated_at: resolvedAt,
        })
        .eq('id', id)
        .select('*, requester:users!user_id(id, full_name, email, emp_id, team), roadmap:roadmaps!roadmap_id(id, title), resolver:users!resolved_by(id, full_name, email)')
        .single();

      if (updateErr) {
        console.error('[attendance/dispute/resolve] Error updating dispute status:', updateErr);
        return NextResponse.json({ error: 'Failed to update dispute status' }, { status: 500 });
      }

      // Notify trainer
      try {
        await dbAdmin.from('notifications').insert({
          user_id: targetUserId,
          type: 'system',
          title: 'IT Attendance Dispute Declined ❌',
          message: `Your IT attendance dispute for "${dispute.roadmap?.title || 'Training'}" (${dispute.check_in_date}) was declined by ${caller.full_name}.${admin_notes ? ` Note: "${admin_notes}"` : ''}`,
          related_id: id,
        });
      } catch (notifErr) {
        console.warn('[attendance/dispute/resolve] Notification error:', notifErr);
      }

      try {
        revalidatePath('/internal-training');
        revalidatePath('/admin/helpdesk');
      } catch {}

      return NextResponse.json({ ok: true, dispute: updatedDispute, action: 'rejected' });
    }
  } catch (err: any) {
    console.error('[PATCH /api/internal-training/attendance/dispute/[id]] Catch error:', err);
    return NextResponse.json({ error: 'Error resolving IT dispute' }, { status: 500 });
  }
}
