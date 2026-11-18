import { Component, lazy, StrictMode, Suspense } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
const Page = lazy(() =>
  location.pathname === '/editor' ? import('./App.tsx') : import('./ui/history/ProjectLibrary.tsx'),
);

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  override state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }
  override render() {
    if (this.state.error)
      return (
        <main className="start-error" role="alert">
          <p>画面の処理を停止しました。{this.state.error}</p>
          <button type="button" onClick={() => location.reload()}>
            再読み込み
          </button>
        </main>
      );
    return this.props.children;
  }
}
const root = document.getElementById('root');
if (!root) throw new Error('root element missing');
createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense fallback={null}>
        <Page />
      </Suspense>
    </ErrorBoundary>
  </StrictMode>,
);
