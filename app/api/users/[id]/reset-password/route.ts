import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

type Params = Promise<{ id: string }>;

export async function POST(req: Request, { params }: { params: Params }) {
  const { id } = await params;
  try {
    const supabase = await createServerClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('users').select('role').eq('id', currentUser.id).single();
    if (profile?.role !== 'admin' && profile?.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const customPassword = body.password;

    const tempPassword = (customPassword && typeof customPassword === 'string' && customPassword.trim().length > 0)
      ? customPassword.trim()
      : Math.random().toString(36).slice(-8) + 'A1!';

    const supabaseAdmin = getAdminClient();

    // Reset password in Supabase Auth and set must_change_password flag in user_metadata
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      password: tempPassword,
      user_metadata: { must_change_password: true },
    });

    if (authError) {
      console.error(`[reset-password] Auth Error: ${authError.message}`);
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // Fetch user details for confirmation UI
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('full_name, email')
      .eq('id', id)
      .single();

    return NextResponse.json({
      success: true,
      tempPassword,
      full_name: userProfile?.full_name || 'User',
      email: userProfile?.email || '',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
