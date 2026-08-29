import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function UsersRootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = userData?.role || 'trainer';

  // Admins and managers go to user management table
  if (role === 'admin' || role === 'manager') {
    redirect('/admin/users');
  }

  // Trainers go to their own performance profile
  redirect(`/users/${user.id}`);
}