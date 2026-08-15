'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrainerTodo, TodoPriority } from '@/lib/types';
import './page.css';

type FilterTab = 'all' | 'active' | 'completed';
type SortKey = 'created_at' | 'due_date' | 'priority';

const PRIORITY_ORDER: Record<TodoPriority, number> = { high: 0, medium: 1, low: 2 };
const PRIORITY_CONFIG: Record<TodoPriority, { label: string; color: string; bg: string; dot: string }> = {
  high: { label: 'High', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', dot: '🔴' },
  medium: { label: 'Medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', dot: '🟡' },
  low: { label: 'Low', color: '#10b981', bg: 'rgba(16,185,129,0.12)', dot: '🟢' },
};
const CATEGORIES = ['General', 'Study', 'Contest Prep', 'Admin', 'Review', 'Practice'];

export default function TodosPage() {
  const [todos, setTodos] = useState<TrainerTodo[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchTodos = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/trainer/todos');
    if (res.ok) setTodos(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchTodos(); }, [fetchTodos]);

  // Filter & sort
  const filtered = todos
    .filter(t => {
      if (tab === 'active' && t.is_completed) return false;
      if (tab === 'completed' && !t.is_completed) return false;
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !(t.description || '').toLowerCase().includes(search.toLowerCase())) return false;
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) { setFormError('Title is required.'); return; }
    setSubmitting(true); setFormError('');
    const res = await fetch('/api/trainer/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim(), description: newDesc.trim() || null, priority: newPriority, category: newCategory, due_date: newDueDate || null }),
    });
    if (res.ok) {
      const created = await res.json();
      setTodos(prev => [created, ...prev]);
      setNewTitle(''); setNewDesc(''); setNewPriority('medium'); setNewCategory('General'); setNewDueDate('');
      setShowForm(false);
    } else {
      setFormError('Failed to create. Please try again.');
    }
    setSubmitting(false);
  };

  const handleToggle = async (id: string) => {
    const todo = todos.find(t => t.id === id);
    setTodos(prev => prev.map(t => t.id === id ? { ...t, is_completed: !t.is_completed } : t));
    await fetch(`/api/trainer/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed: !todo?.is_completed }),
    });
  };

  const handleDelete = async (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id));
    await fetch(`/api/trainer/todos/${id}`, { method: 'DELETE' });
  };

  const activeTodos = todos.filter(t => !t.is_completed);
  const completedTodos = todos.filter(t => t.is_completed);
  const allCategories = [...new Set(todos.map(t => t.category).filter(Boolean))];

  return (
    <div className="todos-page">
      {/* Page Header */}
      <header className="todos-header">
        <div>
          <h1 className="todos-title">To-Do Notes</h1>
          <p className="todos-subtitle">
            <span className="todos-stat">{activeTodos.length} active</span>
            <span style={{ color: 'var(--border-2)' }}>·</span>
            <span className="todos-stat-muted">{completedTodos.length} completed</span>
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(f => !f)}
        >
          {showForm ? '✕ Cancel' : '+ New Note'}
        </button>
      </header>

      {/* Add Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="todos-form">
          <div className="todos-form-row">
            <input
              type="text"
              className="todos-input todos-input-title"
              placeholder="What needs to be done? *"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              disabled={submitting}
              autoFocus
            />
          </div>
          <textarea
            className="todos-input todos-textarea"
            placeholder="Description (optional)..."
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            disabled={submitting}
            rows={2}
          />
          <div className="todos-form-meta-row">
            <div className="todos-form-field">
              <label>Priority</label>
              <select value={newPriority} onChange={e => setNewPriority(e.target.value as TodoPriority)} disabled={submitting} className="todos-select">
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
            <div className="todos-form-field">
              <label>Category</label>
              <select value={newCategory} onChange={e => setNewCategory(e.target.value)} disabled={submitting} className="todos-select">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="todos-form-field">
              <label>Due Date</label>
              <input type="date" className="todos-select" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} disabled={submitting} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting || !newTitle.trim()} style={{ alignSelf: 'flex-end' }}>
              {submitting ? 'Adding…' : 'Add Note'}
            </button>
          </div>
          {formError && <p style={{ color: 'var(--error)', fontSize: '0.85rem', marginTop: '0.5rem' }}>{formError}</p>}
        </form>
      )}

      {/* Filters & Search Row */}
      <div className="todos-controls">
        {/* Tabs */}
        <div className="todos-tabs">
          {(['all', 'active', 'completed'] as FilterTab[]).map(t => (
            <button key={t} className={`todos-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === 'active' && activeTodos.length > 0 && <span className="todos-count-badge">{activeTodos.length}</span>}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <div className="todos-search-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="todos-search-icon">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input type="text" className="todos-search" placeholder="Search notes…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* Category filter */}
          {allCategories.length > 1 && (
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="todos-select" style={{ minWidth: '120px' }}>
              <option value="all">All Categories</option>
              {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          {/* Sort */}
          <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} className="todos-select">
            <option value="created_at">Newest First</option>
            <option value="due_date">Due Date</option>
            <option value="priority">Priority</option>
          </select>
        </div>
      </div>

      {/* Todo List */}
      {loading ? (
        <div className="todos-loading">
          <div className="todos-spinner" />
          <span>Loading your notes…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="todos-empty">
          <div className="todos-empty-icon">
            {tab === 'completed' ? '🎉' : search ? '🔍' : '📝'}
          </div>
          <h3>{tab === 'completed' ? 'No completed tasks yet.' : search ? 'No results found.' : 'No to-do notes yet!'}</h3>
          <p>{tab === 'completed' ? 'Complete a task and it will appear here.' : search ? 'Try a different search term.' : 'Click "+ New Note" to add your first note.'}</p>
        </div>
      ) : (
        <div className="todos-list">
          {filtered.map(todo => {
            const pc = PRIORITY_CONFIG[todo.priority];
            const dueDate = todo.due_date ? new Date(todo.due_date) : null;
            const isOverdue = dueDate && !todo.is_completed && dueDate < new Date();

            return (
              <div key={todo.id} className={`todo-item ${todo.is_completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`}>
                {/* Checkbox */}
                <button className={`todo-checkbox ${todo.is_completed ? 'checked' : ''}`} onClick={() => handleToggle(todo.id)}>
                  {todo.is_completed && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="2 6 5 9 10 3"/>
                    </svg>
                  )}
                </button>

                {/* Content */}
                <div className="todo-content">
                  <div className="todo-title-row">
                    <span className="todo-title">{todo.title}</span>
                    <div className="todo-badges">
                      <span className="todo-priority-badge" style={{ color: pc.color, background: pc.bg }}>
                        {pc.dot} {pc.label}
                      </span>
                      {todo.category && todo.category !== 'General' && (
                        <span className="todo-category-badge">{todo.category}</span>
                      )}
                    </div>
                  </div>
                  {todo.description && (
                    <p className="todo-desc">{todo.description}</p>
                  )}
                  <div className="todo-meta">
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Added {new Date(todo.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                    {dueDate && (
                      <span className={`todo-due ${isOverdue ? 'todo-due-overdue' : ''}`}>
                        {isOverdue ? '⚠️ Overdue · ' : '📅 Due '}
                        {dueDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                    )}
                    {todo.is_completed && todo.completed_at && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--success)' }}>
                        ✅ Completed {new Date(todo.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete */}
                <button
                  className="todo-delete-btn"
                  onClick={() => handleDelete(todo.id)}
                  title="Delete note"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
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
