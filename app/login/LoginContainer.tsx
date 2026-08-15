'use client';

import { ThemeToggle } from '@/components/ThemeProvider';
import LoginForm from './LoginForm';

export default function LoginContainer() {
  return (
    <div className="login-page">
      {/* Top Right Dark / Light Mode Toggle */}
      <div style={{ position: 'absolute', top: 20, right: 24, zIndex: 90 }}>
        <ThemeToggle showLabel={true} />
      </div>

      <div className="login-container">
        <div className="login-header">
          {/* Official FACEPrep Logo Image */}
          <div style={{
            background: '#ffffff', padding: '8px 16px', borderRadius: '12px',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '1.25rem', boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
            border: '1px solid rgba(0,0,0,0.06)'
          }}>
            <img
              src="/faceprep-logo.png"
              alt="FACEPrep Logo"
              style={{ height: '38px', width: 'auto', objectFit: 'contain' }}
            />
          </div>

          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 0.35rem 0' }}>
            Learning Management System
          </h1>
          <p>Sign in to your FACEPrep LMS account</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
