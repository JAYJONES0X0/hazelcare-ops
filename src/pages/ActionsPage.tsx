import { useState } from 'react';
import type { Action, ActionStatus, ActionPriority } from '../lib/types';
import { uid } from '../lib/storage';

interface Props {
  actions: Action[];
  onUpdate: (actions: Action[]) => void;
}

const STATUS_CONFIG: Record<ActionStatus, { label: string; color: string; bg: string }> = {
  open: { label: 'Open', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  in_progress: { label: 'In Progress', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  blocked: { label: 'Blocked', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  completed: { label: 'Completed', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  overdue: { label: 'Overdue', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
};

const PRIORITY_CONFIG: Record<ActionPriority, { label: string; color: string }> = {
  critical: { label: 'Critical', color: '#ef4444' },
  high: { label: 'High', color: '#f59e0b' },
  medium: { label: 'Medium', color: '#3b82f6' },
  low: { label: 'Low', color: '#64748b' },
};

type FilterStatus = 'all' | ActionStatus;

export function ActionsPage({ actions, onUpdate }: Props) {
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [newAction, setNewAction] = useState({ title: '', house: '', owner: '', priority: 'medium' as ActionPriority, dueDate: '' });

  const filtered = filter === 'all' ? actions : actions.filter(a => a.status === filter);
  const sorted = [...filtered].sort((a, b) => {
    const pOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const sOrder: Record<string, number> = { blocked: 0, overdue: 0, open: 1, in_progress: 2, completed: 3 };
    return (sOrder[a.status] ?? 4) - (sOrder[b.status] ?? 4) || (pOrder[a.priority] ?? 4) - (pOrder[b.priority] ?? 4);
  });

  const counts = {
    all: actions.length,
    open: actions.filter(a => a.status === 'open').length,
    in_progress: actions.filter(a => a.status === 'in_progress').length,
    blocked: actions.filter(a => a.status === 'blocked').length,
    completed: actions.filter(a => a.status === 'completed').length,
    overdue: actions.filter(a => a.status === 'overdue').length,
  };

  function cycleStatus(action: Action) {
    const order: ActionStatus[] = ['open', 'in_progress', 'completed'];
    const idx = order.indexOf(action.status);
    const next = order[(idx + 1) % order.length];
    const updated = actions.map(a => a.id === action.id ? { ...a, status: next, completedAt: next === 'completed' ? new Date().toLocaleDateString('en-GB') : undefined } : a);
    onUpdate(updated);
  }

  function addAction() {
    if (!newAction.title.trim()) return;
    const action: Action = {
      id: uid(),
      title: newAction.title,
      description: '',
      house: newAction.house || 'General',
      owner: newAction.owner || 'Unassigned',
      priority: newAction.priority,
      status: 'open',
      createdAt: new Date().toLocaleDateString('en-GB'),
      dueDate: newAction.dueDate || '',
      tags: [],
    };
    onUpdate([action, ...actions]);
    setNewAction({ title: '', house: '', owner: '', priority: 'medium', dueDate: '' });
    setShowAdd(false);
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Action Tracker</h1>
          <p className="text-hc-muted text-sm">Track actions from meetings, incidents, and flag reviews.</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2 bg-hc-teal text-white text-sm font-semibold rounded-xl hover:bg-hc-teal-light"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          New Action
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-hc-card border border-hc-teal/30 rounded-xl p-5 mb-6 glow-teal">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input value={newAction.title} onChange={e => setNewAction({ ...newAction, title: e.target.value })} placeholder="Action title" className="col-span-2 bg-hc-dark border border-hc-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-hc-muted/50 focus:outline-none focus:border-hc-teal-light" />
            <input value={newAction.house} onChange={e => setNewAction({ ...newAction, house: e.target.value })} placeholder="House" className="bg-hc-dark border border-hc-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-hc-muted/50 focus:outline-none focus:border-hc-teal-light" />
            <input value={newAction.owner} onChange={e => setNewAction({ ...newAction, owner: e.target.value })} placeholder="Owner" className="bg-hc-dark border border-hc-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-hc-muted/50 focus:outline-none focus:border-hc-teal-light" />
            <select value={newAction.priority} onChange={e => setNewAction({ ...newAction, priority: e.target.value as ActionPriority })} className="bg-hc-dark border border-hc-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-hc-teal-light">
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <input type="date" value={newAction.dueDate} onChange={e => setNewAction({ ...newAction, dueDate: e.target.value })} className="bg-hc-dark border border-hc-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-hc-teal-light" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-hc-muted hover:text-white">Cancel</button>
            <button onClick={addAction} className="px-4 py-2 bg-hc-teal text-white text-sm font-semibold rounded-lg hover:bg-hc-teal-light">Add Action</button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-hc-card rounded-xl p-1 border border-hc-border">
        {(['all', 'open', 'in_progress', 'blocked', 'completed'] as FilterStatus[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
              filter === f ? 'bg-hc-teal/15 text-hc-teal-light font-semibold' : 'text-hc-muted hover:text-white'
            }`}
          >
            {f === 'all' ? 'All' : STATUS_CONFIG[f].label}
            <span className="ml-1.5 text-[10px] opacity-60">{counts[f]}</span>
          </button>
        ))}
      </div>

      {/* Actions list */}
      <div className="space-y-2">
        {sorted.map(action => {
          const sc = STATUS_CONFIG[action.status];
          const pc = PRIORITY_CONFIG[action.priority];
          return (
            <div key={action.id} className="bg-hc-card border border-hc-border rounded-xl p-4 hover:bg-hc-card-hover hover:border-hc-border-light transition-all">
              <div className="flex items-start gap-3">
                {/* Status toggle */}
                <button
                  onClick={() => cycleStatus(action)}
                  className="mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all"
                  style={{ borderColor: sc.color, background: action.status === 'completed' ? sc.color : 'transparent' }}
                >
                  {action.status === 'completed' && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm font-semibold ${action.status === 'completed' ? 'text-hc-muted line-through' : 'text-white'}`}>
                      {action.title}
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: pc.color, background: `${pc.color}15`, border: `1px solid ${pc.color}25` }}>
                      {pc.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-hc-muted">
                    <span>{action.house}</span>
                    <span className="text-hc-border">|</span>
                    <span>{action.owner}</span>
                    {action.dueDate && (
                      <>
                        <span className="text-hc-border">|</span>
                        <span>Due: {action.dueDate}</span>
                      </>
                    )}
                  </div>
                  {action.tags.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {action.tags.map(tag => (
                        <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-hc-dark text-hc-muted border border-hc-border">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Status badge */}
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0" style={{ color: sc.color, background: sc.bg }}>
                  {sc.label}
                </span>
              </div>
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div className="text-center py-12 text-hc-muted">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            <div className="text-sm">No actions matching this filter</div>
          </div>
        )}
      </div>
    </div>
  );
}
