'use client';

import { useState, useEffect, useMemo } from 'react';
import { ITDayPlan, ITDayQuestion, ITRoadmapConfig } from '@/lib/types';
import { Pagination } from '@/components/Pagination';
import './DayPlanTab.css';

interface DayPlanTabProps {
  roadmapId: string;
  roadmapTitle: string;
}

const ALL_WEEKDAYS = [
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
  { id: 7, label: 'Sun' },
];

export default function DayPlanTab({ roadmapId, roadmapTitle }: DayPlanTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Config State
  const [config, setConfig] = useState<ITRoadmapConfig>({
    id: '',
    roadmap_id: roadmapId,
    start_date_mode: 'first_login',
    working_days: [1, 2, 3, 4, 5],
    default_extension_days: 3,
  });

  // Day Plans State
  const [dayPlans, setDayPlans] = useState<ITDayPlan[]>([]);

  // Picker & Modals State
  const [availableQuestions, setAvailableQuestions] = useState<any[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [pickerDayIndex, setPickerDayIndex] = useState<number | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerDomain, setPickerDomain] = useState('All');
  const [pickerPage, setPickerPage] = useState(1);
  const [pickerPageSize, setPickerPageSize] = useState(10);

  // Reset pickerPage whenever filter, search, day index, or page size changes
  useEffect(() => {
    setPickerPage(1);
  }, [pickerSearch, pickerDomain, pickerDayIndex, pickerPageSize]);

  const [customModalDayIndex, setCustomModalDayIndex] = useState<number | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customUrl, setCustomUrl] = useState('');

  // 1. Load Day Plan & Config
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/internal-training/day-plan/${roadmapId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.config) {
            setConfig(data.config);
          }
          if (data.dayPlans && data.dayPlans.length > 0) {
            setDayPlans(data.dayPlans);
          } else {
            // Provide an initial Day 1 template if empty
            setDayPlans([
              {
                id: `temp_${Date.now()}_1`,
                roadmap_id: roadmapId,
                day_number: 1,
                topic_title: 'Day 1: Orientation & Basics',
                description: 'Introduction to topics and baseline problems.',
                resources: [],
                questions: [],
              },
            ]);
          }
        }
      } catch (err) {
        console.error('Failed to load day plan data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [roadmapId]);

  // 2. Load Questions for Picker
  const loadAvailableQuestions = async () => {
    if (availableQuestions.length > 0) return;
    setLoadingQuestions(true);
    try {
      const res = await fetch('/api/admin/questions');
      if (res.ok) {
        const data = await res.json();
        setAvailableQuestions(data.questions || []);
      }
    } catch (err) {
      console.error('Failed to load questions pool:', err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Weekdays Toggle
  const toggleWeekday = (dayId: number) => {
    const current = config.working_days || [1, 2, 3, 4, 5];
    let next: number[];
    if (current.includes(dayId)) {
      if (current.length === 1) return; // keep at least 1 working day
      next = current.filter((d) => d !== dayId);
    } else {
      next = [...current, dayId].sort((a, b) => a - b);
    }
    setConfig({ ...config, working_days: next });
  };

  // Day Management
  const handleAddDay = () => {
    const nextNum = dayPlans.length + 1;
    const newDay: ITDayPlan = {
      id: `temp_${Date.now()}_${nextNum}`,
      roadmap_id: roadmapId,
      day_number: nextNum,
      topic_title: `Day ${nextNum} Topic`,
      description: '',
      resources: [],
      questions: [],
    };
    setDayPlans([...dayPlans, newDay]);
  };

  const handleDeleteDay = (idx: number) => {
    if (dayPlans.length <= 1) {
      showToast('⚠️ A roadmap plan must have at least one day.');
      return;
    }
    const filtered = dayPlans.filter((_, i) => i !== idx);
    // Renumber days
    const renumbered = filtered.map((dp, i) => ({
      ...dp,
      day_number: i + 1,
    }));
    setDayPlans(renumbered);
  };

  const handleMoveDay = (idx: number, direction: 'up' | 'down') => {
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === dayPlans.length - 1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const nextPlans = [...dayPlans];
    const temp = nextPlans[idx];
    nextPlans[idx] = nextPlans[targetIdx];
    nextPlans[targetIdx] = temp;

    const renumbered = nextPlans.map((dp, i) => ({
      ...dp,
      day_number: i + 1,
    }));
    setDayPlans(renumbered);
  };

  const handleDayFieldChange = (idx: number, field: keyof ITDayPlan, val: any) => {
    const nextPlans = [...dayPlans];
    nextPlans[idx] = { ...nextPlans[idx], [field]: val };
    setDayPlans(nextPlans);
  };

  // Resources
  const handleAddResource = (dayIdx: number) => {
    const nextPlans = [...dayPlans];
    const currRes = nextPlans[dayIdx].resources || [];
    nextPlans[dayIdx].resources = [...currRes, { title: 'Documentation / Notes', url: 'https://' }];
    setDayPlans(nextPlans);
  };

  const handleResourceChange = (dayIdx: number, resIdx: number, field: 'title' | 'url', val: string) => {
    const nextPlans = [...dayPlans];
    const currRes = [...(nextPlans[dayIdx].resources || [])];
    currRes[resIdx] = { ...currRes[resIdx], [field]: val };
    nextPlans[dayIdx].resources = currRes;
    setDayPlans(nextPlans);
  };

  const handleRemoveResource = (dayIdx: number, resIdx: number) => {
    const nextPlans = [...dayPlans];
    nextPlans[dayIdx].resources = (nextPlans[dayIdx].resources || []).filter((_, i) => i !== resIdx);
    setDayPlans(nextPlans);
  };

  // Questions inside Day
  const handleOpenHRPicker = (dayIdx: number) => {
    setPickerDayIndex(dayIdx);
    loadAvailableQuestions();
  };

  const handleSelectHRQuestion = (q: any) => {
    if (pickerDayIndex === null) return;
    const nextPlans = [...dayPlans];
    const targetDay = nextPlans[pickerDayIndex];
    const currentQs = targetDay.questions || [];

    // Avoid duplicate question in same day
    if (currentQs.some((item) => item.question_id === q.id || item.url === q.hackerrank_url)) {
      showToast('⚠️ This question is already in this day plan.');
      return;
    }

    const newQ: ITDayQuestion = {
      id: `temp_q_${Date.now()}_${currentQs.length + 1}`,
      day_plan_id: targetDay.id,
      question_type: 'hackerrank',
      question_id: q.id,
      title: q.title,
      description: `Domain: ${q.domain} | Difficulty: ${q.difficulty}`,
      url: q.hackerrank_url,
      order_index: currentQs.length,
      difficulty: q.difficulty,
      max_score: q.max_score,
    };

    targetDay.questions = [...currentQs, newQ];
    setDayPlans(nextPlans);
    setPickerDayIndex(null);
    showToast(`✅ Added "${q.title}" to Day ${targetDay.day_number}`);
  };

  const handleOpenCustomModal = (dayIdx: number) => {
    setCustomModalDayIndex(dayIdx);
    setCustomTitle('');
    setCustomDesc('');
    setCustomUrl('');
  };

  const handleAddCustomQuestion = () => {
    if (customModalDayIndex === null) return;
    if (!customTitle.trim() || !customUrl.trim()) {
      showToast('⚠️ Title and URL/Link are required.');
      return;
    }

    const nextPlans = [...dayPlans];
    const targetDay = nextPlans[customModalDayIndex];
    const currentQs = targetDay.questions || [];

    const newQ: ITDayQuestion = {
      id: `temp_cq_${Date.now()}_${currentQs.length + 1}`,
      day_plan_id: targetDay.id,
      question_type: 'custom',
      question_id: null,
      title: customTitle.trim(),
      description: customDesc.trim() || null,
      url: customUrl.trim(),
      order_index: currentQs.length,
      difficulty: 'Custom',
      max_score: 10,
    };

    targetDay.questions = [...currentQs, newQ];
    setDayPlans(nextPlans);
    setCustomModalDayIndex(null);
    showToast(`✅ Added custom question "${customTitle}"`);
  };

  const handleRemoveQuestion = (dayIdx: number, qIdx: number) => {
    const nextPlans = [...dayPlans];
    const targetDay = nextPlans[dayIdx];
    targetDay.questions = (targetDay.questions || []).filter((_, i) => i !== qIdx);
    setDayPlans(nextPlans);
  };

  const handleMoveQuestion = (dayIdx: number, qIdx: number, dir: 'up' | 'down') => {
    const nextPlans = [...dayPlans];
    const targetDay = nextPlans[dayIdx];
    const qs = [...(targetDay.questions || [])];

    if (dir === 'up' && qIdx === 0) return;
    if (dir === 'down' && qIdx === qs.length - 1) return;

    const target = dir === 'up' ? qIdx - 1 : qIdx + 1;
    const temp = qs[qIdx];
    qs[qIdx] = qs[target];
    qs[target] = temp;

    targetDay.questions = qs.map((q, i) => ({ ...q, order_index: i }));
    setDayPlans(nextPlans);
  };

  // 3. Save Day Plan
  const handleSaveDayPlan = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/internal-training/day-plan/${roadmapId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          dayPlans,
        }),
      });

      if (res.ok) {
        showToast('🎉 Day Plan successfully saved and published to trainers!');
      } else {
        const err = await res.json();
        showToast(`❌ Failed to save: ${err.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      showToast(`❌ Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Filtered Questions in Modal
  const domainsList = useMemo(() => {
    const set = new Set<string>();
    availableQuestions.forEach((q) => {
      if (q.domain) set.add(q.domain);
    });
    return Array.from(set);
  }, [availableQuestions]);

  const filteredPickerQuestions = useMemo(() => {
    const searchLower = (pickerSearch || '').toLowerCase().trim();
    return availableQuestions.filter((q) => {
      const titleLower = (q.title || '').toLowerCase();
      const contestLower = (q.contest_title || '').toLowerCase();
      const domainLower = (q.domain || '').toLowerCase();
      const matchesSearch =
        !searchLower ||
        titleLower.includes(searchLower) ||
        contestLower.includes(searchLower) ||
        domainLower.includes(searchLower);
      const matchesDomain = pickerDomain === 'All' || q.domain === pickerDomain;
      return matchesSearch && matchesDomain;
    });
  }, [availableQuestions, pickerSearch, pickerDomain]);

  const paginatedPickerQuestions = useMemo(() => {
    const start = (pickerPage - 1) * pickerPageSize;
    return filteredPickerQuestions.slice(start, start + pickerPageSize);
  }, [filteredPickerQuestions, pickerPage, pickerPageSize]);

  if (loading) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div className="roadmap-spinner" style={{ margin: '0 auto 0.75rem' }} />
        Loading day plan configuration…
      </div>
    );
  }

  return (
    <div className="day-plan-tab">
      {/* Floating Toast */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 999999,
            background: 'var(--surface-3, #1f2937)',
            color: 'var(--text-primary, #fff)',
            padding: '0.85rem 1.35rem',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '0.9rem',
            border: '1px solid var(--border)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Header Info & Action */}
      <div className="day-plan-header-card">
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            📅 Internal Training Day-wise Plan
          </h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: '0.3rem 0 0 0' }}>
            Configure daily training modules, HackerRank coding challenges, custom exercises, and working schedule for{' '}
            <strong>{roadmapTitle}</strong>.
          </p>
        </div>

        <button
          onClick={handleSaveDayPlan}
          disabled={saving}
          className="btn btn-primary"
          style={{ minWidth: 160, fontWeight: 800 }}
        >
          {saving ? '⏳ Saving Plan…' : '💾 Save & Publish Plan'}
        </button>
      </div>

      {/* Schedule Configuration Card */}
      <div className="day-plan-config-box">
        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          ⚙️ Plan Schedule &amp; Working Days Rules
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {/* Working Days Selector */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
              TRAINING WORKING DAYS (SELECT ALL THAT APPLY):
            </label>
            <div className="working-days-picker">
              {ALL_WEEKDAYS.map((day) => {
                const isActive = (config.working_days || []).includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    className={`weekday-btn ${isActive ? 'active' : ''}`}
                    onClick={() => toggleWeekday(day.id)}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
              Day 1 starts on the trainer&apos;s first login. Unchecked days (e.g. Weekends) are automatically skipped.
            </span>
          </div>

          {/* Extension Settings */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
              DEFAULT EXTENSION DURATION (DAYS):
            </label>
            <input
              type="number"
              min="1"
              max="30"
              className="day-input"
              value={config.default_extension_days ?? 3}
              onChange={(e) => setConfig({ ...config, default_extension_days: parseInt(e.target.value) || 1 })}
              style={{ maxWidth: 180 }}
            />
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
              Auto-granted to lagging trainers when their scheduled plan duration concludes with incomplete problems.
            </span>
          </div>
        </div>
      </div>

      {/* Day Cards List */}
      <div className="days-container">
        {dayPlans.map((dp, dayIdx) => (
          <div key={dp.id || dayIdx} className="day-card">
            {/* Header */}
            <div className="day-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="day-pill-badge">
                  <span>🗓️</span> Day {dp.day_number}
                </span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {dp.questions?.length || 0} {(dp.questions?.length || 0) === 1 ? 'Question' : 'Questions'}
                </span>
              </div>

              <div className="day-card-actions">
                <button
                  type="button"
                  className="icon-btn-subtle"
                  disabled={dayIdx === 0}
                  onClick={() => handleMoveDay(dayIdx, 'up')}
                  title="Move Day Up"
                >
                  ⬆️
                </button>
                <button
                  type="button"
                  className="icon-btn-subtle"
                  disabled={dayIdx === dayPlans.length - 1}
                  onClick={() => handleMoveDay(dayIdx, 'down')}
                  title="Move Day Down"
                >
                  ⬇️
                </button>
                <button
                  type="button"
                  className="icon-btn-subtle delete"
                  onClick={() => handleDeleteDay(dayIdx)}
                  title="Delete Day"
                >
                  🗑️ Delete Day
                </button>
              </div>
            </div>

            {/* Topic Title */}
            <div className="day-field-group">
              <label>Topic Title *</label>
              <input
                type="text"
                className="day-input"
                placeholder="e.g. Arrays — Two Pointer Technique & Matrix Search"
                value={dp.topic_title}
                onChange={(e) => handleDayFieldChange(dayIdx, 'topic_title', e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="day-field-group">
              <label>Topic Overview &amp; Learning Goals</label>
              <textarea
                className="day-input"
                placeholder="Detailed instructions, theory summary, and guidance for this IT day..."
                value={dp.description || ''}
                onChange={(e) => handleDayFieldChange(dayIdx, 'description', e.target.value)}
              />
            </div>

            {/* Resources List */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  STUDY RESOURCES &amp; REFERENCE LINKS (OPTIONAL)
                </label>
                <button
                  type="button"
                  onClick={() => handleAddResource(dayIdx)}
                  style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  ➕ Add Resource
                </button>
              </div>

              {(dp.resources || []).map((res, rIdx) => (
                <div key={rIdx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="day-input"
                    placeholder="Resource Label (e.g. Slide Deck)"
                    value={res.title}
                    onChange={(e) => handleResourceChange(dayIdx, rIdx, 'title', e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="url"
                    className="day-input"
                    placeholder="https://..."
                    value={res.url}
                    onChange={(e) => handleResourceChange(dayIdx, rIdx, 'url', e.target.value)}
                    style={{ flex: 2 }}
                  />
                  <button
                    type="button"
                    className="icon-btn-subtle delete"
                    onClick={() => handleRemoveResource(dayIdx, rIdx)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Questions Section */}
            <div className="day-questions-box">
              <div className="day-questions-header">
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    🎯 Practice Questions for Day {dp.day_number}
                  </h4>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Trainers must launch these questions from the LMS to record their IT attendance.
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenHRPicker(dayIdx)}
                    style={{ fontSize: '0.78rem', fontWeight: 700 }}
                  >
                    🏆 Add HackerRank Challenge
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenCustomModal(dayIdx)}
                    style={{ fontSize: '0.78rem', fontWeight: 700 }}
                  >
                    ✏️ Add Custom Link / Task
                  </button>
                </div>
              </div>

              {/* Questions List */}
              {(!dp.questions || dp.questions.length === 0) ? (
                <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', background: 'var(--surface)', borderRadius: '10px', border: '1px dashed var(--border)' }}>
                  No questions added for this day yet. Click &quot;Add HackerRank Challenge&quot; or &quot;Add Custom Link&quot; above.
                </div>
              ) : (
                dp.questions.map((q, qIdx) => (
                  <div key={q.id || qIdx} className="day-question-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: 0 }}>
                      <span className={`question-type-chip ${q.question_type}`}>
                        {q.question_type === 'hackerrank' ? '🏆 HackerRank' : '✏️ Custom'}
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {q.title}
                        </div>
                        {q.description && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {q.description}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                      <button
                        type="button"
                        className="icon-btn-subtle"
                        disabled={qIdx === 0}
                        onClick={() => handleMoveQuestion(dayIdx, qIdx, 'up')}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        className="icon-btn-subtle"
                        disabled={qIdx === (dp.questions?.length || 1) - 1}
                        onClick={() => handleMoveQuestion(dayIdx, qIdx, 'down')}
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        className="icon-btn-subtle delete"
                        onClick={() => handleRemoveQuestion(dayIdx, qIdx)}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Day Button */}
      <button
        type="button"
        onClick={handleAddDay}
        className="btn btn-secondary"
        style={{ padding: '1rem', borderStyle: 'dashed', borderWidth: '2px', fontWeight: 800, fontSize: '0.95rem' }}
      >
        ➕ Add Day {dayPlans.length + 1}
      </button>

      {/* Footer Save Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
        <button
          onClick={handleSaveDayPlan}
          disabled={saving}
          className="btn btn-primary"
          style={{ minWidth: 200, padding: '0.85rem 1.5rem', fontWeight: 800, fontSize: '1rem' }}
        >
          {saving ? '⏳ Saving Plan…' : '💾 Save & Publish Day Plan'}
        </button>
      </div>

      {/* HackerRank Question Picker Modal */}
      {pickerDayIndex !== null && (
        <div className="plan-modal-overlay" onClick={() => setPickerDayIndex(null)}>
          <div className="plan-modal" onClick={(e) => e.stopPropagation()}>
            <div className="plan-modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                🏆 Select HackerRank Challenge for Day {dayPlans[pickerDayIndex]?.day_number}
              </h3>
              <button
                type="button"
                className="icon-btn-subtle"
                onClick={() => setPickerDayIndex(null)}
              >
                ✕
              </button>
            </div>

            <div className="plan-modal-body">
              {/* Filter controls */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input
                  type="text"
                  className="day-input"
                  placeholder="Search challenges by title or contest..."
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  style={{ flex: 2 }}
                />
                <select
                  className="day-input"
                  value={pickerDomain}
                  onChange={(e) => setPickerDomain(e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="All">All Domains</option>
                  {domainsList.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {loadingQuestions ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading questions pool…
                </div>
              ) : filteredPickerQuestions.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No challenges found matching filters.
                </div>
              ) : (
                <>
                  {paginatedPickerQuestions.map((q) => (
                    <div
                      key={q.id}
                      className="question-picker-row"
                      onClick={() => handleSelectHRQuestion(q)}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {q.title}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          🏆 {q.contest_title} &bull; 🏷️ {q.domain} &bull; 📊 {q.difficulty}
                        </div>
                      </div>
                      <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '0.78rem' }}>
                        Select ➕
                      </button>
                    </div>
                  ))}

                  <div style={{ marginTop: '1rem' }}>
                    <Pagination
                      currentPage={pickerPage}
                      totalItems={filteredPickerQuestions.length}
                      pageSize={pickerPageSize}
                      onPageChange={setPickerPage}
                      onPageSizeChange={(newSize) => {
                        setPickerPageSize(newSize);
                        setPickerPage(1);
                      }}
                      pageSizeOptions={[10, 20, 50]}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="plan-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPickerDayIndex(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Question Modal */}
      {customModalDayIndex !== null && (
        <div className="plan-modal-overlay" onClick={() => setCustomModalDayIndex(null)}>
          <div className="plan-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="plan-modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                ✏️ Add Custom Practice Question / Task
              </h3>
              <button
                type="button"
                className="icon-btn-subtle"
                onClick={() => setCustomModalDayIndex(null)}
              >
                ✕
              </button>
            </div>

            <div className="plan-modal-body">
              <div className="day-field-group">
                <label>Question Title *</label>
                <input
                  type="text"
                  className="day-input"
                  placeholder="e.g. Implement LRU Cache with O(1) ops"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                />
              </div>

              <div className="day-field-group">
                <label>Problem / Challenge Link *</label>
                <input
                  type="url"
                  className="day-input"
                  placeholder="https://leetcode.com/... or https://hackerrank.com/..."
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                />
              </div>

              <div className="day-field-group">
                <label>Description &amp; Hints (Optional)</label>
                <textarea
                  className="day-input"
                  placeholder="Instructions or acceptance criteria..."
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                />
              </div>
            </div>

            <div className="plan-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCustomModalDayIndex(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAddCustomQuestion}
              >
                Add Question
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
