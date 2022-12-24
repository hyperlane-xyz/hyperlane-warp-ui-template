import { Signer, providers } from 'ethers';

import { IERC20__factory } from '@hyperlane-xyz/core';

export function getErc20Contract(
  contractAddress: Address,
  signerOrProvider: Signer | providers.Provider,
) {
  return IERC20__factory.connect(contractAddress, signerOrProvider);
}
