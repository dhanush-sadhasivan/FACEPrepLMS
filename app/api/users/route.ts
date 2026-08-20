import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { Resend } from 'resend';

function sanitizeField(val?: string | null): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (['nil', 'null', 'n/a', 'undefined', 'none', '-'].includes(trimmed.toLowerCase())) {
    return null;
  }
  return trimmed;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: caller } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (caller?.role !== 'admin' && caller?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { email, full_name, emp_id, role, team, manager, hackerrank_id, password } = body;

    if (!email || !full_name || !emp_id) {
      return NextResponse.json({ error: 'Missing required fields: email, full_name, emp_id' }, { status: 400 });
    }

    const cleanEmail = email.trim();
    const cleanName = full_name.trim();
    const cleanEmpId = emp_id.trim();

    const supabaseAdmin = getAdminClient();
    const finalPassword = (password && password.trim().length > 0)
      ? password.trim()
      : Math.random().toString(36).slice(-8) + 'A1!';

    // 1. Create auth user with must_change_password flag
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: finalPassword,
      email_confirm: true,
      user_metadata: { must_change_password: true },
    });

    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

    const userId = authUser.user.id;

    // 2. Insert into public.users with sanitized fields
    const { data: user, error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        email: cleanEmail,
        full_name: cleanName,
        emp_id: cleanEmpId,
        role: role || 'trainer',
        team: sanitizeField(team),
        manager: sanitizeField(manager),
        hackerrank_id: sanitizeField(hackerrank_id),
      })
      .select()
      .single();

    if (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: dbError.message }, { status: 400 });
    }

    // 3. Send invite email via Resend if key exists
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: 'FACEPrep LMS Admin <noreply@yourdomain.com>',
          to: cleanEmail,
          subject: 'Welcome to FACEPrep LMS',
          html: `<p>Hello ${cleanName},</p><p>Your account has been created. Your temporary password is: <strong>${finalPassword}</strong></p><p>Please login and update your password on first sign in.</p>`,
        });
      } catch (emailErr) {
        console.error('Failed to send email:', emailErr);
      }
    }

    return NextResponse.json({ ...user, tempPassword: finalPassword }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
