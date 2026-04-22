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
    <div className="h-screen overflow-hidden flex flex-col bg-slate-950 animate-in fade-in duration-700">
      
      {/* ── COMMAND HEADER ── */}
      <div className="shrink-0 border-b border-slate-800 bg-slate-900/50 px-8 py-6 flex items-center justify-between gap-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter mb-1 uppercase">COMMAND VECTORS</h1>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-hc-teal-light tracking-[0.2em] uppercase">ACCORDANCE & OBJECTIVE TRACKING</span>
            <div className="h-3 w-px bg-slate-800" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{actions.length} ACTIVE VECTORS</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-800 bg-slate-900/50 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <svg className={`w-3 h-3 transition-transform ${allCollapsed ? '-rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            {allCollapsed ? 'EXPAND ALL' : 'COLLAPSE ALL'}
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className={`flex items-center gap-2 px-6 py-2.5 border transition-all ${showAdd ? 'bg-slate-800 border-slate-700 opacity-50' : 'bg-hc-teal/10 border-hc-teal/40 text-hc-teal-light hover:bg-hc-teal/20 shadow-[0_0_15px_rgba(20,184,166,0.1)]'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">NEW COMMAND VECTOR</span>
          </button>
        </div>
      </div>

      {/* ── VECTOR DEPLOYMENT MATRIX (ADD FORM) ── */}
      {showAdd && (
        <div className="shrink-0 border-b border-slate-800 bg-slate-900/10 p-8 animate-in slide-in-from-top-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="md:col-span-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block">VECTOR OBJECTIVE</label>
              <input value={newAction.title} onChange={e => setNewAction({ ...newAction, title: e.target.value })} placeholder="SPECIFY OBJECTIVE..." className="w-full bg-slate-900 border border-slate-800 px-4 py-3 text-sm text-white focus:outline-none focus:border-hc-teal/50 font-medium" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block">OPERATIONAL UNIT (HOUSE)</label>
              <input value={newAction.house} onChange={e => setNewAction({ ...newAction, house: e.target.value })} placeholder="UNIT NAME..." className="w-full bg-slate-900 border border-slate-800 px-4 py-3 text-sm text-white focus:outline-none focus:border-hc-teal/50 font-medium" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block">ASSIGNED COMMAND</label>
              <input value={newAction.owner} onChange={e => setNewAction({ ...newAction, owner: e.target.value })} placeholder="PERSONNEL..." className="w-full bg-slate-900 border border-slate-800 px-4 py-3 text-sm text-white focus:outline-none focus:border-hc-teal/50 font-medium" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block">PRIORITY VECTOR</label>
              <select value={newAction.priority} onChange={e => setNewAction({ ...newAction, priority: e.target.value as ActionPriority })} className="w-full bg-slate-900 border border-slate-800 px-4 py-3 text-[11px] font-black text-white focus:outline-none focus:border-hc-teal/50 appearance-none uppercase tracking-widest">
                <option value="critical">CRITICAL (IMMEDIATE)</option>
                <option value="high">HIGH (TODAY)</option>
                <option value="medium">MEDIUM (ROUTINE)</option>
                <option value="low">LOW (BACKLOG)</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block">TARGET DEADLINE</label>
              <input type="date" value={newAction.dueDate} onChange={e => setNewAction({ ...newAction, dueDate: e.target.value })} className="w-full bg-slate-900 border border-slate-800 px-4 py-3 text-sm text-white focus:outline-none focus:border-hc-teal/50 font-medium invert hue-rotate-180" />
            </div>
          </div>
          <div className="flex justify-end gap-4">
            <button onClick={() => setShowAdd(false)} className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-[0.2em] transition-colors">ABORT</button>
            <button onClick={addAction} className="px-10 py-3 bg-hc-teal/10 border border-hc-teal/40 text-hc-teal-light text-[10px] font-black uppercase tracking-[0.25em] hover:bg-hc-teal/20 transition-all">DEPLOY VECTOR</button>
          </div>
        </div>
      )}

      {/* ── VECTOR FILTER STRIP ── */}
      <div className="shrink-0 bg-slate-950 border-b border-slate-800 px-8 py-3 flex items-center gap-3">
        {(['all', 'open', 'in_progress', 'blocked', 'completed'] as FilterStatus[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-5 py-1.5 border transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-3 ${
              filter === f 
                ? 'bg-slate-800 border-slate-700 text-white' 
                : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {f === 'all' ? 'ENTIRE FEED' : (STATUS_CONFIG[f]?.label || f).toUpperCase()}
            <span className={`tabular-nums opacity-60 ${filter === f ? 'text-hc-teal-light' : 'text-slate-600'}`}>{counts[f]}</span>
          </button>
        ))}
      </div>

      {/* ── COMMAND QUEUE ── */}
      <div className="flex-1 overflow-y-auto p-8 space-y-2 scrollbar-thin bg-slate-950/20">
        {sorted.map((action, idx) => {
          const sc = STATUS_CONFIG[action.status] || { label: action.status, color: '#94a3b8' };
          const pc = PRIORITY_CONFIG[action.priority] || { label: action.priority, color: '#94a3b8' };
          const isCritical = action.priority === 'critical' && action.status !== 'completed';
          const collapsed = isActionCollapsed(action.id);

          return (
            <div key={action.id} className={`border transition-all duration-300 group animate-in slide-in-from-left-4
              ${action.status === 'completed' ? 'opacity-40 grayscale hover:opacity-70' : ''}
              ${isCritical ? 'border-red-900 bg-red-950/10' : 'border-slate-800 bg-slate-900/30 hover:border-slate-700'}`}
              style={{ animationDelay: `${idx * 40}ms` }}>
              
              {/* VECTOR ROW */}
              <div className="flex items-center gap-6 px-6 py-4">
                {/* STATUS INDICATOR */}
                <button
                  onClick={(e) => { e.stopPropagation(); cycleStatus(action); }}
                  className={`w-5 h-5 flex items-center justify-center shrink-0 border-2 transition-all hover:scale-110 active:scale-95
                    ${action.status === 'completed' ? 'bg-green-600 border-green-600' : 'border-slate-700 hover:border-hc-teal-light bg-slate-900'}`}
                >
                  {action.status === 'completed' ? (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  ) : action.status === 'in_progress' ? (
                    <div className="w-1.5 h-1.5 bg-amber-500 animate-pulse" />
                  ) : null}
                </button>

                {/* OBJECTIVE TITLE */}
                <button type="button" onClick={() => toggleAction(action.id)} className="flex-1 min-w-0 text-left flex items-center gap-4 cursor-pointer">
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

                {/* TELEMETRY */}
                <div className="flex items-center gap-6 shrink-0">
                   <div className="hidden md:flex flex-col items-end">
                      <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">ASSIGNED COMMAND</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{action.owner}</span>
                   </div>
                   <div className="hidden md:flex flex-col items-end">
                      <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">OPERATIONAL UNIT</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{action.house}</span>
                   </div>
                   <div className="w-24">
                    <span className={`text-[10px] font-black uppercase tracking-widest block text-center border-l border-slate-800`}>
                      {sc.label}
                    </span>
                   </div>
                   <button type="button" onClick={() => toggleAction(action.id)} className="p-1 text-slate-600 hover:text-white transition-colors">
                    <svg className={`w-4 h-4 transition-transform ${collapsed ? '-rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </div>
              </div>

              {/* VECTOR DETAIL EXPANSION */}
              {!collapsed && (
                <div className="px-12 pb-6 pt-2 border-t border-slate-800/50 bg-slate-900/10">
                  <div className="grid grid-cols-3 gap-8">
                    <div>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block">IDENTIFIER</span>
                      <span className="font-mono text-[10px] text-slate-400">VECTOR_{action.id.toUpperCase().slice(0, 8)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block">ESTABLISHED</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{action.createdAt}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block">TARGET</span>
                      <span className={`text-[10px] font-black uppercase ${isCritical ? 'text-red-500' : 'text-slate-400'}`}>
                        {action.dueDate || 'UNDEFINED'}
                      </span>
                    </div>
                  </div>
                  {action.tags.length > 0 && (
                    <div className="flex gap-2 mt-6">
                      {action.tags.map(tag => (
                        <span key={tag} className="text-[9px] font-black px-3 py-1 bg-slate-800 text-slate-400 uppercase tracking-widest">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-30 grayscale border border-dashed border-slate-800 py-32">
            <div className="text-5xl mb-6">🎯</div>
            <div className="text-xl font-black text-white mb-2 uppercase tracking-tight">QUEUES NOMINAL</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-[0.3em]">No active vectors matching parameters</div>
          </div>
        )}
      </div>
    </div>
  );
}
