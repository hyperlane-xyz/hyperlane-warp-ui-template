import Image from 'next/image';
import { Component } from 'react';

import { links } from '../../consts/links';
import ErrorIcon from '../../images/icons/error-circle.svg';
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
      return (
        <div className="w-screen h-screen flex items-center justify-center bg-gray-50">
          <div className="flex flex-col items-center">
            <Image src={ErrorIcon} width={80} height={80} alt="" />
            <h1 className="mt-5 text-lg">Fatal Error Occurred</h1>
            <div className="mt-5 text-sm">{details}</div>
            <a
              href={links.discord}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 text-sm"
            >
              For support, join the{' '}
              <span className="underline underline-offset-2">Hyperlane Discord</span>{' '}
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
