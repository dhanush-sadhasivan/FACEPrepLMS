import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LoginContainer from './LoginContainer'
import './page.css'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return <LoginContainer />
}
