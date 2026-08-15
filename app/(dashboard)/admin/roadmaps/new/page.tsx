'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Contest, Question, Group } from '@/lib/types';
import './page.css';

interface TopicCategory {
  id: string;
  name: string; // e.g. "Looping", "Arrays 1D", "Arrays 2D", "LinkedList", "Stacks & Queues"
  description: string;
  questionIds: string[]; // List of question IDs belonging to this topic category
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

export default function CreateRoadmapPage() {
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

  // Loaded questions from contest
  const [rawQuestions, setRawQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Topic Categories (e.g. Looping, Arrays 1D, LinkedList)
  const [topicCategories, setTopicCategories] = useState<TopicCategory[]>([]);
  const [newTopicName, setNewTopicName] = useState('');

  // Target assignment selection
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [inheritContestAssignments, setInheritContestAssignments] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch available contests and groups on mount
  useEffect(() => {
    async function loadData() {
      const [contestsRes, groupsRes] = await Promise.all([
        fetch('/api/contests'),
        fetch('/api/groups'),
      ]);
      if (contestsRes.ok) setContests(await contestsRes.json());
      if (groupsRes.ok) setGroups(await groupsRes.json());
    }
    loadData();
  }, []);

  // When a contest is selected, auto-load questions and group into Conceptual Topics
  useEffect(() => {
    if (!selectedContestId) {
      setRawQuestions([]);
      setTopicCategories([]);
      return;
    }

    async function loadContestQuestions() {
      setLoadingQuestions(true);
      setErrorMsg('');
      const res = await fetch(`/api/admin/roadmaps/contests/${selectedContestId}/questions`);
      if (res.ok) {
        const data = await res.json();
        const loadedQuestions: Question[] = data.questions || [];
        setRawQuestions(loadedQuestions);

        if (data.contest && !title) {
          setTitle(`${data.contest.title} Roadmap`);
        }

        // Auto-inherit assigned groups if option checked
        if (inheritContestAssignments && data.assignments) {
          const groupIds: string[] = data.assignments
            .map((a: { group_id: string }) => a.group_id)
            .filter((gid: string | undefined): gid is string => Boolean(gid));
          setSelectedGroupIds(Array.from(new Set(groupIds)));
        }

        // Divide loaded questions into default conceptual topics (e.g. LinkedList, Stacks, etc.)
        const chunkSize = Math.max(1, Math.ceil(loadedQuestions.length / 4));
        const initialCategories: TopicCategory[] = [];

        const defaultNames = ['LinkedList', 'Stacks & Queues', 'Trees & BST', 'Graphs & Advanced'];
        for (let i = 0; i < defaultNames.length; i++) {
          const slice = loadedQuestions.slice(i * chunkSize, (i + 1) * chunkSize);
          if (slice.length > 0 || i === 0) {
            initialCategories.push({
              id: `cat_${i + 1}`,
              name: defaultNames[i],
              description: `Module ${i + 1} topics and questions`,
              questionIds: slice.map(q => q.id),
            });
          }
        }
        setTopicCategories(initialCategories);
      } else {
        setErrorMsg('Failed to load contest questions.');
      }
      setLoadingQuestions(false);
    }

    loadContestQuestions();
  }, [selectedContestId, inheritContestAssignments]);

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
      // Remove question from other categories
      const cleanIds = c.questionIds.filter(qid => qid !== questionId);
      // Add to target category
      if (c.id === targetCatId) {
        return { ...c, questionIds: [...cleanIds, questionId] };
      }
      return { ...c, questionIds: cleanIds };
    }));
  };

  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroupIds(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setErrorMsg('Please enter a roadmap title.'); return; }

    if (topicCategories.length === 0) {
      setErrorMsg('Please add at least one topic module (e.g., LinkedList, Arrays 1D).');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    // Format topics array with nested questions for full hierarchy
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

    const res = await fetch('/api/admin/roadmaps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      router.push('/admin/roadmaps');
      router.refresh();
    } else {
      const err = await res.json();
      setErrorMsg(err.error || 'Failed to create roadmap.');
      setSubmitting(false);
    }
  };

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
          <h1 className="create-roadmap-title">Create Topic Roadmap</h1>
          <p className="create-roadmap-subtitle">
            Organize contest questions into conceptual topics (e.g., Looping, Arrays 1D, LinkedList) with question-level completion tracking
          </p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="create-roadmap-layout">
        {/* Left Column: Form & Contest Selector */}
        <div className="create-roadmap-left">
          {/* Step 1: Basic Info */}
          <div className="roadmap-form-section">
            <h3 className="section-heading">1. Basic Information</h3>

            <div className="form-group mb-3">
              <label className="label">Roadmap Title *</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., DSA 5-Day Plan"
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
                placeholder="e.g., LL-ST-QU-BT-BST-GP"
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

          {/* Step 2: Contest Selection */}
          <div className="roadmap-form-section">
            <h3 className="section-heading">2. Select Contest (Import Scraped Questions)</h3>
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

          {/* Step 3: Target Groups */}
          <div className="roadmap-form-section">
            <h3 className="section-heading">3. Target Group Assignments</h3>

            {selectedContestId && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', marginBottom: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={inheritContestAssignments}
                  onChange={e => setInheritContestAssignments(e.target.checked)}
                />
                Auto-inherit groups assigned to the contest
              </label>
            )}

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
            <h3 className="section-heading">4. Organize Conceptual Topics &amp; Questions</h3>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Trainers will see these topics (e.g., <strong>LinkedList, Arrays 1D</strong>). Clicking a topic reveals its questions.
            </p>

            {/* Quick add custom topic category */}
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

            {/* Quick suggestion pills */}
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

            {/* Topic Categories List */}
            {loadingQuestions ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div className="roadmap-spinner" style={{ margin: '0 auto 0.5rem' }} />
                Loading questions…
              </div>
            ) : topicCategories.length === 0 ? (
              <div className="empty-builder">
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📌</div>
                <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>No topics created yet</p>
                <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                  Add topics like <strong>Looping, Arrays 1D, LinkedList</strong> above to organize questions.
                </p>
              </div>
            ) : (
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

                      {/* Questions inside this topic */}
                      <div className="topic-cat-questions-list">
                        {catQuestions.length === 0 ? (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.4rem 0' }}>
                            No questions assigned to this topic. Move questions below.
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
            )}

            {/* Submit */}
            <div style={{ marginTop: 'auto', paddingTop: '1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <Link href="/admin/roadmaps" className="btn btn-secondary">Cancel</Link>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || topicCategories.length === 0}
              >
                {submitting ? 'Publishing…' : '🚀 Publish Topic Roadmap'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
