'use client';

import { useState, useOptimistic, useTransition } from 'react';
import Link from 'next/link';
import { TrainerTodo, TodoPriority } from '@/lib/types';

interface TrainerTodoWidgetProps {
  initialTodos: TrainerTodo[];
}

const PRIORITY_CONFIG: Record<TodoPriority, { label: string; color: string; bg: string }> = {
  high: { label: 'High', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  medium: { label: 'Med', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  low: { label: 'Low', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
};

export default function TrainerTodoWidget({ initialTodos }: TrainerTodoWidgetProps) {
  const [todos, setTodos] = useState<TrainerTodo[]>(initialTodos);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<TodoPriority>('medium');
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [, startTransition] = useTransition();

  const [optimisticTodos, updateOptimistic] = useOptimistic(
    todos,
    (state: TrainerTodo[], update: { type: 'toggle' | 'delete'; id: string }) => {
      if (update.type === 'toggle') {
        return state.map(t => t.id === update.id ? { ...t, is_completed: !t.is_completed } : t);
      }
      return state.filter(t => t.id !== update.id);
    }
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || adding) return;
    setAdding(true);
    try {
      const res = await fetch('/api/trainer/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), priority: newPriority }),
      });
      if (res.ok) {
        const created = await res.json();
        setTodos(prev => [created, ...prev]);
        setNewTitle('');
        setShowForm(false);
      }
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (id: string) => {
    startTransition(() => updateOptimistic({ type: 'toggle', id }));
    const todo = todos.find(t => t.id === id);
    await fetch(`/api/trainer/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed: !todo?.is_completed }),
    });
    setTodos(prev => prev.map(t => t.id === id ? { ...t, is_completed: !t.is_completed } : t));
  };

  const handleDelete = async (id: string) => {
    startTransition(() => updateOptimistic({ type: 'delete', id }));
    await fetch(`/api/trainer/todos/${id}`, { method: 'DELETE' });
    setTodos(prev => prev.filter(t => t.id !== id));
  };

  const pending = optimisticTodos.filter(t => !t.is_completed);
  const completed = optimisticTodos.filter(t => t.is_completed);
  const displayTodos = [...pending, ...completed].slice(0, 5);

  return (
    <div className="widget-card" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 className="widget-title" style={{ margin: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
            <polyline points="3 6 4 7 6 5"/><polyline points="3 12 4 13 6 11"/><polyline points="3 18 4 19 6 17"/>
          </svg>
          To-Do Notes
          {pending.length > 0 && (
            <span style={{ background: 'var(--accent)', color: '#000', fontSize: '0.7rem', fontWeight: 800, padding: '0.1rem 0.45rem', borderRadius: '999px', marginLeft: '0.4rem' }}>
              {pending.length}
            </span>
          )}
        </h3>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button
            onClick={() => setShowForm(f => !f)}
            style={{ background: showForm ? 'var(--accent)' : 'var(--accent-muted)', color: showForm ? '#000' : 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0.3rem 0.7rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s ease' }}
          >
            {showForm ? '✕' : '+ Add'}
          </button>
          <Link href="/todos" style={{ color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>
            All →
          </Link>
        </div>
      </div>

      {/* Quick-add form */}
      {showForm && (
        <form onSubmit={handleAdd} style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="What needs to be done?"
            disabled={adding}
            autoFocus
            style={{ flex: 1, minWidth: '160px', padding: '0.45rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none', fontFamily: 'inherit' }}
          />
          <select
            value={newPriority}
            onChange={e => setNewPriority(e.target.value as TodoPriority)}
            disabled={adding}
            style={{ padding: '0.45rem 0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text-primary)', fontSize: '0.8rem', fontFamily: 'inherit', cursor: 'pointer' }}
          >
            <option value="high">🔴 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🟢 Low</option>
          </select>
          <button type="submit" disabled={adding || !newTitle.trim()} style={{ padding: '0.45rem 0.85rem', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', opacity: adding || !newTitle.trim() ? 0.6 : 1 }}>
            {adding ? '…' : 'Add'}
          </button>
        </form>
      )}

      {/* Todo list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {displayTodos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>✅</div>
            All clear! Add a note to get started.
          </div>
        ) : (
          displayTodos.map(todo => {
            const pc = PRIORITY_CONFIG[todo.priority];
            return (
              <div
                key={todo.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.55rem 0.75rem',
                  background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  opacity: todo.is_completed ? 0.55 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Checkbox */}
                <button
                  onClick={() => handleToggle(todo.id)}
                  style={{ width: '18px', height: '18px', borderRadius: '4px', border: `2px solid ${todo.is_completed ? 'var(--success)' : 'var(--border-2)'}`, background: todo.is_completed ? 'var(--success)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s ease' }}
                >
                  {todo.is_completed && <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 6 5 9 10 3"/></svg>}
                </button>

                {/* Priority badge */}
                <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '999px', background: pc.bg, color: pc.color, flexShrink: 0 }}>
                  {pc.label}
                </span>

                {/* Title */}
                <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--text-primary)', textDecoration: todo.is_completed ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {todo.title}
                </span>

                {/* Due date */}
                {todo.due_date && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                    {new Date(todo.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                )}

                {/* Delete */}
                <button
                  onClick={() => handleDelete(todo.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.1rem 0.2rem', opacity: 0.5, fontSize: '0.8rem', flexShrink: 0, transition: 'opacity 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Progress bar */}
      {optimisticTodos.length > 0 && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Progress</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              {completed.length}/{optimisticTodos.length} done
            </span>
          </div>
          <div style={{ height: '5px', background: 'var(--surface-3)', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(completed.length / optimisticTodos.length) * 100}%`, background: 'linear-gradient(90deg, var(--success), var(--accent))', borderRadius: '999px', transition: 'width 0.4s ease' }} />
          </div>
        </div>
      )}
    </div>
  );
}
