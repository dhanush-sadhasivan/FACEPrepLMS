import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendAccessRequestEmail } from '@/lib/email';


export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { contestId, message } = await request.json();

    const { data: requestRow, error: reqError } = await supabase
      .from('access_requests')
      .insert({
        contest_id: contestId,
        user_id: user.id,
        message,
        status: 'pending'
      })
      .select()
      .single();

    if (reqError) throw reqError;

    // Get user details and contest details
    const { data: trainer } = await supabase.from('users').select('full_name').eq('id', user.id).single();
    const { data: contest } = await supabase.from('contests').select('title').eq('id', contestId).single();

    // Get all admin/managers
    const { data: managers } = await supabase.from('users').select('id, email').in('role', ['admin', 'manager']);

    if (managers && managers.length > 0) {
      const managerEmails = managers.map((m: { email: string }) => m.email);
      const managerIds = managers.map((m: { id: string }) => m.id);

      // Create notifications
      const notifications = managerIds.map((notifUserId: string) => ({
        user_id: notifUserId,
        type: 'access_request' as const,
        title: 'Access Extension Request',
        message: `${trainer?.full_name} requested access to ${contest?.title}`,
        related_id: requestRow.id,
      }));
      await supabase.from('notifications').insert(notifications);

      // Send email
      await sendAccessRequestEmail(managerEmails, trainer?.full_name || 'Trainer', contest?.title || 'Contest', requestRow.id);
    }

    return NextResponse.json(requestRow);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

