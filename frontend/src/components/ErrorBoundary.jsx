import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error(`[ErrorBoundary] Component Crash:`, {
      component: this.props.name || 'Component',
      reason: error.message,
      stack: error.stack,
      info: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px 24px',
          textAlign: 'center',
          maxWidth: '480px',
          margin: '40px auto',
          background: 'var(--bg-secondary, #1e293b)',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
          borderRadius: '16px',
          boxShadow: 'var(--shadow-lg)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <span style={{ color: '#ef4444', fontSize: '32px', fontWeight: 'bold' }}>!</span>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text, #ffffff)', margin: '0 0 8px 0' }}>
            Support Center temporarily unavailable.
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary, #94a3b8)', margin: '0 0 20px 0' }}>
            An unexpected error occurred. Please try refreshing the page or try again later.
          </p>
          {this.props.showDetails && this.state.error && (
            <pre style={{
              textAlign: 'left',
              background: 'var(--bg-tertiary, #0f172a)',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '11px',
              color: '#ef4444',
              overflowX: 'auto',
              maxHeight: '150px'
            }}>
              {this.state.error.toString()}
              {this.state.errorInfo?.componentStack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
