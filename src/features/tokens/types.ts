export interface ListedToken {
  chainId: number;
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  hypCollateralAddress: Address;
  hypTokenAddresses: Array<{
    chainId: number;
    address: Address;
  }>;
}
