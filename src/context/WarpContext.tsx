import { useQuery } from '@tanstack/react-query';
import { PropsWithChildren } from 'react';

import { Spinner } from '../components/animation/Spinner';

import { initWarpContext } from './context';

export function WarpContext({ children }: PropsWithChildren<unknown>) {
  const {
    data: warpContext,
    isError,
    isLoading,
  } = useQuery({
    queryKey: ['warpContext'],
    queryFn: initWarpContext,
    retry: 2,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  if (isError)
    // Fallback to outer error boundary
    throw new Error(
      'Failed to initialize warp context. Please check your registry URL and connection status.',
    );

  if (isLoading || !warpContext)
    return (
      <div className="flex items-center justify-center h-screen bg-blue-500">
        <Spinner classes="opacity-50" white />
      </div>
    );

  return <>{children}</>;
}
