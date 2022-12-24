export interface ListedToken {
  chainId: number;
  address: Address;
  hypCollateralAddresses: Address[];
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
}
