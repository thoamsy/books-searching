import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface QueryErrorBoundaryProps {
  fallback: (props: { error: Error; reset: () => void }) => ReactNode;
  children: ReactNode;
}

interface QueryErrorBoundaryState {
  error: Error | null;
}

export class QueryErrorBoundary extends Component<QueryErrorBoundaryProps, QueryErrorBoundaryState> {
  state: QueryErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("QueryErrorBoundary:", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return this.props.fallback({ error: this.state.error, reset: this.reset });
    }
    return this.props.children;
  }
}
