import { ethers } from 'ethers';

import { SOL_ZERO_ADDRESS } from '../../consts/values';
import { isZeroishAddress } from '../../utils/addresses';
import { ProtocolType } from '../chains/types';

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
