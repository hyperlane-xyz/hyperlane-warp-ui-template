import { ethers } from 'ethers';

import { ProtocolType } from '@hyperlane-xyz/sdk';

import { SOL_ZERO_ADDRESS } from '../../consts/values';
import { isZeroishAddress } from '../../utils/addresses';

export function isNativeToken(tokenAddress: Address) {
  return isZeroishAddress(tokenAddress);
}

export function getNativeTokenAddress(protocol: ProtocolType) {
  if (protocol === ProtocolType.Ethereum) {
    return ethers.constants.AddressZero;
  } else if (protocol === ProtocolType.Sealevel) {
    return SOL_ZERO_ADDRESS;
  } else {
    throw new Error(`Unsupported protocol: ${protocol}`);
  }
}
