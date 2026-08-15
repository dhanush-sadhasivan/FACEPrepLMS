'use client';

import { useState, useEffect, useCallback } from 'react';

export interface TodoItem {
  id: string;
  user_id?: string;
  title?: string;
  task?: string;
  is_completed: boolean;
  created_at?: string;
}

export default function GlobalFloatingTodo() {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTask, setNewTask] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  const fetchTodos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/trainer/todos');
      if (res.ok) {
        const data = await res.json();
        setTodos(data || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodos();

    // Event listener for topbar trigger
    const handleToggle = () => {
      setIsClosed(false);
      setIsOpen(prev => !prev);
    };

    window.addEventListener('toggle-floating-todo', handleToggle);
    return () => window.removeEventListener('toggle-floating-todo', handleToggle);
  }, [fetchTodos]);

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim() || adding) return;

    const taskText = newTask.trim();
    setNewTask('');
    setAdding(true);

    try {
      const res = await fetch('/api/trainer/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: taskText, task: taskText }),
      });

      if (res.ok) {
        const item = await res.json();
        setTodos(prev => [item, ...prev]);
      }
    } catch {
      // rollback
    } finally {
      setAdding(false);
    }
  };

  const handleToggleTodo = async (id: string, currentStatus: boolean) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, is_completed: !currentStatus } : t));

    try {
      await fetch(`/api/trainer/todos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: !currentStatus }),
      });
    } catch {
      setTodos(prev => prev.map(t => t.id === id ? { ...t, is_completed: currentStatus } : t));
    }
  };

  const handleDeleteTodo = async (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id));

    try {
      await fetch(`/api/trainer/todos/${id}`, { method: 'DELETE' });
    } catch {
      fetchTodos();
    }
  };

  if (isClosed) return null;

  const activeCount = todos.filter(t => !t.is_completed).length;

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9990 }}>
      {/* ── Minimized Floating Pill Badge Button ──────────────────────────── */}
      {!isOpen ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            onClick={() => setIsOpen(true)}
            style={{
              background: 'var(--surface)', border: '1.5px solid var(--accent)',
              borderRadius: '999px', padding: '0.6rem 1.1rem', color: 'var(--text-primary)',
              fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
              boxShadow: 'var(--shadow-lg), 0 0 16px rgba(99, 102, 241, 0.25)',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>📝</span>
            <span>Quick Notes</span>
            {activeCount > 0 && (
              <span style={{
                background: 'var(--accent)', color: '#fff', fontSize: '0.72rem',
                fontWeight: 800, padding: '0.1rem 0.45rem', borderRadius: '999px',
              }}>
                {activeCount}
              </span>
            )}
          </button>

          {/* Explicit Close Button for Minimized Widget */}
          <button
            onClick={() => setIsClosed(true)}
            title="Dismiss Floating Notes Widget"
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '50%', width: 28, height: 28, color: 'var(--text-muted)',
              fontSize: '0.8rem', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)',
            }}
          >
            ✕
          </button>
        </div>
      ) : (
        /* ── Floating Window Card ─────────────────────────────────────────── */
        <div
          style={{
            width: '360px', maxHeight: '520px', background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: '16px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)', display: 'flex',
            flexDirection: 'column', overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '0.85rem 1.1rem', background: 'var(--surface-2)',
            borderBottom: '1px solid var(--border)', display: 'flex',
            justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.1rem' }}>📝</span>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                My To-Do Notes
              </h3>
              {activeCount > 0 && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  ({activeCount} pending)
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <button
                onClick={() => setIsOpen(false)}
                title="Minimize Window"
                style={{
                  background: 'transparent', border: 'none', color: 'var(--text-muted)',
                  cursor: 'pointer', fontSize: '1.1rem', padding: '0 0.3rem',
                }}
              >
                _
              </button>
              <button
                onClick={() => setIsClosed(true)}
                title="Close Floating Widget"
                style={{
                  background: 'transparent', border: 'none', color: 'var(--text-muted)',
                  cursor: 'pointer', fontSize: '1rem', padding: '0 0.3rem',
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* New Task Input */}
          <form onSubmit={handleAddTodo} style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="+ Add a quick note or task..."
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              style={{
                flex: 1, padding: '0.5rem 0.75rem', borderRadius: '8px',
                border: '1px solid var(--border)', background: 'var(--surface-2)',
                color: 'var(--text-primary)', fontSize: '0.82rem', outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!newTask.trim() || adding}
              className="btn btn-primary btn-sm"
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', fontWeight: 700 }}
            >
              Add
            </button>
          </form>

          {/* Task List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 1rem 1rem 1rem' }}>
            {loading && todos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Loading notes...
              </div>
            ) : todos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                <div style={{ fontSize: '1.75rem', marginBottom: '0.35rem' }}>📌</div>
                No notes created yet. Type a note above to add one!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {todos.map(t => {
                  const displayText = t.title || t.task || 'Untitled note';
                  return (
                    <div
                      key={t.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.5rem 0.65rem', borderRadius: '8px',
                        background: t.is_completed ? 'var(--surface-2)' : 'var(--surface-3)',
                        border: '1px solid var(--border)',
                        opacity: t.is_completed ? 0.65 : 1,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0 }}>
                        <input
                          type="checkbox"
                          checked={t.is_completed}
                          onChange={() => handleToggleTodo(t.id, t.is_completed)}
                          style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
                        />
                        <span style={{
                          fontSize: '0.83rem', color: 'var(--text-primary)',
                          textDecoration: t.is_completed ? 'line-through' : 'none',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {displayText}
                        </span>
                      </div>

                      <button
                        onClick={() => handleDeleteTodo(t.id)}
                        title="Delete note"
                        style={{
                          background: 'transparent', border: 'none', color: 'var(--text-muted)',
                          cursor: 'pointer', fontSize: '0.85rem', padding: '0.1rem 0.3rem',
                          marginLeft: '0.4rem', opacity: 0.7,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
                      >
                        🗑️
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
