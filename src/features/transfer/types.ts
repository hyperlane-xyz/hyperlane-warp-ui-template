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

export enum IgpTokenType {
  NativeSeparate = 'native-separate', // Paying with origin chain native token
  NativeCombined = 'native-combined', // Both igp fees and transfer token are native
  TokenSeparate = 'token-separate', // Paying with a different non-native token
  TokenCombined = 'token-combined', // Paying with the same token being transferred
}

export interface IgpQuote {
  type: IgpTokenType;
  amount: string;
  weiAmount: string;
  originCaip2Id: ChainCaip2Id;
  destinationCaip2Id: ChainCaip2Id;
  token: {
    tokenCaip19Id: TokenCaip19Id;
    symbol: string;
    decimals: number;
  };
}
