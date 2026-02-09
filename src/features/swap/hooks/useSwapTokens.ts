import { useEffect, useMemo, useState } from 'react';
import { SWAP_CHAINS } from '../swapConfig';
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
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    decimals: 6,
    chainId: SWAP_CHAINS.origin.chainId,
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
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
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimals: 6,
    chainId: SWAP_CHAINS.destination.chainId,
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: '0x4200000000000000000000000000000000000006',
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

  useEffect(() => {
    if (!initialTokenAddress) return;
    const token = tokens.find((item) => item.address === initialTokenAddress);
    if (token) setSelectedToken(token);
  }, [initialTokenAddress, tokens]);

  return { tokens, selectedToken, setSelectedToken };
}
