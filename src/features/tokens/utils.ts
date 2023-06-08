import { ethers } from 'ethers';

import { areAddressesEqual } from '../../utils/addresses';

// TODO Solana support
export function isNativeToken(tokenAddress: Address) {
  return areAddressesEqual(tokenAddress, ethers.constants.AddressZero);
}
