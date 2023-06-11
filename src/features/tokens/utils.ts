import { isZeroishAddress } from '../../utils/addresses';

export function isNativeToken(tokenAddress: Address) {
  return isZeroishAddress(tokenAddress);
}
