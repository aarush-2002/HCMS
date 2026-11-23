import { Component, ErrorInfo, ReactNode } from 'react';
import Button from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('HCMS Uncaught UI Error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#05070a] text-[#dfe7e0]">
          <div className="max-w-md w-full bg-[rgba(10,14,18,0.92)] border border-[rgba(223,231,224,0.16)] rounded-sm p-8 text-center backdrop-blur-md shadow-2xl flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-[#ff5a5f]/10 border border-[#ff5a5f]/30 flex items-center justify-center text-[#ff5a5f] mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h1 className="text-xl font-medium tracking-tight mb-2">Unexpected Application Error</h1>
            <p className="text-xs text-[#9aa5a0] mb-6">
              HCMS encountered a client-side exception. Your state has been preserved where possible.
            </p>

            {this.state.error && (
              <pre className="text-[11px] font-mono text-[#ff5a5f] bg-[#05070a] p-3 rounded-sm border border-[rgba(223,231,224,0.1)] mb-6 text-left w-full overflow-x-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}

            <div className="flex gap-3 w-full">
              <Button variant="ghost" fullWidth onClick={this.handleGoHome}>
                Return Home
              </Button>
              <Button variant="primary" fullWidth onClick={this.handleReload}>
                Reload App
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
