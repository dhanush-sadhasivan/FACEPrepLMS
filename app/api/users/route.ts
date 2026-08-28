import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { parseHackerrankUsername, sanitizeField } from '@/lib/utils';
import { parseLeetcodeUsername } from '@/lib/leetcode';
import { generateAndUploadCdnSnapshots } from '@/lib/cdn-cache';
import { revalidatePath, revalidateTag } from 'next/cache';
import { Resend } from 'resend';

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
    const { email, emp_email, full_name, emp_id, role, team, manager, hackerrank_id, leetcode_id, password } = body;

    const cleanEmail = sanitizeField(email);
    const cleanEmpEmail = sanitizeField(emp_email);
    const cleanName = sanitizeField(full_name);
    const cleanEmpId = sanitizeField(emp_id);
    const cleanTeam = sanitizeField(team);
    const cleanManager = sanitizeField(manager);
    const cleanHr = parseHackerrankUsername(hackerrank_id);
    const cleanLc = parseLeetcodeUsername(leetcode_id);

    if (!cleanEmail || !cleanName || !cleanEmpId) {
      return NextResponse.json({ error: 'Missing required fields: email, full_name, emp_id' }, { status: 400 });
    }

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
    const { data: newUser, error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        email: cleanEmail,
        emp_email: cleanEmpEmail,
        full_name: cleanName,
        emp_id: cleanEmpId,
        role: (role && ['admin', 'manager', 'trainer'].includes(role.toLowerCase())) ? role.toLowerCase() : 'trainer',
        team: cleanTeam,
        manager: cleanManager,
        hackerrank_id: cleanHr,
        leetcode_id: cleanLc,
      })
      .select()
      .single();

    if (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: dbError.message }, { status: 400 });
    }

    // Refresh CDN snapshots in background
    try {
      generateAndUploadCdnSnapshots().catch(() => {});
      revalidateTag('leaderboard', 'max');
      revalidateTag('global-stats', 'max');
      revalidatePath('/admin/users');
      revalidatePath('/dashboard');
      revalidatePath('/contests');
    } catch {}

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

    return NextResponse.json({ ...newUser, tempPassword: finalPassword }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
