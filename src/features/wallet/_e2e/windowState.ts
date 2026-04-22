import { isE2EMode } from './isE2E';

export interface CapturedEvmTx {
  chainId: number;
  to?: `0x${string}`;
  data?: `0x${string}`;
  value?: string;
  from?: `0x${string}`;
}

export interface CapturedSolanaTx {
  feePayer?: string;
  serializedBase64: string;
  programIds: string[];
}

export interface CapturedCosmosTx {
  chainId: string;
  signerAddress: string;
  typeUrls: string[];
  messagesJson: string;
}

export interface E2ETokenSnapshot {
  key: string;
  chain: string;
  symbol: string;
  standard: string;
  addressOrDenom: string;
  collateralAddressOrDenom?: string;
  // Keys of tokens this origin routes to directly. Distinct from
  // `collateralGroups` (which dedupe by collateral), so a test can prove a
  // real direct route rather than a same-symbol coincidence.
  connectionKeys: string[];
}

export interface WarpE2EState {
  readyAt: number;
  evmTxs: CapturedEvmTx[];
  solanaTxs: CapturedSolanaTx[];
  cosmosTxs: CapturedCosmosTx[];
  // Flips true once the async WarpCore runtime has replaced the synchronous
  // TokenMetadata entries in the store. Reads that depend on real Token
  // instances (e.g. useBalance calling token.getBalance) can gate on this.
  isRuntimeReady?: boolean;
  // Lazily-populated snapshot of the runtime Token map (key → identity +
  // direct connections). Populated by markE2ERuntimeReady so tests can
  // assert on per-route router/mint identity without needing to reach the
  // review panel (which requires full validation-call mocking).
  tokens?: E2ETokenSnapshot[];
}

declare global {
  interface Window {
    __WARP_E2E__?: WarpE2EState;
  }
}

export function initE2EStateIfEnabled(): void {
  if (!isE2EMode()) return;
  if (typeof window === 'undefined') return;
  if (window.__WARP_E2E__) return;
  window.__WARP_E2E__ = {
    readyAt: Date.now(),
    evmTxs: [],
    solanaTxs: [],
    cosmosTxs: [],
  };
}

// Note: there is intentionally no `pushEvmTx` helper — EVM tx payloads are
// captured Node-side via the page.route intercept in tests/e2e-wallet/helpers/
// evmRpc.ts. The `evmTxs` array on the window state is reserved for a future
// connector-level capture path.

export function pushSolanaTx(tx: CapturedSolanaTx): void {
  if (window.__WARP_E2E__) window.__WARP_E2E__.solanaTxs.push(tx);
}

export function pushCosmosTx(tx: CapturedCosmosTx): void {
  if (window.__WARP_E2E__) window.__WARP_E2E__.cosmosTxs.push(tx);
}

export function markE2ERuntimeReady(buildTokens?: () => E2ETokenSnapshot[] | undefined): void {
  if (typeof window === 'undefined') return;
  if (!window.__WARP_E2E__) return;
  window.__WARP_E2E__.isRuntimeReady = true;
  // Snapshot producer is lazy so the (non-trivial) iteration over route
  // tokens + their connections only runs when E2E mode is actually active.
  // In prod the window hook is absent and we bail above before invoking.
  const snap = buildTokens?.();
  if (snap) window.__WARP_E2E__.tokens = snap;
}
