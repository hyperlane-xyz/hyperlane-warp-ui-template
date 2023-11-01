import type { Route } from '../tokens/routes/types';

export interface TransferFormValues {
  originCaip2Id: ChainCaip2Id;
  destinationCaip2Id: ChainCaip2Id;
  tokenCaip19Id: TokenCaip19Id;
  amount: string;
  recipientAddress: Address;
}

export enum TransferStatus {
  Preparing = 'preparing',
  CreatingApprove = 'creating-approve',
  SigningApprove = 'signing-approve',
  ConfirmingApprove = 'confirming-approve',
  CreatingTransfer = 'creating-transfer',
  SigningTransfer = 'signing-transfer',
  ConfirmingTransfer = 'confirming-transfer',
  ConfirmedTransfer = 'confirmed-transfer',
  Delivered = 'delivered',
  Failed = 'failed',
}

export const SentTransferStatuses = [TransferStatus.ConfirmedTransfer, TransferStatus.Delivered];

// Statuses considered not pending
export const FinalTransferStatuses = [...SentTransferStatuses, TransferStatus.Failed];

export interface TransferContext {
  status: TransferStatus;
  route: Route;
  params: TransferFormValues;
  originTxHash?: string;
  msgId?: string;
  timestamp: number;
  activeAccountAddress: Address;
}
