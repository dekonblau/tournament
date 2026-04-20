import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ManagerProvider } from './store/managerContext';
import { AppInit } from './components/AppInit';
import './index.css';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      const e = this.state.error as Error;
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', background: '#1a1e2b', color: '#f87171', minHeight: '100vh' }}>
          <div style={{ marginBottom: 8, fontWeight: 700 }}>App failed to render</div>
          <div style={{ marginBottom: 8 }}>{e.message}</div>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#94a3b8' }}>{e.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ManagerProvider>
          <AppInit />
          <App />
        </ManagerProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
