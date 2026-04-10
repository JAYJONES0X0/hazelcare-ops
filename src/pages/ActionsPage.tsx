import { useState } from 'react';
import type { Action, ActionStatus, ActionPriority } from '../lib/types';
import { uid } from '../lib/storage';
import { useCollapseStore } from '../lib/collapse-store';

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
  const { isCollapsed: isActionCollapsed, toggle: toggleAction, collapseAll: collapseAllActions, expandAll: expandAllActions, allCollapsed: allActionsCollapsed } = useCollapseStore('actions-cards', true);

  const filtered = filter === 'all' ? actions : actions.filter(a => a.status === filter);
  const sorted = [...filtered].sort((a, b) => {
    const pOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const sOrder: Record<string, number> = { blocked: 0, overdue: 0, open: 1, in_progress: 2, completed: 3 };
    return (sOrder[a.status] ?? 4) - (sOrder[b.status] ?? 4) || (pOrder[a.priority] ?? 4) - (pOrder[b.priority] ?? 4);
  });
  const actionIds = sorted.map(a => a.id);
  const allCollapsed = allActionsCollapsed(actionIds);
  function toggleAll() {
    if (allCollapsed) expandAllActions(actionIds);
    else collapseAllActions(actionIds);
  }

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
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-hc-text mb-1 tracking-tight text-shimmer">Action Tracker</h1>
          <div className="flex items-center gap-2">
            <span className="pill pill-teal text-xs uppercase tracking-[0.08em] font-bold">Action Tracker</span>
            <span className="text-hc-muted text-sm font-semibold uppercase tracking-[0.08em] ml-2">
              Track tasks and accountability
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all"
            style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',color:'#64748b'}}
          >
            <svg className="w-3 h-3 transition-transform duration-200" style={{transform: allCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            {allCollapsed ? 'Expand all' : 'Collapse all'}
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className={`flex items-center gap-2 px-6 py-3 btn-gradient rounded-xl shadow-lg transition-all ${showAdd ? 'opacity-50 grayscale' : 'hover:scale-105'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            <span className="text-sm font-bold uppercase tracking-wider">New Action</span>
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="glass border border-hc-teal/30 rounded-2xl p-6 mb-8 glow-teal animate-in slide-in-from-top-4 duration-500 shadow-2xl">
          <h3 className="section-header mb-4 text-hc-teal-light">Create New Action</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="md:col-span-2 lg:col-span-2">
              <label className="section-header text-xs mb-1.5 ml-1 block">Objective Title</label>
              <input value={newAction.title} onChange={e => setNewAction({ ...newAction, title: e.target.value })} placeholder="What needs to be done?" className="w-full bg-hc-dark/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-hc-text placeholder:text-hc-muted/40 focus:outline-none focus:border-hc-teal/50 shadow-inner" />
            </div>
            <div>
              <label className="section-header text-xs mb-1.5 ml-1 block">Location / House</label>
              <input value={newAction.house} onChange={e => setNewAction({ ...newAction, house: e.target.value })} placeholder="House name" className="w-full bg-hc-dark/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-hc-text placeholder:text-hc-muted/40 focus:outline-none focus:border-hc-teal/50 shadow-inner" />
            </div>
            <div>
              <label className="section-header text-xs mb-1.5 ml-1 block">Assigned Owner</label>
              <input value={newAction.owner} onChange={e => setNewAction({ ...newAction, owner: e.target.value })} placeholder="Carer or Manager" className="w-full bg-hc-dark/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-hc-text placeholder:text-hc-muted/40 focus:outline-none focus:border-hc-teal/50 shadow-inner" />
            </div>
            <div>
              <label className="section-header text-xs mb-1.5 ml-1 block">Priority Level</label>
              <select value={newAction.priority} onChange={e => setNewAction({ ...newAction, priority: e.target.value as ActionPriority })} className="w-full bg-hc-dark/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-hc-text focus:outline-none focus:border-hc-teal/50 shadow-inner">
                <option value="critical">Critical (Immediate)</option>
                <option value="high">High (Today)</option>
                <option value="medium">Medium (Routine)</option>
                <option value="low">Low (Backlog)</option>
              </select>
            </div>
            <div>
              <label className="section-header text-xs mb-1.5 ml-1 block">Deadline</label>
              <input type="date" value={newAction.dueDate} onChange={e => setNewAction({ ...newAction, dueDate: e.target.value })} className="w-full bg-hc-dark/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-hc-text focus:outline-none focus:border-hc-teal/50 shadow-inner" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
            <button onClick={() => setShowAdd(false)} className="px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-hc-muted hover:text-hc-text transition-colors">Cancel</button>
            <button onClick={addAction} className="px-8 py-2.5 btn-gradient rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg">Save Action</button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-8 bg-black/20 backdrop-blur-md rounded-2xl p-1.5 border border-white/5 shadow-xl w-fit">
        {(['all', 'open', 'in_progress', 'blocked', 'completed'] as FilterStatus[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] rounded-xl transition-all duration-500 ease-out active:scale-95 ${
              filter === f 
                ? 'bg-hc-teal/20 text-hc-teal-light shadow-lg border border-hc-teal/30 scale-105 z-10' 
                : 'text-hc-muted hover:text-hc-text hover:bg-white/5'
            }`}
          >
            {f === 'all' ? 'Entire Feed' : STATUS_CONFIG[f].label}
            <span className={`ml-3 px-2 py-0.5 rounded-lg tabular-nums ${filter === f ? 'bg-hc-teal/30' : 'bg-white/5 opacity-40'}`}>{counts[f]}</span>
          </button>
        ))}
      </div>

      {/* Actions list */}
      <div className="space-y-3">
        {sorted.map((action, idx) => {
          const sc = STATUS_CONFIG[action.status];
          const pc = PRIORITY_CONFIG[action.priority];
          const isCritical = action.priority === 'critical' && action.status !== 'completed';
          const collapsed = isActionCollapsed(action.id);

          return (
            <div key={action.id} className={`glass-light border transition-all duration-300 rounded-2xl overflow-hidden card-glow group animate-in slide-in-from-left-4
              ${action.status === 'completed' ? 'opacity-50 grayscale-[0.3] hover:opacity-80' : ''}
              ${isCritical ? 'border-flag-red/30 bg-flag-red/[0.02] glow-red' : 'border-white/5 hover:border-hc-teal/20'}`}
              style={{ animationDelay: `${idx * 50}ms` }}>
              {/* Always-visible header row */}
              <div className="flex items-center gap-4 px-5 py-3.5">
                {/* Status toggle */}
                <button
                  onClick={(e) => { e.stopPropagation(); cycleStatus(action); }}
                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all duration-300 hover:scale-110 active:scale-90
                    ${action.status === 'completed' ? 'bg-flag-green border-flag-green' : 'border-white/10 hover:border-hc-teal-light bg-black/20'}`}
                  style={action.status !== 'completed' ? { borderColor: sc.color + '44' } : {}}
                >
                  {action.status === 'completed' ? (
                    <svg className="w-3.5 h-3.5 text-hc-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  ) : action.status === 'in_progress' ? (
                    <div className="w-1.5 h-1.5 rounded-full bg-flag-amber animate-pulse" />
                  ) : null}
                </button>

                {/* Title + priority — click to expand/collapse */}
                <button type="button" onClick={() => toggleAction(action.id)} className="flex-1 min-w-0 text-left flex items-center gap-3 cursor-pointer">
                  <span className={`text-sm font-black tracking-tight transition-colors duration-200
                    ${action.status === 'completed' ? 'text-hc-muted line-through opacity-60' : 'text-hc-text group-hover:text-hc-teal-light'}`}>
                    {action.title}
                  </span>
                  <span className={`pill text-[9px] font-black uppercase tracking-widest shrink-0
                    ${action.priority === 'critical' ? 'pill-red animate-pulse-soft' : action.priority === 'high' ? 'pill-amber' : action.priority === 'medium' ? 'pill-blue' : 'pill-teal'}`}>
                    {pc.label}
                  </span>
                </button>

                {/* Right: status pill + chevron */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`pill text-[10px] font-black uppercase tracking-widest px-3 py-1
                    ${action.status === 'completed' ? 'pill-green opacity-60' : action.status === 'in_progress' ? 'pill-amber' : action.status === 'blocked' ? 'pill-red' : 'pill-blue'}`}>
                    {sc.label}
                  </span>
                  <button type="button" onClick={() => toggleAction(action.id)} className="w-6 h-6 flex items-center justify-center rounded-lg cursor-pointer transition-colors hover:bg-white/5">
                    <svg className="w-3.5 h-3.5 text-hc-muted/40 transition-transform duration-200" style={{transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </div>
              </div>

              {/* Collapsable detail */}
              {!collapsed && (
                <div className="px-5 pb-4 pt-0" style={{borderTop:'1px solid rgba(255,255,255,0.04)'}}>
                  <div className="flex items-center gap-5 text-[10px] font-bold uppercase tracking-[0.12em] text-hc-muted/60 mt-3">
                    <span>{action.house}</span>
                    <span className="opacity-30">·</span>
                    <span>{action.owner}</span>
                    {action.dueDate && (
                      <>
                        <span className="opacity-30">·</span>
                        <span className={isCritical ? 'text-flag-red font-black' : ''}>Due: {action.dueDate}</span>
                      </>
                    )}
                    <span className="ml-auto opacity-30 font-mono">#{action.id.slice(0, 4)}</span>
                  </div>
                  {action.tags.length > 0 && (
                    <div className="flex gap-2 mt-2.5">
                      {action.tags.map(tag => (
                        <span key={tag} className="text-[9px] font-black px-2.5 py-1 rounded-lg bg-black/40 text-hc-muted/60 border border-white/5 uppercase tracking-widest">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div className="text-center py-24 glass border border-white/5 rounded-3xl animate-in zoom-in duration-700">
            <div className="text-5xl mb-6 opacity-20">🎯</div>
            <div className="text-lg font-extrabold text-hc-text mb-2 uppercase tracking-tight">All Done</div>
            <div className="text-[10px] text-hc-muted uppercase tracking-[0.2em] font-bold">No active objectives matching these parameters</div>
          </div>
        )}
      </div>
    </div>
  );
}
