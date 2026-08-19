import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

// GET /api/notifications/announcements
// Fetches teams, groups, and trainers for the Announcement targeting selector
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userData?.role !== 'admin' && userData?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const dbAdmin = getAdminClient();

  const [usersRes, groupsRes] = await Promise.all([
    dbAdmin.from('users').select('id, full_name, emp_id, email, team, role').order('full_name', { ascending: true }),
    dbAdmin.from('groups').select('id, name').order('name', { ascending: true }),
  ]);

  const allUsers = usersRes.data || [];
  const groups = groupsRes.data || [];

  // Extract distinct teams
  const teamSet = new Set<string>();
  allUsers.forEach((u: any) => {
    if (u.team && u.team.trim()) teamSet.add(u.team.trim());
  });
  const teams = Array.from(teamSet).sort();

  return NextResponse.json({
    teams,
    groups,
    users: allUsers,
  });
}

// POST /api/notifications/announcements
// Broadcasts or targets an announcement to teams, groups, or individual trainers
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  if (userData?.role !== 'admin' && userData?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const {
    title,
    message,
    targetType, // 'all' | 'team' | 'group' | 'individual'
    targetTeams,
    targetGroupIds,
    targetUserIds,
  } = body;

  if (!title || !title.trim()) {
    return NextResponse.json({ error: 'Announcement title is required' }, { status: 400 });
  }

  if (!message || !message.trim()) {
    return NextResponse.json({ error: 'Announcement message body is required' }, { status: 400 });
  }

  const dbAdmin = getAdminClient();
  const recipientUserIds = new Set<string>();

  if (targetType === 'all') {
    // Send to all users in the system
    const { data: users } = await dbAdmin.from('users').select('id');
    (users || []).forEach((u: any) => recipientUserIds.add(u.id));
  } else if (targetType === 'team') {
    if (!targetTeams || !Array.isArray(targetTeams) || targetTeams.length === 0) {
      return NextResponse.json({ error: 'Please select at least one target team' }, { status: 400 });
    }
    const cleanTargetTeams = targetTeams.map((t: string) => t.trim().toLowerCase());
    const { data: users } = await dbAdmin.from('users').select('id, team');
    (users || []).forEach((u: any) => {
      if (u.team && cleanTargetTeams.includes(u.team.trim().toLowerCase())) {
        recipientUserIds.add(u.id);
      }
    });
  } else if (targetType === 'group') {
    if (!targetGroupIds || !Array.isArray(targetGroupIds) || targetGroupIds.length === 0) {
      return NextResponse.json({ error: 'Please select at least one target group' }, { status: 400 });
    }
    const { data: members } = await dbAdmin
      .from('group_members')
      .select('user_id')
      .in('group_id', targetGroupIds);
    (members || []).forEach((m: any) => recipientUserIds.add(m.user_id));
  } else if (targetType === 'individual') {
    if (!targetUserIds || !Array.isArray(targetUserIds) || targetUserIds.length === 0) {
      return NextResponse.json({ error: 'Please select at least one trainer' }, { status: 400 });
    }
    targetUserIds.forEach((uid: string) => recipientUserIds.add(uid));
  } else {
    return NextResponse.json({ error: 'Invalid targetType' }, { status: 400 });
  }

  const recipientList = Array.from(recipientUserIds);
  if (recipientList.length === 0) {
    return NextResponse.json({ error: 'No recipients found for the selected target criteria' }, { status: 400 });
  }

  const formattedTitle = title.trim().startsWith('📢') ? title.trim() : `📢 ${title.trim()}`;

  let notificationsToInsert = recipientList.map((uid) => ({
    user_id: uid,
    type: 'announcement' as const,
    title: formattedTitle,
    message: message.trim(),
    related_id: user.id,
    is_read: false,
  }));

  let { error: insertError } = await dbAdmin
    .from('notifications')
    .insert(notificationsToInsert);

  // If database enum does not yet have 'announcement' value, fallback gracefully to 'system'
  if (insertError && insertError.message && (insertError.message.includes('notification_type') || insertError.message.includes('invalid input value for enum'))) {
    notificationsToInsert = recipientList.map((uid) => ({
      user_id: uid,
      type: 'system' as any,
      title: formattedTitle,
      message: message.trim(),
      related_id: user.id,
      is_read: false,
    }));

    const retryRes = await dbAdmin
      .from('notifications')
      .insert(notificationsToInsert);
    insertError = retryRes.error;
  }

  if (insertError) {
    console.error('Error inserting announcement notifications:', insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    recipientCount: recipientList.length,
    title: formattedTitle,
  });
}
