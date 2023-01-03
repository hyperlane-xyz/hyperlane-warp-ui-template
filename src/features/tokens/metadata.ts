import SyntheticTokenList from '../../consts/tokens.hyperlane.xyz.json';
import { areAddressesEqual, isValidAddress } from '../../utils/addresses';

export function getAllTokens() {
  return SyntheticTokenList.tokens;
}

export function getTokenMetadata(chainId: number, tokenAddress: Address) {
  return SyntheticTokenList.tokens.find(
    (t) => t.chainId == chainId && areAddressesEqual(t.address, tokenAddress),
  );
}

export function getTokenHypCollateralAddress(chainId: number, tokenAddress: Address) {
  const tokenMetadata = getTokenMetadata(chainId, tokenAddress);
  const address = tokenMetadata?.hypCollateralAddress || '';
  return isValidAddress(address) ? address : null;
}
