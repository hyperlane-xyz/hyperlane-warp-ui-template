export interface SwapFormValues {
  originChainId: number;
  destinationChainId: number;
  originTokenAddress: string;
  destinationTokenAddress: string;
  amount: string;
}

export interface SwapToken {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  chainId: number;
}

export enum SwapStatus {
  Idle = 'idle',
  FetchingQuote = 'fetching-quote',
  ReviewMode = 'review',
  PostingCommitment = 'posting-commitment',
  Approving = 'approving',
  Signing = 'signing',
  Confirming = 'confirming',
  Bridging = 'bridging',
  Executing = 'executing',
  Complete = 'complete',
  Failed = 'failed',
}

export interface SwapQuote {
  originSwapRate: string;
  bridgeFee: string;
  destinationSwapRate: string;
  estimatedOutput: string;
  minimumReceived: string;
  slippage: number;
}

export type IcaTransactionStatus =
  | 'idle'
  | 'building'
  | 'signing'
  | 'confirming'
  | 'complete'
  | 'failed';
