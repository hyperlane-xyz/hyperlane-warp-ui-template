import type { Token } from '@hyperlane-xyz/sdk';

import type { UiToken } from '../../swap/tokens/types';

export interface UnifiedToken {
  key: string;
  chainName: string;
  chainId: number | undefined;
  addressOrDenom: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  coinGeckoId?: string;
  isNative: boolean;
  bridgeToken?: Token;
  bridgeRouteTokens?: Token[];
  swapToken?: UiToken;
  capabilities: {
    bridge: boolean;
    swap: boolean;
  };
}
