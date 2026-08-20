'use client';

import { useState, useMemo } from 'react';
import { TrainerTodo, TodoPriority } from '@/lib/types';
import { useTodos } from '@/lib/swr-hooks';
import './page.css';

type FilterTab = 'all' | 'active' | 'completed';
type SortKey = 'created_at' | 'due_date' | 'priority';

const PRIORITY_ORDER: Record<TodoPriority, number> = { high: 0, medium: 1, low: 2 };
const PRIORITY_CONFIG: Record<TodoPriority, { label: string; color: string; bg: string; dot: string }> = {
  high: { label: 'High Priority', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', dot: '🔴' },
  medium: { label: 'Medium Priority', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', dot: '🟡' },
  low: { label: 'Low Priority', color: '#10b981', bg: 'rgba(16,185,129,0.12)', dot: '🟢' },
};
const CATEGORIES = ['General', 'Study', 'Contest Prep', 'Admin', 'Review', 'Practice'];

export default function TodosPage() {
  const { data: todosData, isLoading: loading, mutate: mutateTodos } = useTodos();
  const todos = (todosData || []) as TrainerTodo[];
  const [tab, setTab] = useState<FilterTab>('all');
  const [sortBy, setSortBy] = useState<SortKey>('created_at');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // New todo form state
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<TodoPriority>('medium');
  const [newCategory, setNewCategory] = useState('General');
  const [newDueDate, setNewDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const activeTodos = useMemo(() => todos.filter((t) => !t.is_completed), [todos]);
  const completedTodos = useMemo(() => todos.filter((t) => t.is_completed), [todos]);
  const highPriorityCount = useMemo(() => todos.filter((t) => t.priority === 'high' && !t.is_completed).length, [todos]);
  const allCategories = useMemo(() => [...new Set(todos.map((t) => t.category).filter(Boolean))], [todos]);

  // Filter & sort
  const filtered = useMemo(() => {
    return todos
      .filter((t) => {
        if (tab === 'active' && t.is_completed) return false;
        if (tab === 'completed' && !t.is_completed) return false;
        if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
        if (
          search &&
          !t.title.toLowerCase().includes(search.toLowerCase()) &&
          !(t.description || '').toLowerCase().includes(search.toLowerCase())
        )
          return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'priority') return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        if (sortBy === 'due_date') {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [todos, tab, categoryFilter, search, sortBy]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setFormError('Title is required.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const res = await fetch('/api/trainer/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDesc.trim() || null,
          priority: newPriority,
          category: newCategory,
          due_date: newDueDate || null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        mutateTodos([created, ...todos], false);
        setNewTitle('');
        setNewDesc('');
        setNewPriority('medium');
        setNewCategory('General');
        setNewDueDate('');
        setShowForm(false);
      } else {
        setFormError('Failed to create. Please try again.');
      }
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: string) => {
    const todo = todos.find((t) => t.id === id);
    mutateTodos(
      todos.map((t) => (t.id === id ? { ...t, is_completed: !t.is_completed } : t)),
      false
    );
    await fetch(`/api/trainer/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed: !todo?.is_completed }),
    });
  };

  const handleDelete = async (id: string) => {
    mutateTodos(
      todos.filter((t) => t.id !== id),
      false
    );
    await fetch(`/api/trainer/todos/${id}`, { method: 'DELETE' });
  };

  return (
    <div className="todos-page">
      {/* Header */}
      <header className="todos-header">
        <div>
          <h1 className="todos-title">To-Do Notes</h1>
          <p className="todos-subtitle">
            Manage your personal learning goals, contest prep, and administrative tasks.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((f) => !f)}>
          {showForm ? '✕ Cancel' : '➕ New Note'}
        </button>
      </header>

      {/* Top Overview Stats Widgets */}
      <div className="stats-overview-grid">
        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--accent)' }}>📝</div>
          <div>
            <div className="stat-widget-val" style={{ color: 'var(--accent)' }}>{todos.length}</div>
            <div className="stat-widget-label">Total Notes</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--indigo)' }}>⚡</div>
          <div>
            <div className="stat-widget-val" style={{ color: 'var(--indigo)' }}>{activeTodos.length}</div>
            <div className="stat-widget-label">Active Tasks</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: '#ef4444' }}>🔴</div>
          <div>
            <div className="stat-widget-val" style={{ color: '#ef4444' }}>{highPriorityCount}</div>
            <div className="stat-widget-label">High Priority</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--success)' }}>✅</div>
          <div>
            <div className="stat-widget-val" style={{ color: 'var(--success)' }}>{completedTodos.length}</div>
            <div className="stat-widget-label">Completed</div>
          </div>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="todos-form">
          <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
            ✏️ Create New Note
          </div>
          <div className="todos-form-row">
            <input
              type="text"
              className="todos-input"
              placeholder="What needs to be done? *"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              disabled={submitting}
              autoFocus
            />
          </div>
          <textarea
            className="todos-input"
            placeholder="Description (optional details)..."
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            disabled={submitting}
            rows={2}
          />
          <div className="todos-form-meta-row">
            <div className="todos-form-field">
              <label>Priority</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as TodoPriority)}
                disabled={submitting}
                className="todos-select"
              >
                <option value="high">🔴 High Priority</option>
                <option value="medium">🟡 Medium Priority</option>
                <option value="low">🟢 Low Priority</option>
              </select>
            </div>
            <div className="todos-form-field">
              <label>Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                disabled={submitting}
                className="todos-select"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="todos-form-field">
              <label>Due Date</label>
              <input
                type="date"
                className="todos-select"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                disabled={submitting}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !newTitle.trim()}
              style={{ alignSelf: 'flex-end', marginLeft: 'auto' }}
            >
              {submitting ? 'Saving Note…' : '💾 Save Note'}
            </button>
          </div>
          {formError && <p style={{ color: 'var(--error)', fontSize: '0.85rem', marginTop: '0.2rem', fontWeight: 600 }}>⚠️ {formError}</p>}
        </form>
      )}

      {/* Controls Bar */}
      <div className="todos-controls">
        <div className="todos-tabs">
          {(['all', 'active', 'completed'] as FilterTab[]).map((t) => (
            <button key={t} className={`todos-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === 'active' && activeTodos.length > 0 && <span className="todos-count-badge">{activeTodos.length}</span>}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-box-wrapper" style={{ maxWidth: 260 }}>
            <span className="search-box-icon">🔍</span>
            <input
              type="text"
              className="search-box-input"
              placeholder="Search notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {allCategories.length > 1 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="todos-select"
              style={{ minWidth: 130 }}
            >
              <option value="all">All Categories</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} className="todos-select">
            <option value="created_at">Newest First</option>
            <option value="due_date">Due Date</option>
            <option value="priority">Priority</option>
          </select>
        </div>
      </div>

      {/* Section Separator */}
      <div className="section-separator">
        <div className="separator-line" />
        <div className="separator-badge">
          <span>📝</span> MY TO-DO NOTES ({filtered.length})
        </div>
        <div className="separator-line" />
      </div>

      {/* Todo List */}
      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="roadmap-spinner" style={{ margin: '0 auto 0.75rem' }} />
          Loading your notes…
        </div>
      ) : filtered.length === 0 ? (
        <div className="todos-empty">
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
            {tab === 'completed' ? '🎉' : search ? '🔍' : '📝'}
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--text-primary)' }}>
            {tab === 'completed'
              ? 'No completed tasks yet'
              : search
              ? 'No matching notes found'
              : 'No to-do notes created yet'}
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            {tab === 'completed'
              ? 'Complete an active task to see it in your completed history.'
              : search
              ? 'Try adjusting your search filter keywords.'
              : 'Click "+ New Note" above to add your first note.'}
          </p>
        </div>
      ) : (
        <div className="todos-list">
          {filtered.map((todo) => {
            const pc = PRIORITY_CONFIG[todo.priority];
            const dueDate = todo.due_date ? new Date(todo.due_date) : null;
            const isOverdue = dueDate && !todo.is_completed && dueDate < new Date();

            return (
              <div
                key={todo.id}
                className={`todo-item priority-${todo.priority} ${todo.is_completed ? 'completed' : ''}`}
              >
                {/* Checkbox */}
                <button
                  className={`todo-checkbox ${todo.is_completed ? 'checked' : ''}`}
                  onClick={() => handleToggle(todo.id)}
                  title={todo.is_completed ? 'Mark active' : 'Mark completed'}
                >
                  {todo.is_completed && (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="2 6 5 9 10 3" />
                    </svg>
                  )}
                </button>

                {/* Content */}
                <div className="todo-content">
                  <div className="todo-title-row">
                    <span className="todo-title">{todo.title}</span>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span className="todo-priority-badge" style={{ color: pc.color, background: pc.bg }}>
                        {pc.dot} {pc.label}
                      </span>
                      {todo.category && todo.category !== 'General' && (
                        <span className="todo-category-badge">{todo.category}</span>
                      )}
                    </div>
                  </div>

                  {todo.description && <p className="todo-desc">{todo.description}</p>}

                  <div className="todo-meta">
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Added {new Date(todo.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                    {dueDate && (
                      <span className={`todo-due ${isOverdue ? 'todo-due-overdue' : ''}`}>
                        {isOverdue ? '⚠️ Overdue · ' : '📅 Due '}
                        {dueDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                    )}
                    {todo.is_completed && todo.completed_at && (
                      <span style={{ fontSize: '0.74rem', color: 'var(--success)', fontWeight: 700 }}>
                        ✅ Completed {new Date(todo.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete button */}
                <button
                  className="todo-delete-btn"
                  onClick={() => handleDelete(todo.id)}
                  title="Delete note"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
