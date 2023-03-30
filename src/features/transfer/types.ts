import type { Route } from '../tokens/routes';

export interface TransferFormValues {
  sourceChainId: number;
  destinationChainId: number;
  amount: string;
  tokenAddress: Address;
  recipientAddress: Address;
}

export enum TransferStatus {
  Preparing = 'preparing',
  Signing = 'signing',
  Pending = 'pending',
  Confirmed = 'confirmed',
  Delivered = 'delivered',
  Failed = 'failed',
}

export interface TransferContext {
  status: TransferStatus;
  route: Route;
  params: TransferFormValues;
  originTxHash?: string;
  msgId?: string;
}
