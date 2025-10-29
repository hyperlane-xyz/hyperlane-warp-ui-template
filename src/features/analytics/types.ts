import { TokenStandard } from '@hyperlane-xyz/sdk';

import { ProtocolType } from '@hyperlane-xyz/utils';

export enum EVENT_NAME {
  CHAIN_SELECTED = 'Chain Selected',
  TOKEN_SELECTED = 'Token Selected',
  TRANSACTION_SUBMITTED = 'Transaction Submitted',
  TRANSACTION_SUBMISSION_FAILED = 'Transaction Submission Failed',
  WALLET_CONNECTION_INITIATED = 'Wallet Connection Initiated',
  WALLET_CONNECTED = 'Wallet Connected',
}

export type AllowedPropertyValues = string | number | boolean | null;

// Define specific properties for each event (max 7 custom properties due to Vercel's 8 property limit, sessionId takes one slot)
export type EventProperties = {
  [EVENT_NAME.CHAIN_SELECTED]: {
    chainType: string;
    chainId: ChainId;
    chainName: string;
    previousChainId: ChainId;
    previousChainName: string;
  };
  [EVENT_NAME.TOKEN_SELECTED]: {
    tokenSymbol: string;
    tokenAddress: string;
    standard: TokenStandard;
    origin: string;
    originChainId: ChainId;
    destination: string;
    destinationChainId: ChainId;
  };
  [EVENT_NAME.TRANSACTION_SUBMITTED]: {
    chains: string;
    tokenAddress: string;
    tokenSymbol: string;
    amount: string;
    walletAddress: string;
    transactionHash: string;
    recipient: string;
  };
  [EVENT_NAME.WALLET_CONNECTION_INITIATED]: {
    protocol: ProtocolType;
  };
  [EVENT_NAME.WALLET_CONNECTED]: {
    protocol: ProtocolType;
    walletAddress: string;
    walletName: string;
  };
  [EVENT_NAME.TRANSACTION_SUBMISSION_FAILED]: {
    chains: string;
    tokenAddress: string;
    tokenSymbol: string;
    amount: string;
    walletAddress: string | null;
    recipient: string;
    error: string;
  };
};
