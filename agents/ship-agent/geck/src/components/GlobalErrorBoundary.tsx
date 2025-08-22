import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Global error caught:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1a1a',
          color: '#ffffff',
          fontFamily: 'monospace',
          padding: '2rem',
        }}>
          <div style={{
            maxWidth: '600px',
            textAlign: 'center',
          }}>
            <h1 style={{
              fontSize: '2rem',
              marginBottom: '1rem',
              color: '#ff6b6b',
            }}>
              SYSTEM ERROR
            </h1>
            
            <p style={{
              fontSize: '1.1rem',
              marginBottom: '2rem',
              color: '#aaa',
            }}>
              An unexpected error has occurred. The application has encountered a problem and needs to restart.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={{
                textAlign: 'left',
                marginBottom: '2rem',
                padding: '1rem',
                backgroundColor: '#2a2a2a',
                borderRadius: '8px',
                border: '1px solid #444',
              }}>
                <summary style={{
                  cursor: 'pointer',
                  marginBottom: '0.5rem',
                  color: '#ff9999',
                }}>
                  Error Details (Development Only)
                </summary>
                <pre style={{
                  fontSize: '0.875rem',
                  overflow: 'auto',
                  maxHeight: '300px',
                  color: '#ccc',
                }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center',
            }}>
              <button
                onClick={this.handleReset}
                style={{
                  padding: '0.75rem 2rem',
                  fontSize: '1rem',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#45a049';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#4CAF50';
                }}
              >
                RESTART APPLICATION
              </button>
              
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '0.75rem 2rem',
                  fontSize: '1rem',
                  backgroundColor: '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#555';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#666';
                }}
              >
                REFRESH PAGE
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}