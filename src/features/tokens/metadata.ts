import SyntheticTokenList from '../../consts/tokens.json';
import { areAddressesEqual } from '../../utils/addresses';

export function getAllTokens() {
  return SyntheticTokenList.tokens;
}

export function getTokenMetadata(chainId: number, tokenAddress: Address) {
  return SyntheticTokenList.tokens.find(
    (t) => t.chainId == chainId && areAddressesEqual(t.address, tokenAddress),
  );
}
