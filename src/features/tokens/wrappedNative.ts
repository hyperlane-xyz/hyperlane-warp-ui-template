import type { UiToken } from './types';

// Confirmed against universal-router-engine/src/config/warp-routes.ts and
// universal-router-engine/src/routing/token-utils.ts. Keep this local until
// wrapped-native equivalents are available from trusted registry metadata.
export const WRAPPED_NATIVE_TOKEN_BY_CHAIN_ID: Record<number, string> = {
  1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // Ethereum WETH
  10: '0x4200000000000000000000000000000000000006', // Optimism WETH
  56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // BSC WBNB
  130: '0x4200000000000000000000000000000000000006', // Unichain WETH
  137: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // Polygon WMATIC
  8453: '0x4200000000000000000000000000000000000006', // Base WETH
  42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // Arbitrum WETH
  728126428: '0x891cdb91d149f23B1a45D9c5Ca78a88d0cB44C18', // Tron WTRX
  1399811149: 'So11111111111111111111111111111111111111112', // Solana WSOL
};

export function trustedWrappedNativeAddress(chainId: number | null | undefined) {
  return chainId == null ? undefined : WRAPPED_NATIVE_TOKEN_BY_CHAIN_ID[chainId];
}

export function trustedWrappedNativeAddressForToken(
  token: Pick<UiToken, 'chainId' | 'isNative'> | null | undefined,
) {
  if (!token?.isNative) return undefined;
  return trustedWrappedNativeAddress(token.chainId);
}
