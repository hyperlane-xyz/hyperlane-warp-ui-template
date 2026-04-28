// Mirror of src/features/wallet/_e2e/windowState.ts types, kept in /tests so
// the test suite can type-check window.__WARP_E2E__ reads without importing
// from src (keeps test/src dep graphs clean).
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
  connectionKeys: string[];
}

export interface WarpE2EState {
  readyAt: number;
  evmTxs: CapturedEvmTx[];
  solanaTxs: CapturedSolanaTx[];
  cosmosTxs: CapturedCosmosTx[];
  isRuntimeReady?: boolean;
  tokens?: E2ETokenSnapshot[];
}
