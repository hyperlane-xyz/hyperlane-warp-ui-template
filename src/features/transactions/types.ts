import { Route } from '../tokens/routes';
import { TransferFormValues } from '../transfer/types';

export enum TransactionType {
  Erc20Approve = 'erc20Approve',
  HypErc20Transfer = 'hypErc20Transfer',
}

export enum TransactionStatus {
  Preparing = 'preparing',
  Signing = 'signing',
  Sending = 'sending',
  Confirmed = 'confirmed',
  Failed = 'failed',
}

export interface TransactionContext {
  status: TransactionStatus;
  route: Route;
  params: TransferFormValues;
  txHash?: string;
}
