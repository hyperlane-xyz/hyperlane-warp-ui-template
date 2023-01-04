export interface ListedToken {
  chainId: number;
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  hypCollateralAddress: Address;
}

export interface ListedTokenWithHypTokens extends ListedToken {
  hypTokens: Array<{ chainId: number; address: Address }>;
}
