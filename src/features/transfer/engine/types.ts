import type { QuoteResponse, RouteResponse } from '../../api/types';

export type TransferMessageLabel = 'warp' | 'bridge' | 'commit' | 'reveal';

export interface LabeledMsgId {
  msgId: string;
  label: TransferMessageLabel;
}

export interface TransferHistoryTokenMeta {
  symbol: string;
  decimals: number;
  chainName: string;
  logoURI?: string;
}

export interface TransferDestinationOutcome {
  bridgeToken: string;
  dstToken: string;
  dstIsNative?: boolean;
}

// ── Persisted/in-memory transfer history ──────────────────────────────────

// Status of a single submitted transfer. Used by TransferDetailsModal to drive
// step-by-step progress UI and by useTransfer to drive the broadcast pipeline.
export enum TransferStatus {
  Preparing = 'preparing',
  CreatingTxs = 'creating-txs',
  SigningApprove = 'signing-approve',
  ConfirmingApprove = 'confirming-approve',
  SigningTransfer = 'signing-transfer',
  ConfirmingOrigin = 'confirming-origin',
  Bridging = 'bridging',
  ConfirmingDestination = 'confirming-destination',
  ConfirmedDestination = 'confirmed-destination',
  // Origin tx confirmed and cross-chain delivery completed, but destination execution
  // reverted — funds are sitting in the user's ICA on the dest chain.
  DestTransferFailed = 'dest-transfer-failed',
  // Fallback sub-plan swept the intermediate token to recipient automatically.
  FailedRecovered = 'failed-recovered',
  // REVEAL delivered but both transfer and fallback sub-plans reverted — funds stranded in ICA.
  DestFailed = 'dest-failed',
  Failed = 'failed',
}

export const FinalTransferStatuses = [
  TransferStatus.ConfirmedDestination,
  TransferStatus.DestTransferFailed,
  TransferStatus.FailedRecovered,
  TransferStatus.DestFailed,
  TransferStatus.Failed,
];

export interface TransferHistoryItem {
  status: TransferStatus;
  timestamp: number;
  srcChain: number;
  dstChain: number;
  srcToken: string;
  dstToken: string;
  srcTokenMeta?: TransferHistoryTokenMeta;
  dstTokenMeta?: TransferHistoryTokenMeta;
  amountIn: string;
  amountOut: string;
  sender: string;
  recipient: string;
  originTxHash?: string;
  destinationTxHash?: string;
  destinationOutcome?: TransferDestinationOutcome;
  msgIds?: LabeledMsgId[];
  originBlockNumber?: number;
  /** Unix seconds when origin tx was confirmed and delivery polling started. */
  originTxTimestamp?: number;
  // pending_swap PDA address for EVM→Solana routes with a destination swap.
  // Set at quote time from callCommitment.ccs.body.revealAccounts[0].pubkey.
  // When this account is closed (null) on Solana, the dest swap has completed.
  solanaDestSwapPda?: string;
}

// ── Form values ──────────────────────────────────────────────────────

// amount is a user-typed string — parsed to bigint at quote time so we
// don't lose decimal precision early.
export interface TransferFormValues {
  srcChain: number | null;
  dstChain: number | null;
  srcToken: string;
  dstToken: string;
  amount: string;
  recipient: string;
  slippageBps: number;
}

// ── Quote augmentation ───────────────────────────────────────────────

// A single fee component, attributable to a specific token. Engine emits
// these per cross-chain step: the route fee (in the step's `asset`), IGP
// (in `step.fee.igpToken`), any origin network fee/rent in native tokens,
// and the frontend's source transaction gas estimate.
// Origin chain + token address let consumers resolve decimals and symbol.
export interface FeeComponent {
  category: 'bridge' | 'igp' | 'network' | 'localGas';
  amount: bigint;
  chainId: number;
  tokenAddress: string; // 0x0…0 for native (when igpToken === native)
  /** The fee is displayed, but already funded by the bridge step's amountIn. */
  includedInAmountIn?: boolean;
}

export interface FeeBreakdown {
  components: FeeComponent[];
  // Gas units per chain — kept for forward-compat (native-price feed
  // turns these into value). Not rendered today.
  originGas: bigint;
  destGas: bigint;
}

export interface AugmentedRoute {
  raw: RouteResponse;
  feeBreakdown: FeeBreakdown;
  // True when the engine route has deterministic output and no slippage-derived
  // minimum to show.
  hasFixedOutput: boolean;
}

export interface AugmentedQuote {
  raw: QuoteResponse;
  routes: AugmentedRoute[];
  expiresAt: number;
}
