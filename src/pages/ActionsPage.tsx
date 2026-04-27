import { useState } from 'react';
import type { Action, ActionStatus, ActionPriority } from '../lib/types';
import { uid } from '../lib/storage';
import { useCollapseStore } from '../lib/collapse-store';
import { HAZELCARE_HOUSES } from '../lib/compliance-store';

interface Props {
  actions: Action[];
  onUpdate: (actions: Action[]) => void;
}

const STATUS_CONFIG: Record<ActionStatus, { label: string; color: string }> = {
  open:        { label: 'Open',        color: '#1c4e4e' },
  in_progress: { label: 'In Progress', color: '#d9974e' },
  blocked:     { label: 'Blocked',     color: '#d94e4e' },
  completed:   { label: 'Completed',   color: '#4e8d4e' },
  overdue:     { label: 'Overdue',     color: '#d94e4e' },
};

const PRIORITY_CONFIG: Record<ActionPriority, { label: string }> = {
  critical: { label: 'Critical' },
  high:     { label: 'High' },
  medium:   { label: 'Medium' },
  low:      { label: 'Low' },
};

type FilterStatus = 'all' | ActionStatus;

export function ActionsPage({ actions, onUpdate }: Props) {
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [newAction, setNewAction] = useState({ title: '', description: '', house: HAZELCARE_HOUSES[0], owner: '', priority: 'medium' as ActionPriority, dueDate: '' });
  const [editingDesc, setEditingDesc] = useState<string | null>(null);
  const { isCollapsed: isActionCollapsed, toggle: toggleAction, collapseAll: collapseAllActions, expandAll: expandAllActions, allCollapsed: allActionsCollapsed } = useCollapseStore('actions-cards', true);

  const filtered = filter === 'all' ? actions : actions.filter(a => a.status === filter);
  const sorted = [...filtered].sort((a, b) => {
    const pOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const sOrder: Record<string, number> = { blocked: 0, overdue: 0, open: 1, in_progress: 2, completed: 3 };
    return (sOrder[a.status] ?? 4) - (sOrder[b.status] ?? 4) || (pOrder[a.priority] ?? 4) - (pOrder[b.priority] ?? 4);
  });
  const actionIds = sorted.map(a => a.id);
  const allCollapsed = allActionsCollapsed(actionIds);

  const counts = {
    all:         actions.length,
    open:        actions.filter(a => a.status === 'open').length,
    in_progress: actions.filter(a => a.status === 'in_progress').length,
    blocked:     actions.filter(a => a.status === 'blocked').length,
    completed:   actions.filter(a => a.status === 'completed').length,
    overdue:     actions.filter(a => a.status === 'overdue').length,
  };

  function cycleStatus(action: Action) {
    const order: ActionStatus[] = ['open', 'in_progress', 'completed'];
    const idx = order.indexOf(action.status);
    const next = order[(idx + 1) % order.length];
    onUpdate(actions.map(a => a.id === action.id ? { 
      ...a, 
      status: next, 
      completedAt: next === 'completed' ? new Date().toLocaleDateString('en-GB') : undefined,
      completedBy: next === 'completed' ? 'Current User' : undefined // To be tied to Auth
    } : a));
  }

  function deleteAction(id: string) {
    onUpdate(actions.filter(a => a.id !== id));
  }

  function saveDesc(id: string, desc: string) {
    onUpdate(actions.map(a => a.id === id ? { ...a, description: desc } : a));
    setEditingDesc(null);
  }

  function addAction() {
    if (!newAction.title.trim()) return;
    const action: Action = {
      id: uid(),
      title: newAction.title,
      description: newAction.description,
      house: newAction.house || 'General',
      owner: newAction.owner || 'Unassigned',
      priority: newAction.priority,
      status: 'open',
      createdAt: new Date().toLocaleDateString('en-GB'),
      dueDate: newAction.dueDate || '',
      tags: [],
    };
    onUpdate([action, ...actions]);
    setNewAction({ title: '', description: '', house: HAZELCARE_HOUSES[0], owner: '', priority: 'medium', dueDate: '' });
    setShowAdd(false);
  }

  return (
    <div className="min-h-screen flex flex-col animate-in fade-in duration-500">

      {/* ── COMMAND HEADER ── */}
      <div className="shrink-0 border-b border-hc-border/30 px-8 py-6 flex items-center justify-between gap-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-hc-text tracking-[0.2em] uppercase mb-1">Command Vectors</h1>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-black text-hc-teal tracking-[0.2em] uppercase">Action Tracker</span>
            <div className="h-3 w-px bg-hc-border/40" />
            <span className="text-[11px] font-bold text-hc-muted uppercase tracking-widest">
              {actions.filter(a => a.status !== 'completed').length} Open · {actions.filter(a => a.priority === 'critical' && a.status !== 'completed').length} Critical
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => allCollapsed ? expandAllActions(actionIds) : collapseAllActions(actionIds)}
            className="btn-clay text-[11px] py-2.5 px-5"
          >
            {allCollapsed ? 'Expand All' : 'Collapse All'}
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all
              ${showAdd ? 'hc-clay-inset text-hc-muted' : 'btn-tactical'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            New Action
          </button>
        </div>
      </div>

      {/* ── ADD FORM ── */}
      {showAdd && (
        <div className="shrink-0 border-b border-hc-border/30 p-8 animate-in slide-in-from-top-4 duration-300">
          <div className="hc-clay-raised p-6 space-y-4">
            <h3 className="text-[11px] font-black text-hc-text uppercase tracking-[0.3em] mb-4">New Action Vector</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <label className="text-[11px] font-black text-hc-muted uppercase tracking-[0.2em] mb-2 block">Action Title</label>
                <input
                  value={newAction.title}
                  onChange={e => setNewAction({ ...newAction, title: e.target.value })}
                  placeholder="What needs to be done..."
                  className="w-full hc-clay-inset px-4 py-3 text-xs font-bold text-hc-text outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-black text-hc-muted uppercase tracking-[0.2em] mb-2 block">House</label>
                <select
                  value={newAction.house}
                  onChange={e => setNewAction({ ...newAction, house: e.target.value })}
                  className="w-full hc-clay-inset px-4 py-3 text-[11px] font-black text-hc-text outline-none uppercase tracking-widest"
                >
                  {HAZELCARE_HOUSES.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-black text-hc-muted uppercase tracking-[0.2em] mb-2 block">Assigned To</label>
                <input
                  value={newAction.owner}
                  onChange={e => setNewAction({ ...newAction, owner: e.target.value })}
                  placeholder="Name..."
                  className="w-full hc-clay-inset px-4 py-3 text-xs font-bold text-hc-text outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-black text-hc-muted uppercase tracking-[0.2em] mb-2 block">Priority</label>
                <select
                  value={newAction.priority}
                  onChange={e => setNewAction({ ...newAction, priority: e.target.value as ActionPriority })}
                  className="w-full hc-clay-inset px-4 py-3 text-[11px] font-black text-hc-text outline-none uppercase tracking-widest"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-black text-hc-muted uppercase tracking-[0.2em] mb-2 block">Due Date</label>
                <input
                  type="date"
                  value={newAction.dueDate}
                  onChange={e => setNewAction({ ...newAction, dueDate: e.target.value })}
                  className="w-full hc-clay-inset px-4 py-3 text-xs font-bold text-hc-text outline-none"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="text-[11px] font-black text-hc-muted uppercase tracking-[0.2em] mb-2 block">Notes (Optional)</label>
                <input
                  value={newAction.description}
                  onChange={e => setNewAction({ ...newAction, description: e.target.value })}
                  placeholder="Context, evidence, links..."
                  className="w-full hc-clay-inset px-4 py-3 text-xs font-bold text-hc-text outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-4 pt-2">
              <button onClick={() => setShowAdd(false)} className="text-[11px] font-black text-hc-muted hover:text-hc-text uppercase tracking-[0.2em] transition-colors">
                Cancel
              </button>
              <button onClick={addAction} className="btn-tactical px-10 py-3 text-[11px]">
                Add Action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FILTER STRIP ── */}
      <div className="shrink-0 border-b border-hc-border/30 px-8 py-3 flex items-center gap-2 flex-wrap">
        {(['all', 'open', 'in_progress', 'blocked', 'completed', 'overdue'] as FilterStatus[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-5 py-1.5 rounded-xl transition-all text-[11px] font-black uppercase tracking-widest flex items-center gap-2 ${
              filter === f
                ? 'hc-clay-inset text-hc-text'
                : 'text-hc-muted hover:text-hc-text'
            }`}
          >
            {f === 'all' ? 'All' : (STATUS_CONFIG[f as ActionStatus]?.label || f)}
            <span className={`tabular-nums font-mono text-[11px] ${filter === f ? 'text-hc-teal' : 'text-hc-muted'}`}>
              {counts[f] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* ── ACTION LIST ── */}
      <div className="flex-1 p-8 space-y-3">
        {sorted.map((action, idx) => {
          const sc = STATUS_CONFIG[action.status] || { label: action.status, color: '#8a8b82' };
          const pc = PRIORITY_CONFIG[action.priority] || { label: action.priority };
          const isCritical = action.priority === 'critical' && action.status !== 'completed';
          const collapsed = isActionCollapsed(action.id);
          const isEditingThis = editingDesc === action.id;

          return (
            <div
              key={action.id}
              className={`rounded-2xl overflow-hidden transition-all duration-300 group animate-in slide-in-from-left-4
                ${action.status === 'completed' ? 'opacity-40 grayscale hover:opacity-70' : ''}
                ${isCritical
                  ? `border-2 border-flag-red/50 bg-flag-red/5 shadow-[0_0_20px_rgba(217,78,78,0.15)] ${action.status !== 'completed' ? 'animate-pulse-subtle' : ''}`
                  : 'hc-clay-raised'
                }`}
              style={{ animationDelay: `${idx * 30}ms` }}
            >
              {/* ROW */}
              <div className="flex items-center gap-6 px-6 py-4">
                {/* Status checkbox */}
                <button
                  onClick={(e) => { e.stopPropagation(); cycleStatus(action); }}
                  title="Click to advance status"
                  className={`w-5 h-5 flex items-center justify-center shrink-0 rounded border-2 transition-all hover:scale-110 active:scale-95
                    ${action.status === 'completed'
                      ? 'bg-flag-green border-flag-green'
                      : 'border-hc-border hover:border-hc-teal bg-hc-bg'
                    }`}
                >
                  {action.status === 'completed' ? (
                    <svg className="w-3 h-3 text-hc-bg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  ) : (action.status === 'in_progress' || isCritical) ? (
                    <div className={`w-1.5 h-1.5 rounded-full ${isCritical ? 'bg-flag-red animate-ping' : 'bg-hc-amber animate-pulse'}`} />
                  ) : null}
                </button>

                {/* Title row — click to collapse */}
                <button type="button" onClick={() => toggleAction(action.id)} className="flex-1 min-w-0 text-left flex items-center gap-4">
                  <span className={`text-sm font-black tracking-tight uppercase transition-colors
                    ${action.status === 'completed' ? 'text-hc-muted line-through' : 'text-hc-text group-hover:text-hc-teal'}`}>
                    {action.title}
                  </span>
                  <div className="h-px flex-1 bg-hc-border/30" />
                  {/* Priority badge */}
                  <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-lg border uppercase tracking-widest shrink-0
                    ${action.priority === 'critical' ? 'bg-flag-red/10 border-flag-red/40 text-flag-red'
                    : action.priority === 'high'     ? 'bg-flag-amber/10 border-flag-amber/40 text-flag-amber'
                    : action.priority === 'medium'   ? 'bg-hc-teal/10 border-hc-teal/30 text-hc-teal'
                    :                                  'bg-hc-border/20 border-hc-border/40 text-hc-muted'}`}>
                    {pc.label}
                  </span>
                </button>

                {/* Meta + controls */}
                <div className="flex items-center gap-6 shrink-0">
                  <div className="hidden md:flex flex-col items-end gap-0.5">
                    <span className="text-[11px] font-black text-hc-muted uppercase tracking-widest">Owner</span>
                    <span className="text-[11px] font-bold text-hc-text uppercase">{action.owner}</span>
                  </div>
                  <div className="hidden md:flex flex-col items-end gap-0.5">
                    <span className="text-[11px] font-black text-hc-muted uppercase tracking-widest">House</span>
                    <span className="text-[11px] font-bold text-hc-text uppercase">{action.house}</span>
                  </div>
                  <span
                    className="text-[11px] font-black uppercase tracking-widest w-24 text-center border-l border-hc-border/30 pl-6"
                    style={{ color: sc.color }}
                  >
                    {sc.label}
                  </span>
                  <button
                    onClick={() => deleteAction(action.id)}
                    className="opacity-0 group-hover:opacity-100 text-hc-muted/40 hover:text-flag-red transition-all p-1"
                    title="Delete action"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                  <button type="button" onClick={() => toggleAction(action.id)} className="p-1 text-hc-muted hover:text-hc-text transition-colors">
                    <svg className={`w-4 h-4 transition-transform ${collapsed ? '-rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </div>
              </div>

              {/* EXPANDED DETAIL */}
              {!collapsed && (
                <div className="px-12 pb-6 pt-3 border-t border-hc-border/20 bg-hc-teal/[0.02] animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="grid grid-cols-3 gap-8 mb-4">
                    <div>
                      <span className="text-[11px] font-black text-hc-muted uppercase tracking-[0.2em] mb-1 block">Created</span>
                      <span className="text-[11px] font-bold text-hc-text uppercase">{action.createdAt}</span>
                    </div>
                    <div>
                      <span className="text-[11px] font-black text-hc-muted uppercase tracking-[0.2em] mb-1 block">Due</span>
                      <span className={`text-[11px] font-black uppercase ${isCritical ? 'text-flag-red' : 'text-hc-text'}`}>
                        {action.dueDate || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] font-black text-hc-muted uppercase tracking-[0.2em] mb-1 block">Status</span>
                      <span className="text-[11px] font-black uppercase" style={{ color: sc.color }}>{sc.label}</span>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[11px] font-black text-hc-muted uppercase tracking-[0.2em]">Notes</span>
                      {!isEditingThis && (
                        <button onClick={() => setEditingDesc(action.id)} className="text-[11px] font-black text-hc-teal uppercase tracking-widest hover:underline">
                          {action.description ? 'Edit' : '+ Add'}
                        </button>
                      )}
                    </div>
                    {isEditingThis ? (
                      <div className="space-y-2">
                        <textarea
                          autoFocus
                          defaultValue={action.description}
                          onBlur={e => saveDesc(action.id, e.target.value)}
                          rows={3}
                          className="w-full hc-clay-inset px-4 py-3 text-[11px] text-hc-text font-mono outline-none resize-none"
                          placeholder="Context, evidence, links..."
                        />
                        <div className="text-[11px] text-hc-muted uppercase tracking-widest">Click outside to save</div>
                      </div>
                    ) : action.description ? (
                      <p className="text-[11px] text-hc-text/70 font-mono leading-relaxed">{action.description}</p>
                    ) : (
                      <span className="text-[11px] text-hc-muted italic">No notes added</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div className="hc-clay-raised rounded-2xl flex flex-col items-center justify-center py-32 text-center">
            <div className="text-5xl mb-6">🎯</div>
            <div className="text-xl font-black text-hc-text mb-2 uppercase tracking-tight">All Clear</div>
            <div className="text-[11px] text-hc-muted uppercase tracking-[0.3em]">No actions matching this filter</div>
          </div>
        )}
      </div>
    </div>
  );
}
