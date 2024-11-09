import { PropsWithChildren, useState } from 'react';
import { Spinner } from '../components/animation/Spinner';
import { useTimeout } from '../utils/timeout';
import { useReadyMultiProvider } from './chains/hooks';

// A wrapper app to delay rendering children until the warp context is ready
export function WarpContextInitGate({ children }: PropsWithChildren<unknown>) {
  const isWarpContextReady = !!useReadyMultiProvider();

  const [isTimedOut, setIsTimedOut] = useState(false);
  useTimeout(() => setIsTimedOut(true), 20_000);

  if (isTimedOut) {
    // Fallback to outer error boundary
    throw new Error(
      'Failed to initialize warp context. Please check your registry URL and connection status.',
    );
  }

  if (!isWarpContextReady)
    return (
      <div className="flex h-screen items-center justify-center bg-primary-500">
        <Spinner classes="opacity-50" white />
      </div>
    );

  return <>{children}</>;
}
