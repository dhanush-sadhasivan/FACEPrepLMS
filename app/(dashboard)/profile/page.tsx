import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ProfileForm from './ProfileForm';
import ProfileBadgesWidget from './ProfileBadgesWidget';
import './page.css';

function getInitials(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

function renderRoleBadge(role?: string) {
  const r = role?.toLowerCase() || 'trainer';
  if (r === 'admin') return <span className="role-badge admin">👑 Admin</span>;
  if (r === 'manager') return <span className="role-badge manager">🛡️ Manager</span>;
  return <span className="role-badge trainer">🎓 Trainer</span>;
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return <div className="profile-error">Failed to load user profile.</div>;
  }

  return (
    <div className="profile-page-container">
      {/* Hero Header Card */}
      <div className="profile-hero-card">
        <div className="profile-cover-banner" />
        <div className="profile-hero-body">
          <div className="profile-hero-avatar-row">
            <div className="profile-hero-avatar">
              {getInitials(profile.full_name)}
            </div>
          </div>

          <div className="profile-hero-text">
            <h1 className="profile-hero-name">{profile.full_name || 'User Profile'}</h1>
            <div className="profile-hero-meta">
              {renderRoleBadge(profile.role)}
              <span className="profile-meta-pill emp">ID: {profile.emp_id || 'N/A'}</span>
              <span className="profile-meta-pill">🏢 {profile.team || 'Unassigned Team'}</span>
              {profile.manager && <span className="profile-meta-pill">👤 Manager: {profile.manager}</span>}
              {profile.hackerrank_id && <span className="profile-meta-pill hackerrank">⚡ {profile.hackerrank_id}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Account Settings Card */}
      <div className="profile-settings-card">
        <div className="profile-section-header">
          <span>⚙️ Account Preferences & Settings</span>
        </div>
        <ProfileForm initialData={profile} />
      </div>

      {/* Earned Skills & Badges Section */}
      <ProfileBadgesWidget />
    </div>
  );
}
