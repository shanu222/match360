import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('[ui] crashed', error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-extrabold">Something went wrong</h1>
        <p className="max-w-sm text-ink-400">An unexpected error happened. Reloading usually fixes it — your data is safe.</p>
        <button className="btn btn-primary" onClick={() => (window.location.href = '/')}>
          Reload Match360
        </button>
      </div>
    );
  }
}
