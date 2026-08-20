'use client';

import Link from 'next/link';
import { useSkills } from '@/lib/swr-hooks';

export default function ProfileBadgesWidget() {
  const { data: skillsData, isLoading: loading } = useSkills();

  const badges = [
    ...(skillsData?.topicBadges || []),
    ...(skillsData?.contestBadges || []),
  ];

  const unlocked = badges.filter(b => b.isCompleted);

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem', marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🏆</span> Earned Skills &amp; Badges ({unlocked.length})
        </h3>
        <Link href="/courses" style={{ fontSize: '0.82rem', color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
          View All Skills →
        </Link>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading badges...</div>
      ) : unlocked.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', background: 'var(--surface-2)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
          🎯 No badges unlocked yet. Complete all questions in any topic (e.g. LinkedList) or contest to earn badges automatically!
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {unlocked.map(b => (
            <div
              key={b.id}
              style={{
                background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '12px', padding: '0.5rem 0.85rem', display: 'flex',
                alignItems: 'center', gap: '0.5rem',
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>{b.badgeIcon}</span>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {b.title}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 700 }}>
                  🏆 {b.badgeCategory}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
