import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    // Auto-clear corrupt localStorage keys on first catch — preserves week data
    try {
      localStorage.removeItem('hazelcare-ops');
      localStorage.removeItem('hc_current_page');
      localStorage.removeItem('hc-registered-sessions');
      localStorage.removeItem('hc-entry-store-v3');
      indexedDB.deleteDatabase('hazel-care-ops');
    } catch { /* ignore */ }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-hc-bg flex items-center justify-center p-10 font-sans">
          <div className="hc-clay-raised p-12 max-w-md w-full text-center space-y-6 border border-flag-red/20">
            <div className="w-16 h-16 bg-flag-red/10 rounded-2xl flex items-center justify-center text-flag-red mx-auto animate-pulse">
              <AlertTriangle size={32} />
            </div>
            <div>
              <h1 className="text-xl font-black text-hc-text uppercase tracking-tighter">System Recovery Mode</h1>
              <p className="text-[11px] font-bold text-hc-muted uppercase tracking-widest mt-2 leading-relaxed">
                State reset complete. Reload to resume.
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 rounded-xl btn-tactical flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] shadow-xl"
            >
              <RefreshCw size={14} className="animate-spin-slow" />
              Reload System
            </button>
            <p className="text-[9px] font-black text-hc-muted uppercase opacity-40">Ops · Safe Mode Active</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
