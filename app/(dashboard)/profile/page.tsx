import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileForm from './ProfileForm'
import './profile.css'

import ProfileBadgesWidget from './ProfileBadgesWidget'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return <div className="profile-error">Failed to load profile.</div>
  }

  return (
    <div className="profile-page-container">
      <header className="profile-header">
        <h1>My Profile</h1>
        <p>Manage your account settings and preferences.</p>
      </header>
      
      <div className="profile-content">
        <div className="profile-readonly-info">
          <h3>Account Details</h3>
          <ul>
            <li><strong>Employee ID:</strong> {profile.emp_id}</li>
            <li><strong>Role:</strong> <span className="role-badge">{profile.role}</span></li>
            <li><strong>Team:</strong> {profile.team || 'Not assigned'}</li>
            <li><strong>Manager:</strong> {profile.manager || 'Not assigned'}</li>
          </ul>
        </div>

        <div className="profile-edit-section">
          <h3>Edit Profile</h3>
          <ProfileForm initialData={profile} />
        </div>
      </div>

      {/* Earned Skills & Badges Section */}
      <ProfileBadgesWidget />
    </div>
  )
}
