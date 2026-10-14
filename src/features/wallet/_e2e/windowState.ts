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

export interface WarpE2EState {
  readyAt: number;
  evmTxs: CapturedEvmTx[];
  solanaTxs: CapturedSolanaTx[];
  cosmosTxs: CapturedCosmosTx[];
  // Flips true once engine-supported chain metadata is loaded.
  isRuntimeReady?: boolean;
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
  if (typeof window === 'undefined') return;
  if (window.__WARP_E2E__) window.__WARP_E2E__.solanaTxs.push(tx);
}

export function pushCosmosTx(tx: CapturedCosmosTx): void {
  if (typeof window === 'undefined') return;
  if (window.__WARP_E2E__) window.__WARP_E2E__.cosmosTxs.push(tx);
}

export function markE2ERuntimeReady(): void {
  if (typeof window === 'undefined') return;
  if (!window.__WARP_E2E__) return;
  window.__WARP_E2E__.isRuntimeReady = true;
}
