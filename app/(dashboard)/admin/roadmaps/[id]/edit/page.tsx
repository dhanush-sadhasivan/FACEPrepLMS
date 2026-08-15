'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Contest, Question, Group } from '@/lib/types';
import '../../new/page.css';

interface TopicCategory {
  id: string;
  name: string;
  description: string;
  questionIds: string[];
}

const DEFAULT_TOPIC_NAMES = [
  'Looping & Basics',
  'Arrays 1D',
  'Arrays 2D & Matrices',
  'LinkedList',
  'Stacks & Queues',
  'Binary Trees',
  'Binary Search Trees',
  'Graphs & Searching',
];

const DOMAINS = ['General', 'DSA', 'System Design', 'Web Dev', 'Python', 'Cloud', 'SQL', 'Java', 'DevOps'];
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

export default function EditRoadmapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  // Form basic fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [domain, setDomain] = useState('DSA');
  const [level, setLevel] = useState('Intermediate');
  const [estimatedHours, setEstimatedHours] = useState(30);

  // Contests & Groups lists for selectors
  const [contests, setContests] = useState<Contest[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedContestId, setSelectedContestId] = useState<string>('');

  // Loaded questions from contest & roadmap
  const [rawQuestions, setRawQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  // Topic Categories (e.g. Looping, Arrays 1D, LinkedList)
  const [topicCategories, setTopicCategories] = useState<TopicCategory[]>([]);
  const [newTopicName, setNewTopicName] = useState('');

  // Target assignment selection
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch roadmap details, contests, and groups on mount
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [roadmapRes, contestsRes, groupsRes] = await Promise.all([
          fetch(`/api/admin/roadmaps/${id}`),
          fetch('/api/contests'),
          fetch('/api/groups'),
        ]);

        if (contestsRes.ok) setContests(await contestsRes.json());
        if (groupsRes.ok) setGroups(await groupsRes.json());

        if (roadmapRes.ok) {
          const rm = await roadmapRes.json();
          setTitle(rm.title || '');
          setDescription(rm.description || '');
          setDomain(rm.domain || 'DSA');
          setLevel(rm.level || 'Intermediate');
          setEstimatedHours(rm.estimated_hours || 30);
          setSelectedContestId(rm.contest_id || '');
          setSelectedGroupIds(rm.target_group_ids || []);

          // Parse topics from existing roadmap
          const topics = rm.topics || [];
          const categories: TopicCategory[] = [];
          const allQuestions: Question[] = [];

          topics.forEach((t: any, idx: number) => {
            const qList = t.questions || [];
            const qIds: string[] = [];

            qList.forEach((q: any) => {
              qIds.push(q.id);
              allQuestions.push({
                id: q.id,
                title: q.title,
                slug: q.slug || q.id,
                contest_id: rm.contest_id || '',
                domain: rm.domain || 'DSA',
                difficulty: q.difficulty || 'Medium',
                max_score: q.max_score || 10,
                hackerrank_url: q.hackerrank_url || '',
                order_index: q.order_index || 1,
              });
            });

            categories.push({
              id: t.id || `cat_${idx + 1}`,
              name: t.title,
              description: t.description || `Module ${idx + 1}: ${t.title}`,
              questionIds: qIds,
            });
          });

          setTopicCategories(categories);
          setRawQuestions(allQuestions);

          // If contest is linked, load extra contest questions if available
          if (rm.contest_id) {
            const cRes = await fetch(`/api/admin/roadmaps/contests/${rm.contest_id}/questions`);
            if (cRes.ok) {
              const cData = await cRes.json();
              const contestQuestions: Question[] = cData.questions || [];
              // Merge questions ensuring no duplicates
              const mergedMap = new Map<string, Question>();
              allQuestions.forEach(q => mergedMap.set(q.id, q));
              contestQuestions.forEach(q => mergedMap.set(q.id, q));
              setRawQuestions(Array.from(mergedMap.values()));
            }
          }
        } else {
          setErrorMsg('Failed to load roadmap details.');
        }
      } catch (err: any) {
        setErrorMsg('Error loading roadmap data.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  const addTopicCategory = () => {
    if (!newTopicName.trim()) return;
    const newCat: TopicCategory = {
      id: `cat_${Date.now()}`,
      name: newTopicName.trim(),
      description: `Questions under ${newTopicName.trim()}`,
      questionIds: [],
    };
    setTopicCategories(prev => [...prev, newCat]);
    setNewTopicName('');
  };

  const removeTopicCategory = (catId: string) => {
    setTopicCategories(prev => prev.filter(c => c.id !== catId));
  };

  const moveQuestionToCategory = (questionId: string, targetCatId: string) => {
    setTopicCategories(prev => prev.map(c => {
      const cleanIds = c.questionIds.filter(qid => qid !== questionId);
      if (c.id === targetCatId) {
        return { ...c, questionIds: [...cleanIds, questionId] };
      }
      return { ...c, questionIds: cleanIds };
    }));
  };

  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroupIds(prev =>
      prev.includes(groupId) ? prev.filter(gid => gid !== groupId) : [...prev, groupId]
    );
  };

  // Submit Edit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setErrorMsg('Please enter a roadmap title.'); return; }

    if (topicCategories.length === 0) {
      setErrorMsg('Please add at least one topic category.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    const formattedTopics = topicCategories.map((cat, idx) => {
      const catQuestions = rawQuestions
        .filter(q => cat.questionIds.includes(q.id))
        .map((q, qIdx) => ({
          id: q.id,
          title: q.title,
          question_id: q.id,
          hackerrank_url: q.hackerrank_url,
          difficulty: q.difficulty || 'Medium',
          max_score: q.max_score || 10,
          order_index: qIdx + 1,
        }));

      return {
        id: cat.id,
        title: cat.name,
        description: cat.description || `Module ${idx + 1}: ${cat.name}`,
        order_index: idx + 1,
        questions: catQuestions,
        milestone: idx === topicCategories.length - 1,
      };
    });

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      domain,
      level,
      estimated_hours: Number(estimatedHours),
      topics: formattedTopics,
      contest_id: selectedContestId || null,
      target_group_ids: selectedGroupIds,
    };

    const res = await fetch(`/api/admin/roadmaps/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      router.push('/admin/roadmaps');
      router.refresh();
    } else {
      const err = await res.json();
      setErrorMsg(err.error || 'Failed to update roadmap.');
      setSubmitting(false);
    }
  };

  // Delete Roadmap Handler
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this roadmap? This action cannot be undone.')) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/roadmaps/${id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/admin/roadmaps');
      router.refresh();
    } else {
      alert('Failed to delete roadmap.');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div className="roadmap-spinner" style={{ margin: '0 auto 0.5rem' }} />
        Loading roadmap details…
      </div>
    );
  }

  return (
    <div className="create-roadmap-page">
      {/* Header */}
      <header className="create-roadmap-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
            <Link href="/admin/roadmaps" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem' }}>
              ← Back to Roadmaps
            </Link>
          </div>
          <h1 className="create-roadmap-title">Edit Topic Roadmap</h1>
          <p className="create-roadmap-subtitle">
            Update roadmap structure, domain, topics, and target group assignments
          </p>
        </div>
        <button type="button" className="btn btn-error" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Deleting…' : '🗑️ Delete Roadmap'}
        </button>
      </header>

      <form onSubmit={handleSubmit} className="create-roadmap-layout">
        {/* Left Column: Form & Contest Selector */}
        <div className="create-roadmap-left">
          <div className="roadmap-form-section">
            <h3 className="section-heading">1. Basic Information</h3>

            <div className="form-group mb-3">
              <label className="label">Roadmap Title *</label>
              <input
                type="text"
                className="input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group mb-3">
              <label className="label">Description / Syllabus</label>
              <textarea
                className="input"
                rows={2}
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="label">Domain</label>
                <select value={domain} onChange={e => setDomain(e.target.value)} className="input">
                  {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="label">Level</label>
                <select value={level} onChange={e => setLevel(e.target.value)} className="input">
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="label">Est. Hours</label>
                <input
                  type="number"
                  className="input"
                  min={1}
                  max={500}
                  value={estimatedHours}
                  onChange={e => setEstimatedHours(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="roadmap-form-section">
            <h3 className="section-heading">2. Associated Contest</h3>
            <div className="form-group mb-3">
              <select
                value={selectedContestId}
                onChange={e => setSelectedContestId(e.target.value)}
                className="input"
              >
                <option value="">-- Select Contest --</option>
                {contests.map(c => (
                  <option key={c.id} value={c.id}>
                    🏆 {c.title} ({new Date(c.start_date).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="roadmap-form-section">
            <h3 className="section-heading">3. Target Group Assignments</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {groups.length === 0 ? (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No groups available.</span>
              ) : (
                groups.map(g => {
                  const isSelected = selectedGroupIds.includes(g.id);
                  return (
                    <button
                      type="button"
                      key={g.id}
                      onClick={() => toggleGroupSelection(g.id)}
                      className={`group-chip ${isSelected ? 'selected' : ''}`}
                    >
                      {isSelected ? '✓ ' : '+ '} {g.name}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Topics & Questions Categorizer */}
        <div className="create-roadmap-right">
          <div className="roadmap-form-section" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h3 className="section-heading">4. Edit Topics &amp; Questions</h3>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Trainers see these topics in order (e.g. <strong>LinkedList, Arrays 1D</strong>).
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                type="text"
                className="input"
                placeholder="Add topic (e.g. Arrays 1D, LinkedList)..."
                value={newTopicName}
                onChange={e => setNewTopicName(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={addTopicCategory}
              >
                + Add Topic
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {DEFAULT_TOPIC_NAMES.map(name => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    if (!topicCategories.some(c => c.name === name)) {
                      setTopicCategories(prev => [...prev, { id: `cat_${Date.now()}_${name}`, name, description: `${name} exercises`, questionIds: [] }]);
                    }
                  }}
                  className="quick-topic-pill"
                >
                  + {name}
                </button>
              ))}
            </div>

            {errorMsg && (
              <div className="alert-error" style={{ marginBottom: '1rem' }}>
                ⚠️ {errorMsg}
              </div>
            )}

            <div className="topic-builder-list">
              {topicCategories.map((cat, catIdx) => {
                const catQuestions = rawQuestions.filter(q => cat.questionIds.includes(q.id));

                return (
                  <div key={cat.id} className="topic-cat-box">
                    <div className="topic-cat-header">
                      <span className="topic-cat-seq">{catIdx + 1}</span>
                      <input
                        type="text"
                        value={cat.name}
                        onChange={e => {
                          const val = e.target.value;
                          setTopicCategories(prev => prev.map(c => c.id === cat.id ? { ...c, name: val } : c));
                        }}
                        className="topic-cat-name-input"
                      />
                      <span className="topic-cat-count">{catQuestions.length} questions</span>
                      <button
                        type="button"
                        className="topic-cat-del-btn"
                        onClick={() => removeTopicCategory(cat.id)}
                        title="Remove topic"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="topic-cat-questions-list">
                      {catQuestions.length === 0 ? (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.4rem 0' }}>
                          No questions assigned to this topic.
                        </div>
                      ) : (
                        catQuestions.map(q => (
                          <div key={q.id} className="topic-question-row">
                            <span style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                              📄 {q.title}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{q.difficulty}</span>
                            <select
                              value={cat.id}
                              onChange={e => moveQuestionToCategory(q.id, e.target.value)}
                              className="topic-move-select"
                            >
                              {topicCategories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Unassigned Questions */}
              {(() => {
                const assignedQIds = new Set(topicCategories.flatMap(c => c.questionIds));
                const unassigned = rawQuestions.filter(q => !assignedQIds.has(q.id));
                if (unassigned.length === 0) return null;

                return (
                  <div className="topic-cat-box unassigned">
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--warning)', marginBottom: '0.5rem' }}>
                      ⚠️ Unassigned Questions ({unassigned.length})
                    </div>
                    {unassigned.map(q => (
                      <div key={q.id} className="topic-question-row">
                        <span style={{ fontSize: '0.83rem', color: 'var(--text-primary)', flex: 1 }}>📄 {q.title}</span>
                        <select
                          value=""
                          onChange={e => moveQuestionToCategory(q.id, e.target.value)}
                          className="topic-move-select"
                        >
                          <option value="" disabled>-- Assign to Topic --</option>
                          {topicCategories.map(c => (
                            <option key={c.id} value={c.id}>Move to {c.name}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <Link href="/admin/roadmaps" className="btn btn-secondary">Cancel</Link>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || topicCategories.length === 0}
              >
                {submitting ? 'Saving…' : '💾 Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
