import React from 'react';
export class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null as any };
  }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return <div className="p-4 text-red-500 font-mono text-xs">{this.state.error?.stack || this.state.error?.message}</div>;
    return this.props.children;
  }
}
