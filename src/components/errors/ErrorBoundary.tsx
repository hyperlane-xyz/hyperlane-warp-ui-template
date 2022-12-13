import { Component, PropsWithChildren } from 'react';

import { logger } from '../../utils/logger';

interface ErrorBoundaryState {
  error: any;
  errorInfo: any;
}

export class ErrorBoundary extends Component<
  PropsWithChildren<{ hideError?: boolean }>,
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  componentDidCatch(error: any, errorInfo: any) {
    this.setState({
      error,
      errorInfo,
    });
    logger.error('Error caught by error boundary', error, errorInfo);
  }

  render() {
    const errorInfo = this.state.error || this.state.errorInfo;
    if (errorInfo) {
      if (this.props.hideError) return null;
      const details = errorInfo.message || JSON.stringify(errorInfo);
      // TODO better presentation
      return <div>{details}</div>;
    }
    return this.props.children;
  }
}
