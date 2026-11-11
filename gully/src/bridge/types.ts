import type { Address, Hash } from 'viem';

import type { ChainKey } from '../config/chains';

export type RouteKind = 'fast' | 'canonical';
export type Direction = 'deposit' | 'withdraw'; // deposit: Arbitrum Sepolia -> GullyChain

export interface QuoteRequest {
  kind: RouteKind;
  direction: Direction;
  amount: bigint;
  /** EVM address, or a base58 Solana address when the origin is Solana */
  sender?: string;
  /** EVM address, or a base58 Solana address when the destination is Solana */
  recipient?: string;
  /** the chain on the other side of GullyChain (default Arbitrum Sepolia, the classic lanes) */
  remote?: ChainKey;
  /** Integrator address from ?ref=. The local client records it; the GullyBridgeRouter SDK pays it a fee. */
  ref?: Address;
  fastRouteId?: string;
}

export interface Fee {
  label: string;
  amount: bigint;
  symbol: string;
}

export interface StepDef {
  id: 'approve' | 'send' | 'relay' | 'deliver' | 'challenge' | 'claim';
  label: string;
  hint: string;
  chain: ChainKey;
  /** true when the user signs a transaction for this step */
  user: boolean;
}

export interface Quote {
  req: QuoteRequest;
  from: ChainKey;
  to: ChainKey;
  sendSymbol: string;
  receiveSymbol: string;
  receive: bigint;
  /** native value the origin transaction carries */
  value: bigint;
  fees: Fee[];
  etaSeconds: number;
  steps: StepDef[];
  needsApproval: boolean;
  /** decimals of what is sent / received (18 for ETH; USDC 6, SOL 9, BSC USDC 18) */
  sendDecimals: number;
  receiveDecimals: number;
  /** native gas token that pays the fees on the origin chain (ETH, tBNB, SOL) */
  gasSymbol: string;
  /** fees could not be read before signing (Solana without a connected wallet): the wallet shows them */
  feesInWallet?: boolean;
  available: boolean;
  reason?: string;
  notes: string[];
}

export type TransferStatus = 'pending' | 'sent' | 'relaying' | 'delivered' | 'challenge' | 'claimable' | 'claimed' | 'failed';

export interface TransferRecord {
  id: string;
  kind: RouteKind;
  direction: Direction;
  from: ChainKey;
  to: ChainKey;
  amount: string; // bigint as string (JSON-safe)
  sendSymbol: string;
  receiveSymbol: string;
  /** EVM address or base58 Solana address */
  sender: string;
  recipient: string;
  ref?: Address;
  /** EVM tx hash, or a base58 Solana signature */
  originTx: string;
  destTx?: string;
  claimTx?: Hash;
  messageId?: Hash; // fast: Hyperlane message id
  depositTxId?: Hash; // canonical deposit: the child-chain deposit tx hash
  position?: string; // canonical withdrawal: outbox leaf index
  createdAt: number;
  updatedAt: number;
  status: TransferStatus;
  error?: string;
  etaSeconds: number;
  /** record format: 2 since the multi-chain bridge (older records are migrated by bridge/history.ts) */
  v?: 2;
  /** route id (classic or multi-chain) */
  routeId?: string;
  /** decimals of `amount` and of what arrives */
  decimals?: number;
  receiveDecimals?: number;
  /** destination block when the transfer was sent: where to look for the delivery (Mailbox ProcessId) */
  destFromBlock?: string;
  /** GullyGasDrop: expected on this transfer, then received */
  gasDrop?: 'expected' | 'received';
}

export interface ActivityItem {
  key: string;
  kind: RouteKind;
  direction: Direction;
  amount: bigint;
  symbol: string;
  tx: Hash;
  chain: ChainKey;
  block: bigint;
  time?: number;
  who?: Address;
}

export interface StepUpdate {
  step: StepDef['id'];
  state: 'active' | 'done' | 'error';
  tx?: string;
  message?: string;
}
