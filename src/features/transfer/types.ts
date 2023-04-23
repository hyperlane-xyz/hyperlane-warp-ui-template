import type { Route } from '../tokens/routes';

export interface TransferFormValues {
  originChainId: ChainId;
  destinationChainId: ChainId;
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
}
