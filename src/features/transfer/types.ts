import type { Route } from '../tokens/routes/types';


export interface TransferFormValues {
  originCaip2Id: Caip2Id;
  destinationCaip2Id: Caip2Id;
  amount: string;
  tokenAddress: Address;
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
  date?: number;
}