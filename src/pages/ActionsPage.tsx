import { useState } from 'react';
import type { Action, ActionStatus, ActionPriority } from '../lib/types';
import { uid } from '../lib/storage';
import { useCollapseStore } from '../lib/collapse-store';
import { HAZELCARE_HOUSES } from '../lib/compliance-store';

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
    onUpdate(actions.map(a => a.id === action.id ? { ...a, status: next, completedAt: next === 'completed' ? new Date().toLocaleDateString('en-GB') : undefined } : a));
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
    <div className="min-h-screen flex flex-col bg-slate-950 animate-in fade-in duration-700">

      {/* ── COMMAND HEADER ── */}
      <div className="shrink-0 border-b border-slate-800 bg-slate-900/50 px-8 py-6 flex items-center justify-between gap-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter mb-1 uppercase">Command Vectors</h1>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-hc-teal-light tracking-[0.2em] uppercase">Action Tracker</span>
            <div className="h-3 w-px bg-slate-800" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{actions.filter(a => a.status !== 'completed').length} OPEN · {actions.filter(a => a.priority === 'critical' && a.status !== 'completed').length} CRITICAL</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => allCollapsed ? expandAllActions(actionIds) : collapseAllActions(actionIds)}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-800 bg-slate-900/50 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            {allCollapsed ? 'EXPAND ALL' : 'COLLAPSE ALL'}
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className={`flex items-center gap-2 px-6 py-2.5 border transition-all ${showAdd ? 'bg-slate-800 border-slate-700 opacity-50' : 'bg-hc-teal/10 border-hc-teal/40 text-hc-teal-light hover:bg-hc-teal/20'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">NEW ACTION</span>
          </button>
        </div>
      </div>

      {/* ── ADD FORM ── */}
      {showAdd && (
        <div className="shrink-0 border-b border-slate-800 bg-slate-900/10 p-8 animate-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="lg:col-span-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block">ACTION TITLE</label>
              <input value={newAction.title} onChange={e => setNewAction({ ...newAction, title: e.target.value })} placeholder="What needs to be done..." className="w-full bg-slate-900 border border-slate-800 px-4 py-3 text-sm text-white focus:outline-none focus:border-hc-teal/50 font-medium" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block">HOUSE</label>
              <select value={newAction.house} onChange={e => setNewAction({ ...newAction, house: e.target.value })} className="w-full bg-slate-900 border border-slate-800 px-4 py-3 text-[11px] font-black text-white focus:outline-none focus:border-hc-teal/50 uppercase tracking-widest">
                {HAZELCARE_HOUSES.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block">ASSIGNED TO</label>
              <input value={newAction.owner} onChange={e => setNewAction({ ...newAction, owner: e.target.value })} placeholder="Name..." className="w-full bg-slate-900 border border-slate-800 px-4 py-3 text-sm text-white focus:outline-none focus:border-hc-teal/50 font-medium" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block">PRIORITY</label>
              <select value={newAction.priority} onChange={e => setNewAction({ ...newAction, priority: e.target.value as ActionPriority })} className="w-full bg-slate-900 border border-slate-800 px-4 py-3 text-[11px] font-black text-white focus:outline-none focus:border-hc-teal/50 uppercase tracking-widest">
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block">DUE DATE</label>
              <input type="date" value={newAction.dueDate} onChange={e => setNewAction({ ...newAction, dueDate: e.target.value })} className="w-full bg-slate-900 border border-slate-800 px-4 py-3 text-sm text-white focus:outline-none focus:border-hc-teal/50 font-medium invert hue-rotate-180" />
            </div>
            <div className="lg:col-span-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block">NOTES (OPTIONAL)</label>
              <input value={newAction.description} onChange={e => setNewAction({ ...newAction, description: e.target.value })} placeholder="Context, evidence, links..." className="w-full bg-slate-900 border border-slate-800 px-4 py-3 text-sm text-white focus:outline-none focus:border-hc-teal/50 font-medium" />
            </div>
          </div>
          <div className="flex justify-end gap-4">
            <button onClick={() => setShowAdd(false)} className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-[0.2em] transition-colors">CANCEL</button>
            <button onClick={addAction} className="px-10 py-3 bg-hc-teal/10 border border-hc-teal/40 text-hc-teal-light text-[10px] font-black uppercase tracking-[0.25em] hover:bg-hc-teal/20 transition-all">ADD ACTION</button>
          </div>
        </div>
      )}

      {/* ── FILTER STRIP ── */}
      <div className="shrink-0 bg-slate-950 border-b border-slate-800 px-8 py-3 flex items-center gap-3">
        {(['all', 'open', 'in_progress', 'blocked', 'completed', 'overdue'] as FilterStatus[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-5 py-1.5 border transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${
              filter === f ? 'bg-slate-800 border-slate-700 text-white' : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {f === 'all' ? 'ALL' : (STATUS_CONFIG[f]?.label || f).toUpperCase()}
            <span className={`tabular-nums opacity-60 ${filter === f ? 'text-hc-teal-light' : 'text-slate-600'}`}>{counts[f] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* ── ACTION LIST ── */}
      <div className="flex-1 p-8 space-y-2 bg-slate-950/20">
        {sorted.map((action, idx) => {
          const sc = STATUS_CONFIG[action.status] || { label: action.status, color: '#94a3b8' };
          const pc = PRIORITY_CONFIG[action.priority] || { label: action.priority, color: '#94a3b8' };
          const isCritical = action.priority === 'critical' && action.status !== 'completed';
          const collapsed = isActionCollapsed(action.id);
          const isEditingThis = editingDesc === action.id;

          return (
            <div key={action.id} className={`border transition-all duration-300 group animate-in slide-in-from-left-4
              ${action.status === 'completed' ? 'opacity-40 grayscale hover:opacity-70' : ''}
              ${isCritical ? 'border-red-900 bg-red-950/10' : 'border-slate-800 bg-slate-900/30 hover:border-slate-700'}`}
              style={{ animationDelay: `${idx * 30}ms` }}>

              {/* ROW */}
              <div className="flex items-center gap-6 px-6 py-4">
                <button
                  onClick={(e) => { e.stopPropagation(); cycleStatus(action); }}
                  title="Click to advance status"
                  className={`w-5 h-5 flex items-center justify-center shrink-0 border-2 transition-all hover:scale-110 active:scale-95
                    ${action.status === 'completed' ? 'bg-green-600 border-green-600' : 'border-slate-700 hover:border-hc-teal-light bg-slate-900'}`}
                >
                  {action.status === 'completed' ? (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  ) : action.status === 'in_progress' ? (
                    <div className="w-1.5 h-1.5 bg-amber-500 animate-pulse" />
                  ) : null}
                </button>

                <button type="button" onClick={() => toggleAction(action.id)} className="flex-1 min-w-0 text-left flex items-center gap-4">
                  <span className={`text-sm font-black tracking-tight uppercase transition-colors
                    ${action.status === 'completed' ? 'text-slate-500 line-through' : 'text-white group-hover:text-hc-teal-light'}`}>
                    {action.title}
                  </span>
                  <div className="h-px flex-1 bg-slate-800/50" />
                  <span className={`text-[9px] font-black px-2 py-0.5 border uppercase tracking-widest shrink-0
                    ${action.priority === 'critical' ? 'bg-red-950 border-red-500/40 text-red-400' : action.priority === 'high' ? 'bg-amber-950 border-amber-500/40 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                    {pc.label}
                  </span>
                </button>

                <div className="flex items-center gap-6 shrink-0">
                  <div className="hidden md:flex flex-col items-end">
                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">OWNER</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{action.owner}</span>
                  </div>
                  <div className="hidden md:flex flex-col items-end">
                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">HOUSE</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{action.house}</span>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest w-24 text-center border-l border-slate-800" style={{ color: sc.color }}>
                    {sc.label}
                  </span>
                  <button
                    onClick={() => deleteAction(action.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-700 hover:text-red-500 transition-all p-1"
                    title="Delete action"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                  <button type="button" onClick={() => toggleAction(action.id)} className="p-1 text-slate-600 hover:text-white transition-colors">
                    <svg className={`w-4 h-4 transition-transform ${collapsed ? '-rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </div>
              </div>

              {/* EXPANDED DETAIL */}
              {!collapsed && (
                <div className="px-12 pb-6 pt-2 border-t border-slate-800/50 bg-slate-900/10 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="grid grid-cols-3 gap-8 mb-4">
                    <div>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1 block">CREATED</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{action.createdAt}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1 block">DUE</span>
                      <span className={`text-[10px] font-black uppercase ${isCritical ? 'text-red-500' : 'text-slate-400'}`}>
                        {action.dueDate || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1 block">STATUS</span>
                      <span className="text-[10px] font-black uppercase" style={{ color: sc.color }}>{sc.label}</span>
                    </div>
                  </div>

                  {/* Notes / Description */}
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">NOTES</span>
                      {!isEditingThis && (
                        <button onClick={() => setEditingDesc(action.id)} className="text-[9px] font-black text-hc-teal-light uppercase tracking-widest hover:underline">
                          {action.description ? 'EDIT' : '+ ADD'}
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
                          className="w-full bg-slate-900 border border-hc-teal/40 px-4 py-3 text-[11px] text-slate-300 font-mono focus:outline-none resize-none"
                          placeholder="Context, evidence, links..."
                        />
                        <div className="text-[9px] text-slate-600 uppercase tracking-widest">Click outside to save</div>
                      </div>
                    ) : action.description ? (
                      <p className="text-[11px] text-slate-400 font-mono leading-relaxed">{action.description}</p>
                    ) : (
                      <span className="text-[10px] text-slate-700 italic">No notes added</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center opacity-30 border border-dashed border-slate-800 py-32">
            <div className="text-5xl mb-6">🎯</div>
            <div className="text-xl font-black text-white mb-2 uppercase tracking-tight">All Clear</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-[0.3em]">No actions matching this filter</div>
          </div>
        )}
      </div>
    </div>
  );
}
