import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
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
  try {
    const { users } = await req.json();
    if (!Array.isArray(users)) {
      return NextResponse.json({ error: 'Expected an array of users' }, { status: 400 });
    }

    const supabaseAdmin = getAdminClient();
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    const createdUsers: Array<{ email: string; full_name: string; tempPassword: string; role: string }> = [];

    for (const user of users) {
      const email = sanitizeField(user.email || user.emp_email);
      const full_name = sanitizeField(user.full_name);
      const emp_id = sanitizeField(user.emp_id);
      const { role, team, manager, hackerrank_id } = user;
      const providedPassword = user.temp_password || user.tempPassword || user.password;

      if (!email || !full_name || !emp_id) {
        skipped++;
        errors.push(`Row missing required fields: emp_id=${user.emp_id}, email=${user.email || user.emp_email}`);
        continue;
      }

      const tempPassword = (providedPassword && typeof providedPassword === 'string' && providedPassword.trim().length > 0)
        ? providedPassword.trim()
        : Math.random().toString(36).slice(-8) + 'A1!';

      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { must_change_password: true },
      });

      if (authError) {
        skipped++;
        errors.push(`Auth Error for ${email}: ${authError.message}`);
        continue;
      }

      const userId = authUser.user.id;

      const { error: dbError } = await supabaseAdmin.from('users').insert({
        id: userId,
        email,
        full_name,
        emp_id,
        role: (role && role.trim()) ? role.trim().toLowerCase() : 'trainer',
        team: sanitizeField(team),
        manager: sanitizeField(manager),
        hackerrank_id: sanitizeField(hackerrank_id),
      });

      if (dbError) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        skipped++;
        errors.push(`DB Error for ${email}: ${dbError.message}`);
        continue;
      }

      created++;
      createdUsers.push({ email, full_name, tempPassword, role: role || 'trainer' });

      // Send invite email
      if (process.env.RESEND_API_KEY) {
        try {
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: 'FACEPrep LMS Admin <noreply@yourdomain.com>',
            to: email,
            subject: 'Welcome to FACEPrep LMS',
            html: `<p>Hello ${full_name},</p><p>Your account has been created. Temporary password: <strong>${tempPassword}</strong></p><p>Please login and change your password on first sign in.</p>`,
          });
        } catch {
          // Email failure should not block user creation
        }
      }
    }

    return NextResponse.json({ created, skipped, errors, createdUsers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
