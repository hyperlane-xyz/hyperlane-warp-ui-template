import type { Route } from '../tokens/routes/types';

export interface TransferFormValues {
  originCaip2Id: Caip2Id;
  destinationCaip2Id: Caip2Id;
  tokenCaip19Id: Caip19Id;
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

export interface TransferContext {
  status: TransferStatus;
  route: Route;
  params: TransferFormValues;
  originTxHash?: string;
  msgId?: string;
  timestamp: number;
  activeAccountAddress: Address;
}
