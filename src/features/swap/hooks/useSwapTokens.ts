import { useMemo, useState } from 'react';
import { SWAP_CHAINS, SWAP_CONTRACTS } from '../swapConfig';
import { SwapToken } from '../types';

const ARBITRUM_TOKENS: SwapToken[] = [
  {
    symbol: 'ETH',
    name: 'Ether',
    address: '0x0000000000000000000000000000000000000000',
    decimals: 18,
    chainId: SWAP_CHAINS.origin.chainId,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: SWAP_CONTRACTS.usdcArb,
    decimals: 6,
    chainId: SWAP_CHAINS.origin.chainId,
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: SWAP_CONTRACTS.wethArb,
    decimals: 18,
    chainId: SWAP_CHAINS.origin.chainId,
  },
];

const BASE_TOKENS: SwapToken[] = [
  {
    symbol: 'ETH',
    name: 'Ether',
    address: '0x0000000000000000000000000000000000000000',
    decimals: 18,
    chainId: SWAP_CHAINS.destination.chainId,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: SWAP_CONTRACTS.usdcBase,
    decimals: 6,
    chainId: SWAP_CHAINS.destination.chainId,
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: SWAP_CONTRACTS.wethBase,
    decimals: 18,
    chainId: SWAP_CHAINS.destination.chainId,
  },
];

export function useSwapTokens(chainId: number, initialTokenAddress?: string) {
  const tokens = useMemo(() => {
    if (chainId === SWAP_CHAINS.origin.chainId) return ARBITRUM_TOKENS;
    if (chainId === SWAP_CHAINS.destination.chainId) return BASE_TOKENS;
    return [];
  }, [chainId]);

  const [selectedToken, setSelectedToken] = useState<SwapToken | null>(() => {
    if (!initialTokenAddress) return tokens[0] ?? null;
    return tokens.find((token) => token.address === initialTokenAddress) ?? tokens[0] ?? null;
  });

  return { tokens, selectedToken, setSelectedToken };
}
