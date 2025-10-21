import { TokenStandard } from '@hyperlane-xyz/sdk';

import { ProtocolType } from '@hyperlane-xyz/utils';

export enum EVENT_NAME {
  CHAIN_SELECTION = 'Chain Selection',
  TOKEN_SELECTION = 'Token Selection',
  TRANSACTION_SUBMISSION = 'Transaction Submission',
  WALLET_CONNECTION_INITIATED = 'Wallet Connection Initiated',
  WALLET_CONNECTED = 'Wallet Connected',
}

export type AllowedPropertyValues = string | number | boolean | null;

// Define specific properties for each event (max 5 custom properties due to Vercel's 8 property limit)
// Note: sessionId, timestamp, and userAgent are automatically added (3 properties)
export type EventProperties = {
  [EVENT_NAME.CHAIN_SELECTION]: {
    chainType: string;
    chainId: ChainId;
    chainName: string;
    previousChainId: ChainId;
    previousChainName: string;
  };
  [EVENT_NAME.TOKEN_SELECTION]: {
    tokenSymbol: string;
    tokenAddress: string;
    chains: string;
    standard: TokenStandard;
  };
  [EVENT_NAME.TRANSACTION_SUBMISSION]: {
    chains: string;
    token: string;
    amount: string;
    walletAddress: string;
    transactionHash: string;
  };
  [EVENT_NAME.WALLET_CONNECTION_INITIATED]: {
    protocol: ProtocolType;
  };
  [EVENT_NAME.WALLET_CONNECTED]: {
    protocol: ProtocolType;
    walletAddress: string;
    walletName: string;
  };
};
