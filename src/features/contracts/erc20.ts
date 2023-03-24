import { Signer, providers } from 'ethers';

import { ERC20Upgradeable__factory } from '@hyperlane-xyz/core';

export function getErc20Contract(
  contractAddress: Address,
  signerOrProvider: Signer | providers.Provider,
) {
  return ERC20Upgradeable__factory.connect(contractAddress, signerOrProvider);
}
