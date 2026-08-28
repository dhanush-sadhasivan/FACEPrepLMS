import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { sanitizeField } from '@/lib/utils';
import { formatISODate } from '@/lib/it-calendar';

// GET /api/internal-training/attendance/dispute
// Admin/Manager: returns all IT attendance dispute tickets
// Trainer: returns own IT attendance dispute tickets
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  const isAdminOrManager = profile?.role === 'admin' || profile?.role === 'manager';

  const dbAdmin = getAdminClient();

  try {
    let query = dbAdmin
      .from('it_attendance_disputes')
      .select('*, requester:users!user_id(id, full_name, email, emp_id, team), roadmap:roadmaps!roadmap_id(id, title), resolver:users!resolved_by(id, full_name, email)')
      .order('created_at', { ascending: false });

    if (!isAdminOrManager) {
      query = query.eq('user_id', user.id);
    }

    const { data: disputes, error } = await query;
    if (error) {
      // If the table or foreign key joins are not yet cached or migrated
      console.warn('[GET /api/internal-training/attendance/dispute] Join error, falling back to simple select:', error.message);
      let simpleQuery = dbAdmin
        .from('it_attendance_disputes')
        .select('*')
        .order('created_at', { ascending: false });

      if (!isAdminOrManager) {
        simpleQuery = simpleQuery.eq('user_id', user.id);
      }

      const { data: rawDisputes, error: rawErr } = await simpleQuery;
      if (rawErr) {
        console.error('[GET /api/internal-training/attendance/dispute] Raw query error:', rawErr.message);
        return NextResponse.json([]);
      }

      // Supplement with users and roadmaps manually
      const userIds = Array.from(new Set((rawDisputes || []).map((d: any) => d.user_id).filter(Boolean)));
      const roadmapIds = Array.from(new Set((rawDisputes || []).map((d: any) => d.roadmap_id).filter(Boolean)));
      const resolverIds = Array.from(new Set((rawDisputes || []).map((d: any) => d.resolved_by).filter(Boolean)));

      const [usersRes, roadmapsRes, resolversRes] = await Promise.all([
        userIds.length > 0 ? dbAdmin.from('users').select('id, full_name, email, emp_id, team').in('id', userIds) : { data: [] },
        roadmapIds.length > 0 ? dbAdmin.from('roadmaps').select('id, title').in('id', roadmapIds) : { data: [] },
        resolverIds.length > 0 ? dbAdmin.from('users').select('id, full_name, email').in('id', resolverIds) : { data: [] },
      ]);

      const userMap = new Map((usersRes.data || []).map((u: any) => [u.id, u]));
      const rmMap = new Map((roadmapsRes.data || []).map((r: any) => [r.id, r]));
      const resMap = new Map((resolversRes.data || []).map((r: any) => [r.id, r]));

      const enriched = (rawDisputes || []).map((d: any) => ({
        ...d,
        requester: userMap.get(d.user_id) || null,
        roadmap: rmMap.get(d.roadmap_id) || null,
        resolver: resMap.get(d.resolved_by) || null,
      }));

      return NextResponse.json(enriched);
    }

    return NextResponse.json(disputes || []);
  } catch (err: any) {
    console.error('[GET /api/internal-training/attendance/dispute] Catch error:', err);
    return NextResponse.json([]);
  }
}

// POST /api/internal-training/attendance/dispute
// Trainer submits a dispute when toggling OFF an IT day
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { roadmapId, reason, checkInDate } = body;

    const cleanReason = sanitizeField(reason);
    if (!cleanReason) {
      return NextResponse.json({ error: 'Reason for disputing IT attendance is required.' }, { status: 400 });
    }

    if (!roadmapId) {
      return NextResponse.json({ error: 'roadmapId is required.' }, { status: 400 });
    }

    const today = formatISODate(new Date());
    const effectiveDate = checkInDate || today;
    const dbAdmin = getAdminClient();

    // 1. Fetch user profile and roadmap details
    const [userRes, roadmapRes, progressRes] = await Promise.all([
      dbAdmin.from('users').select('id, full_name, email, emp_id, team').eq('id', user.id).single(),
      dbAdmin.from('roadmaps').select('id, title').eq('id', roadmapId).single(),
      dbAdmin.from('it_trainer_progress').select('*').eq('user_id', user.id).eq('roadmap_id', roadmapId).maybeSingle(),
    ]);

    const userProfile = userRes.data;
    const roadmap = roadmapRes.data;
    const progress = progressRes.data;

    const locationAtCheckIn = progress?.location || null;

    // 2. Insert into it_attendance_disputes
    const { data: dispute, error: insertErr } = await dbAdmin
      .from('it_attendance_disputes')
      .insert({
        user_id: user.id,
        roadmap_id: roadmapId,
        check_in_date: effectiveDate,
        reason: cleanReason,
        location_at_check_in: locationAtCheckIn,
        status: 'pending',
      })
      .select()
      .single();

    if (insertErr) {
      console.error('[POST /api/internal-training/attendance/dispute] Insert error:', insertErr.message);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // 3. Notify all Admins and Managers
    try {
      const { data: managers } = await dbAdmin
        .from('users')
        .select('id')
        .in('role', ['admin', 'manager']);

      if (managers && managers.length > 0) {
        const notifications = managers.map((m: { id: string }) => ({
          user_id: m.id,
          type: 'system' as const,
          title: 'New IT Attendance Dispute ⚠️',
          message: `${userProfile?.full_name || 'A trainer'} submitted an IT attendance dispute for "${roadmap?.title || 'Roadmap'}" (${effectiveDate}): "${cleanReason}"`,
          related_id: dispute.id,
        }));
        await dbAdmin.from('notifications').insert(notifications);
      }
    } catch (notifErr) {
      console.warn('[POST /api/internal-training/attendance/dispute] Notification dispatch error:', notifErr);
    }

    return NextResponse.json({ ok: true, dispute }, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/internal-training/attendance/dispute] Handler error:', err);
    return NextResponse.json({ error: err.message || 'Failed to submit IT attendance dispute' }, { status: 500 });
  }
}
