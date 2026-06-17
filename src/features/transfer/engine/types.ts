import type { QuoteResponse, RouteResponse } from '../../api/types';

export type TransferMessageLabel = 'warp' | 'commit' | 'reveal';

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
  // Origin tx confirmed and bridge delivered, but the destination execution
  // reverted — funds are sitting in the user's ICA on the dest chain.
  DestTransferFailed = 'dest-transfer-failed',
  // Fallback sub-plan swept bridge token to recipient automatically.
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
  /** Unix seconds when the origin tx was confirmed and bridge polling started. */
  originTxTimestamp?: number;
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
// these per bridge step: one for the bridge fee (in the step's `asset`)
// and one for the IGP (in `step.fee.igpToken`, which can be native or an
// ERC20). Origin/dest chain + token address let consumers resolve
// decimals and symbol from the token map.
export interface FeeComponent {
  category: 'bridge' | 'igp';
  amount: bigint;
  chainId: number;
  tokenAddress: string; // 0x0…0 for native (when igpToken === native)
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
  // True when every step is a bridge step (no AMM legs). Used to suppress
  // slippage-derived UI (Min received) since the delivered amount is
  // deterministic.
  isBridgeOnly: boolean;
}

export interface AugmentedQuote {
  raw: QuoteResponse;
  routes: AugmentedRoute[];
  expiresAt: number;
}
