import type { Address, ChainId } from '@hyperlane-xyz/utils';

export enum MessageStatus {
  Unknown = 'unknown',
  Pending = 'pending',
  Delivered = 'delivered',
  Failing = 'failing',
}

export interface MessageTxStub {
  timestamp: number;
  hash: string;
  from: Address;
  to: Address;
}

export interface WarpTransferInfo {
  recipient: Address; // Actual recipient from message body
  amount: string; // Raw amount from message body (needs decimals for display)
}

export interface MessageStub {
  status: MessageStatus;
  id: string; // Database id
  msgId: string; // Message hash
  nonce: number;
  sender: Address; // Warp route address (contract)
  recipient: Address; // Warp route address (contract)
  originChainId: ChainId;
  originDomainId: number;
  destinationChainId: ChainId;
  destinationDomainId: number;
  origin: MessageTxStub;
  destination?: MessageTxStub;
  warpTransfer?: WarpTransferInfo; // Parsed from message body
}
