import { Component } from 'react';

import { logger } from '../../utils/logger';

interface ErrorBoundaryState {
  error: any;
  errorInfo: any;
}

export class ErrorBoundary extends Component<any, ErrorBoundaryState> {
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
      const details = errorInfo.message || JSON.stringify(errorInfo);
      // TODO
      return <div>{details}</div>;
    }
    return this.props.children;
  }
}
