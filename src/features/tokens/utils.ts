import { ethers } from 'ethers';

import { utils } from '@hyperlane-xyz/utils';

export function isNativeToken(tokenAddress: Address) {
  return utils.eqAddress(tokenAddress, ethers.constants.AddressZero);
}
