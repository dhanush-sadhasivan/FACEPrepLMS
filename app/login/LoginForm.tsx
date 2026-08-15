'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Force Password Change state
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const isInactiveLogout = searchParams.get('reason') === 'inactivity';
  const supabase = createClient();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Check if user is required to update temporary password
    const user = data.user;
    if (user?.user_metadata?.must_change_password) {
      setMustChangePassword(true);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError(null);

    // Update password in Supabase Auth and clear must_change_password flag
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword.trim(),
      data: { must_change_password: false },
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setPasswordSuccess(true);
    setLoading(false);

    setTimeout(() => {
      router.push('/dashboard');
      router.refresh();
    }, 1200);
  };

  // Render Force Password Change View
  if (mustChangePassword) {
    return (
      <form onSubmit={handleUpdatePassword} className="login-form">
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔐</div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>Update Temporary Password</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.35rem' }}>
            You logged in using a temporary password. Please set a new permanent password for your account.
          </p>
        </div>

        {error && <div className="error-message">{error}</div>}
        {passwordSuccess && (
          <div style={{ background: 'rgba(34,197,94,0.15)', color: '#2ecc71', padding: '0.75rem 1rem', borderRadius: 8, fontSize: '0.9rem', marginBottom: '1rem', textAlign: 'center' }}>
            ✅ Password updated successfully! Redirecting to dashboard…
          </div>
        )}

        <div className="input-group">
          <label htmlFor="newPassword">New Password *</label>
          <input
            id="newPassword"
            type={showPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password (min 6 characters)"
            required
            disabled={loading || passwordSuccess}
          />
        </div>

        <div className="input-group">
          <label htmlFor="confirmPassword">Confirm New Password *</label>
          <input
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            required
            disabled={loading || passwordSuccess}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.8rem', cursor: 'pointer', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <input type="checkbox" checked={showPassword} onChange={e => setShowPassword(e.target.checked)} />
            Show passwords
          </label>
        </div>

        <button type="submit" className="submit-btn" disabled={loading || passwordSuccess}>
          {loading ? <span className="spinner"></span> : 'Set New Password &amp; Continue →'}
        </button>
      </form>
    );
  }

  // Render Standard Login View
  return (
    <form onSubmit={handleSignIn} className="login-form">
      {isInactiveLogout && !error && (
        <div style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid var(--warning)', borderRadius: 8, padding: '0.75rem 1rem', color: 'var(--warning)', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>⏳</span>
          <span>You were automatically logged out after 10 minutes of inactivity.</span>
        </div>
      )}
      {error && <div className="error-message">{error}</div>}

      <div className="input-group">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
          disabled={loading}
        />
      </div>

      <div className="input-group">
        <label htmlFor="password">Password</label>
        <div className="password-input-wrapper">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password or temp password"
            required
            disabled={loading}
          />
          <button
            type="button"
            className="toggle-password"
            onClick={() => setShowPassword(!showPassword)}
            disabled={loading}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <button type="submit" className="submit-btn" disabled={loading}>
        {loading ? <span className="spinner"></span> : 'Sign In'}
      </button>
    </form>
  );
}
