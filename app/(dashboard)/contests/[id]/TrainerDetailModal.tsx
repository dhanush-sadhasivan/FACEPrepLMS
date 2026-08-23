'use client';

export default function TrainerDetailModal({ trainer, questions, onClose }: any) {
  // Group questions by domain and map progress
  const domainMap = new Map();
  questions.forEach((q: any) => {
    const domainName = q.domain || 'General';
    if (!domainMap.has(domainName)) {
      domainMap.set(domainName, []);
    }
    const p = (trainer.progress || []).find((p: any) => p.question_id === q.id);
    const score = p?.score || 0;
    const maxScore = q.max_score || p?.max_score || 10;
    const isSolved = (p?.status === 'solved' || score >= maxScore) && score >= maxScore && maxScore > 0;
    const isAttempted = !isSolved && (p?.status === 'attempted' || score > 0);
    const status = isSolved ? 'solved' : isAttempted ? 'attempted' : 'unattempted';

    domainMap.get(domainName).push({
      ...q,
      status,
      score,
      max_score: maxScore,
      lastActive: p?.last_submission_at
    });
  });

  const domains = Array.from(domainMap.keys());

  const getStatusIcon = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'solved' || s === 'accepted' || s === 'passed') return '✅';
    if (s === 'attempted' || s === 'partial' || s === 'failed') return '⏳';
    return '○';
  };

  const getStatusBadgeClass = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'solved' || s === 'accepted' || s === 'passed') return 'badge-success';
    if (s === 'attempted' || s === 'partial' || s === 'failed') return 'badge-warning';
    return 'badge-muted';
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 100 }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.5rem', maxWidth: 640, width: '90%', maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{trainer.name}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Emp ID: <code>{trainer.emp_id}</code> &bull; Team: {trainer.team} &bull; Score: <strong style={{ color: 'var(--accent)' }}>{trainer.score} pts</strong> ({trainer.solved}/{trainer.total} solved)
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ fontSize: '1.25rem' }}>&times;</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {domains.map(domain => {
            const qs = domainMap.get(domain);
            return (
              <details key={domain} open style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem 1rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>📂 {domain}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{qs.filter((q: any) => q.status === 'solved').length}/{qs.length} solved</span>
                </summary>
                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {qs.map((q: any) => (
                    <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.88rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontSize: '1.1rem' }}>{getStatusIcon(q.status)}</span>
                        <div>
                          <div style={{ fontWeight: 500 }}>{q.title}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {q.difficulty || 'Medium'} &bull; {q.lastActive ? new Date(q.lastActive).toLocaleString() : 'No submissions'}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className={`badge ${getStatusBadgeClass(q.status)}`} style={{ marginBottom: '0.2rem' }}>
                          {q.status.toUpperCase()}
                        </span>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{q.score}/{q.max_score || 10} pts</div>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </div>
  );
}
