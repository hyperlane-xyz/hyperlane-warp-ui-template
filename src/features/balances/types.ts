export interface BalanceToken {
  chainId: number;
  chainName: string;
  address: string;
  symbol: string;
  decimals: number;
  isNative: boolean;
  name?: string;
  standard?: string;
  coinGeckoId?: string;
  logoURI?: string;
}

export function getBalanceTokenKey(token: Pick<BalanceToken, 'chainId' | 'address'>): string {
  return balanceTokenKey(token.chainId, token.address);
}

export function balanceTokenKey(chainId: number, address: string): string {
  const normalizedAddress = /^0x[a-fA-F0-9]{40}$/.test(address) ? address.toLowerCase() : address;
  return `${chainId}-${normalizedAddress}`;
}
