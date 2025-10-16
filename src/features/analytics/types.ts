export enum EVENT_NAME {
  CHAIN_SELECTION = 'Chain Selection',
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
  // Add more events here with their specific properties
};
