'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Contest, Question, Group } from '@/lib/types';
import './page.css';

interface TopicCategory {
  id: string;
  name: string; // Topic name extracted strictly from hyphen prefix (e.g. "Arrays", "Looping")
  description: string;
  questionIds: string[]; // List of question IDs belonging to this topic category
}

const DOMAINS = ['General', 'DSA', 'System Design', 'Web Dev', 'Python', 'Cloud', 'SQL', 'Java', 'DevOps'];
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

/**
 * Pure Hyphen-Prefix & Topic Specifier Classifier.
 * No hardcoded keyword presets or artificial domain fallbacks.
 *
 * 1. Takes 1st part before '-' in title (e.g. "Arrays - 2D Array" -> Topic: "Arrays")
 * 2. Takes 1st part before '-' in domain / topic specifier if title has no hyphen
 * 3. If no hyphen delimiter found, question is placed in unclassified list to prompt user
 */
function classifyQuestionsByHyphenPrefixOnly(questions: Question[]): {
  prefixTopics: TopicCategory[];
  unclassified: Question[];
} {
  const prefixMap = new Map<string, string[]>();
  const unclassified: Question[] = [];

  questions.forEach(q => {
    const title = q.title || '';
    const domain = q.domain || '';

    let extractedPrefix: string | null = q.topic ? q.topic.trim() : null;

    if (!extractedPrefix) {
      // Check hyphen prefix in question title
      if (title.includes('-')) {
        const part = title.split('-')[0].trim();
        if (part.length > 0) extractedPrefix = part;
      } 
      // Check hyphen prefix in domain / topic specifier if present
      else if (domain.includes('-')) {
        const part = domain.split('-')[0].trim();
        if (part.length > 0) extractedPrefix = part;
      } else if (domain && domain.toLowerCase() !== 'general' && domain.toLowerCase() !== 'dsa') {
        extractedPrefix = domain.trim();
      }
    }

    if (extractedPrefix) {
      // Capitalize topic name cleanly
      const topicName = extractedPrefix.charAt(0).toUpperCase() + extractedPrefix.slice(1);
      if (!prefixMap.has(topicName)) {
        prefixMap.set(topicName, []);
      }
      prefixMap.get(topicName)!.push(q.id);
    } else {
      // Question has no hyphen delimiter or DB topic -> prompt user to classify
      unclassified.push(q);
    }
  });

  const prefixTopics: TopicCategory[] = [];
  let idx = 1;
  for (const [name, qIds] of prefixMap.entries()) {
    prefixTopics.push({
      id: `cat_${Date.now()}_${idx++}`,
      name,
      description: `Questions under ${name}`,
      questionIds: qIds,
    });
  }

  return { prefixTopics, unclassified };
}

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

  // Strictly extracted prefix topics & unclassified questions
  const [detectedPrefixCategories, setDetectedPrefixCategories] = useState<TopicCategory[]>([]);
  const [unclassifiedQuestions, setUnclassifiedQuestions] = useState<Question[]>([]);

  // Active Roadmap Topic Categories
  const [topicCategories, setTopicCategories] = useState<TopicCategory[]>([]);
  const [newTopicName, setNewTopicName] = useState('');

  // Control for classifying unclassified questions into a new topic inline
  const [promptingNewTopicForQId, setPromptingNewTopicForQId] = useState<string | null>(null);
  const [inlineNewTopicName, setInlineNewTopicName] = useState<string>('');

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

  // When a contest is selected, strictly classify questions by hyphen '-' prefix
  useEffect(() => {
    if (!selectedContestId) {
      setRawQuestions([]);
      setDetectedPrefixCategories([]);
      setUnclassifiedQuestions([]);
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

        // Strictly classify questions by hyphen '-' prefix
        const { prefixTopics, unclassified } = classifyQuestionsByHyphenPrefixOnly(loadedQuestions);
        setDetectedPrefixCategories(prefixTopics);
        setUnclassifiedQuestions(unclassified);

        // Keep builder blank initially on load as requested
        setTopicCategories([]);
      } else {
        setErrorMsg('Failed to load contest questions.');
      }
      setLoadingQuestions(false);
    }

    loadContestQuestions();
  }, [selectedContestId]);

  // Toggle/add a detected prefix topic category into the active roadmap
  const toggleDetectedPrefixCategory = (cat: TopicCategory) => {
    const exists = topicCategories.some(c => c.name.toLowerCase() === cat.name.toLowerCase());
    if (exists) {
      setTopicCategories(prev => prev.filter(c => c.name.toLowerCase() !== cat.name.toLowerCase()));
    } else {
      const newCat: TopicCategory = {
        id: `cat_${Date.now()}_${cat.name}`,
        name: cat.name,
        description: cat.description,
        questionIds: [...cat.questionIds],
      };
      setTopicCategories(prev => [...prev, newCat]);
    }
  };

  const handleAddAllDetectedTopics = () => {
    if (detectedPrefixCategories.length === 0) return;
    const merged: TopicCategory[] = detectedPrefixCategories.map(cat => ({
      id: `cat_${Date.now()}_${cat.name}`,
      name: cat.name,
      description: cat.description,
      questionIds: [...cat.questionIds],
    }));
    setTopicCategories(merged);
  };

  const addCustomTopicCategory = () => {
    if (!newTopicName.trim()) return;
    const name = newTopicName.trim();
    const newCat: TopicCategory = {
      id: `cat_${Date.now()}`,
      name,
      description: `Questions under ${name}`,
      questionIds: [],
    };
    setTopicCategories(prev => [...prev, newCat]);
    setNewTopicName('');
  };

  // Classify an unclassified question to an existing or custom topic name
  const assignUnclassifiedQuestionToTopicName = (questionId: string, topicName: string) => {
    const cleanTopicName = topicName.trim();
    if (!cleanTopicName) return;

    setTopicCategories(prev => {
      const existingIndex = prev.findIndex(c => c.name.toLowerCase() === cleanTopicName.toLowerCase());
      if (existingIndex >= 0) {
        // Topic exists in builder — add questionId to it
        return prev.map((c, idx) => {
          if (idx === existingIndex) {
            return {
              ...c,
              questionIds: Array.from(new Set([...c.questionIds, questionId])),
            };
          }
          return c;
        });
      } else {
        // Create new topic and add questionId to it
        const newCat: TopicCategory = {
          id: `cat_${Date.now()}_${cleanTopicName}`,
          name: cleanTopicName,
          description: `Questions under ${cleanTopicName}`,
          questionIds: [questionId],
        };
        return [...prev, newCat];
      }
    });

    // Remove question from unclassified list
    setUnclassifiedQuestions(prev => prev.filter(q => q.id !== questionId));
    setPromptingNewTopicForQId(null);
    setInlineNewTopicName('');
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
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  // List of all topic names available for classifying (detected prefixes + active topics)
  const allAvailableTopicNames = Array.from(
    new Set([
      ...detectedPrefixCategories.map(c => c.name),
      ...topicCategories.map(c => c.name),
    ])
  );

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setErrorMsg('Please enter a roadmap title.'); return; }

    if (topicCategories.length === 0) {
      setErrorMsg('Please click at least one topic chip above (e.g. Arrays, Looping) to add topics.');
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
      let message = 'Failed to create roadmap.';
      try {
        const err = await res.json();
        if (err?.error) message = err.error;
      } catch {
        const text = await res.text().catch(() => '');
        if (text) message = text;
      }
      setErrorMsg(message);
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
            Classifies questions strictly by <strong>hyphen (-) prefix</strong> topic name (e.g. <strong>Arrays - 2D Array</strong> → Topic: <strong>Arrays</strong>)
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
                placeholder="e.g., Arrays, Looping, Decision Making, LinkedList"
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
            {rawQuestions.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Loaded {rawQuestions.length} questions ({detectedPrefixCategories.length} hyphen-prefix topics detected)
                </span>
                <button
                  type="button"
                  onClick={handleAddAllDetectedTopics}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem' }}
                >
                  ⚡ Add All Hyphen Topics
                </button>
              </div>
            )}
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

        {/* Right Column: Topics & Mapped Questions Categorizer */}
        <div className="create-roadmap-right">
          <div className="roadmap-form-section" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h3 className="section-heading">4. Hyphen-Prefix Topics &amp; Questions Mapping</h3>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Click any hyphen-prefix topic chip below to add it to the roadmap. Questions matching that prefix (e.g. <strong>Arrays - ...</strong>) map automatically!
            </p>

            {/* Hyphen Prefix Topic Chips */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>
                Hyphen Prefix Topics (Click to add topic + mapped questions):
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {detectedPrefixCategories.length === 0 ? (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Select a contest with hyphen-delimited titles (e.g. "Arrays - 2D Array" → Topic: "Arrays") to view prefix topics.
                  </span>
                ) : (
                  detectedPrefixCategories.map(cat => {
                    const isAdded = topicCategories.some(c => c.name.toLowerCase() === cat.name.toLowerCase());
                    return (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => toggleDetectedPrefixCategory(cat)}
                        className={`quick-topic-pill ${isAdded ? 'added' : ''}`}
                        style={isAdded ? { background: 'var(--accent-muted)', borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
                      >
                        {isAdded ? '✓ ' : '+ '} {cat.name} <strong style={{ marginLeft: '0.2rem' }}>({cat.questionIds.length} Qs)</strong>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Custom topic input */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                type="text"
                className="input"
                placeholder="Add custom topic (e.g. Dynamic Programming)..."
                value={newTopicName}
                onChange={e => setNewTopicName(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={addCustomTopicCategory}
              >
                + Add Custom Topic
              </button>
            </div>

            {errorMsg && (
              <div className="alert-error" style={{ marginBottom: '1rem' }}>
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Topic Categories List & Unclassified Questions List */}
            {loadingQuestions ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div className="roadmap-spinner" style={{ margin: '0 auto 0.5rem' }} />
                Extracting hyphen (-) title prefixes…
              </div>
            ) : (
              <div className="topic-builder-list">
                {topicCategories.length === 0 && unclassifiedQuestions.length === 0 && (
                  <div className="empty-builder">
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📌</div>
                    <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>No topics added yet</p>
                    <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                      Click topic chips above to add topics and populate mapped questions.
                    </p>
                  </div>
                )}

                {/* Active Roadmap Topics */}
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
                        <span className="topic-cat-count">{catQuestions.length} mapped questions</span>
                        <button
                          type="button"
                          className="topic-cat-del-btn"
                          onClick={() => removeTopicCategory(cat.id)}
                          title="Remove topic"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Mapped questions inside this topic */}
                      <div className="topic-cat-questions-list">
                        {catQuestions.length === 0 ? (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.4rem 0' }}>
                            No questions mapped to this topic. Assign unclassified questions below to this topic.
                          </div>
                        ) : (
                          catQuestions.map(q => (
                            <div key={q.id} className="topic-question-row">
                              <span style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                                📄 {q.title}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{q.difficulty || 'Medium'}</span>
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

                {/* ── Unclassified Questions Section (Questions without '-' Hyphen Prefix) ── */}
                {unclassifiedQuestions.length > 0 && (
                  <div className="topic-cat-box unassigned" style={{ marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--warning)' }}>
                        ❓ Unclassified Questions ({unclassifiedQuestions.length})
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        No '-' prefix in title. Please classify to a topic below:
                      </span>
                    </div>

                    <div className="topic-cat-questions-list" style={{ paddingLeft: 0 }}>
                      {unclassifiedQuestions.map(q => (
                        <div key={q.id} className="topic-question-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.4rem', padding: '0.5rem 0.65rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              📄 {q.title}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{q.difficulty || 'Medium'}</span>
                          </div>

                          {/* Classification Controls */}
                          {promptingNewTopicForQId === q.id ? (
                            <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.2rem' }}>
                              <input
                                type="text"
                                className="input"
                                placeholder="Enter topic name for this question..."
                                value={inlineNewTopicName}
                                onChange={e => setInlineNewTopicName(e.target.value)}
                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', flex: 1 }}
                                autoFocus
                              />
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                                onClick={() => assignUnclassifiedQuestionToTopicName(q.id, inlineNewTopicName)}
                              >
                                Create &amp; Assign
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.72rem', padding: '0.2rem 0.4rem' }}
                                onClick={() => { setPromptingNewTopicForQId(null); setInlineNewTopicName(''); }}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <select
                                value=""
                                onChange={e => {
                                  const val = e.target.value;
                                  if (val === '__CREATE_NEW__') {
                                    setPromptingNewTopicForQId(q.id);
                                    setInlineNewTopicName('');
                                  } else if (val) {
                                    assignUnclassifiedQuestionToTopicName(q.id, val);
                                  }
                                }}
                                className="topic-move-select"
                                style={{ flex: 1 }}
                              >
                                <option value="" disabled>-- Classify this question into a Topic --</option>
                                {allAvailableTopicNames.map(name => (
                                  <option key={name} value={name}>Assign to "{name}"</option>
                                ))}
                                <option value="__CREATE_NEW__">✨ + Create New Topic for this Question...</option>
                              </select>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
