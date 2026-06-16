import { useReadiness } from '../api/hooks';
import { useBootstrapTokens } from './tokens/hooks';

// Background prefetch of the engine's /readyz + /v1/chains + featured
// tokens. Mounted in HomeView so swap-capable routes find a warm cache.
// Non-blocking: does not gate render, has no UI of its own.
export function useEngineBootstrap(): void {
  useReadiness();
  useBootstrapTokens();
}
