import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { parseHackerrankUsername, sanitizeField } from '@/lib/utils';
import { parseLeetcodeUsername } from '@/lib/leetcode';
import { generateAndUploadCdnSnapshots } from '@/lib/cdn-cache';
import { generateSecureTempPassword } from '@/lib/security';
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
    const { users } = await req.json();
    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ error: 'Expected a non-empty array of users' }, { status: 400 });
    }
    if (users.length > 500) {
      return NextResponse.json({ error: 'Payload exceeds maximum limit of 500 users per bulk import request' }, { status: 400 });
    }

    const supabaseAdmin = getAdminClient();
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    const createdUsers: Array<{ email: string; full_name: string; tempPassword: string; role: string }> = [];

    for (const user of users) {
      const email = sanitizeField(user.email || user.emp_email);
      const emp_email = sanitizeField(user.emp_email);
      const full_name = sanitizeField(user.full_name || user.name);
      const emp_id = sanitizeField(user.emp_id || user.empid);
      const { role, team, manager } = user;
      const hackerrank_id = parseHackerrankUsername(user.hackerrank_id || user.hackerrank || user.hr_id);
      const leetcode_id = parseLeetcodeUsername(user.leetcode_id || user.leetcode || user.lc_id);
      const providedPassword = user.temp_password || user.tempPassword || user.password;

      if (!email || !full_name || !emp_id) {
        skipped++;
        errors.push(`Row missing required fields: emp_id=${user.emp_id || user.empid || 'unknown'}, email=${user.email || user.emp_email || 'unknown'}`);
        continue;
      }

      // Role escalation protection: Only Admins can assign/create Admin accounts
      let assignedRole: 'admin' | 'manager' | 'trainer' = 'trainer';
      if (role && ['admin', 'manager', 'trainer'].includes(role.trim().toLowerCase())) {
        const requestedRole = role.trim().toLowerCase() as 'admin' | 'manager' | 'trainer';
        if (requestedRole === 'admin' && caller.role !== 'admin') {
          skipped++;
          errors.push(`Row with emp_id=${emp_id}: Only Admins can create Admin accounts`);
          continue;
        }
        assignedRole = requestedRole;
      }

      const tempPassword = (providedPassword && typeof providedPassword === 'string' && providedPassword.trim().length > 0)
        ? providedPassword.trim()
        : generateSecureTempPassword();

      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { must_change_password: true },
      });

      if (authError) {
        console.error(`[users-bulk] Auth Error for ${email}:`, authError.message);
        skipped++;
        errors.push(`Auth Error for ${email}: Failed to create user authentication record`);
        continue;
      }

      const userId = authUser.user.id;

      const { error: dbError } = await supabaseAdmin.from('users').insert({
        id: userId,
        email,
        emp_email,
        full_name,
        emp_id,
        role: assignedRole,
        team: sanitizeField(team),
        manager: sanitizeField(manager),
        hackerrank_id,
        leetcode_id,
      });

      if (dbError) {
        console.error(`[users-bulk] DB Error for ${email}:`, dbError.message);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        skipped++;
        errors.push(`DB Error for ${email}: Failed to create user profile`);
        continue;
      }

      created++;
      createdUsers.push({ email, full_name, tempPassword, role: assignedRole });

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

    if (created > 0) {
      try {
        generateAndUploadCdnSnapshots().catch(() => {});
        revalidateTag('leaderboard', 'max');
        revalidateTag('global-stats', 'max');
        revalidatePath('/admin/users');
        revalidatePath('/dashboard');
        revalidatePath('/contests');
      } catch {}
    }

    return NextResponse.json({ created, skipped, errors, createdUsers });
  } catch (error: unknown) {
    console.error('[users-bulk] Internal error:', error);
    return NextResponse.json({ error: 'Failed to process bulk user import' }, { status: 500 });
  }
}
