import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { generateSecureTempPassword } from '@/lib/security';

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

    const supabaseAdmin = getAdminClient();

    // Fetch target user's profile to enforce role hierarchy
    const { data: targetUser, error: targetError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, role')
      .eq('id', id)
      .single();

    if (targetError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Role hierarchy check: Managers cannot reset Admin passwords
    if (profile.role !== 'admin' && targetUser.role === 'admin') {
      return NextResponse.json({ error: 'Forbidden: Managers cannot reset Admin passwords' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const customPassword = body.password;

    const tempPassword = (customPassword && typeof customPassword === 'string' && customPassword.trim().length > 0)
      ? customPassword.trim()
      : generateSecureTempPassword();

    // Reset password in Supabase Auth and set must_change_password flag in user_metadata
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      password: tempPassword,
      user_metadata: { must_change_password: true },
    });

    if (authError) {
      console.error(`[reset-password] Auth Error: ${authError.message}`);
      return NextResponse.json({ error: 'Failed to reset password' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      tempPassword,
      full_name: targetUser.full_name || 'User',
      email: targetUser.email || '',
    });
  } catch (error: unknown) {
    console.error('[reset-password] Internal Error:', error);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
