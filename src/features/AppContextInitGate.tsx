import { SpinnerIcon, useTimeout } from '@hyperlane-xyz/widgets';
import { PropsWithChildren, useState } from 'react';

import { Color } from '../styles/Color';
import { useReadyMultiProvider } from './chains/hooks';

const INIT_TIMEOUT = 10_000; // 10 seconds

// Delay rendering children until engine-supported chain metadata is ready.
export function AppContextInitGate({ children }: PropsWithChildren<unknown>) {
  const isAppContextReady = !!useReadyMultiProvider();

  const [isTimedOut, setIsTimedOut] = useState(false);
  useTimeout(() => setIsTimedOut(true), INIT_TIMEOUT);

  if (!isAppContextReady) {
    if (isTimedOut) {
      // Fallback to outer error boundary
      throw new Error(
        'Failed to initialize app context. Please check your registry URL and connection status.',
      );
    } else {
      return (
        <div className="warp-init-gate flex h-screen items-center justify-center">
          <SpinnerIcon width={80} height={80} color={Color.primary['500']} />
        </div>
      );
    }
  }

  return <>{children}</>;
}
