import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("React caught error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", color: "red", backgroundColor: "white", width: "100%", height: "100vh" }}>
          <h1>React Crashed</h1>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "12px" }}>{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// Filter out benign Vite preview iframe & WebSocket reconnection noise
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const msg = typeof reason === 'string' ? reason : reason?.message || '';
  if (msg.includes('WebSocket') || msg.includes('vite') || msg.includes('websocket')) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
