import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardLayoutClient from './DashboardLayoutClient';
import './layout.css';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  const role = userData?.role || 'trainer';
  const currentUser = {
    id: user.id,
    full_name: userData?.full_name || user.user_metadata?.full_name || 'User',
    role: role,
  };

  return (
    <DashboardLayoutClient role={role} currentUser={currentUser}>
      {children}
    </DashboardLayoutClient>
  );
}
