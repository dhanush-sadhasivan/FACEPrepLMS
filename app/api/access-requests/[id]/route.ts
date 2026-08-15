import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendAccessDecisionEmail } from '@/lib/email';

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin' && profile?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { status } = await request.json();

    const { data: requestRow, error: reqError } = await supabase
      .from('access_requests')
      .update({ status, resolved_by: user.id })
      .eq('id', id)
      .select('*, trainer:users!user_id(id, email, full_name), contest:contests!contest_id(title, id)')
      .single();

    if (reqError) throw reqError;

    // Create notification for trainer
    await supabase.from('notifications').insert({
      user_id: requestRow.user_id,
      type: status === 'approved' ? 'access_approved' : 'access_denied',
      title: `Access Request ${status === 'approved' ? 'Approved' : 'Denied'}`,
      message: `Your access request for "${requestRow.contest?.title}" has been ${status}.`,
      related_id: id,
    });

    // Send email to trainer
    if (requestRow.trainer?.email) {
      await sendAccessDecisionEmail(requestRow.trainer.email, status, requestRow.contest?.title || 'Contest');
    }

    return NextResponse.json(requestRow);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
