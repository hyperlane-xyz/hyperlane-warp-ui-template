import { Signer, providers } from 'ethers';

import { ERC20Upgradeable__factory } from '@hyperlane-xyz/core';
import { ERC721__factory } from '@hyperlane-xyz/hyperlane-token';

export function getErc20Contract(
  contractAddress: Address,
  signerOrProvider: Signer | providers.Provider,
) {
  return ERC20Upgradeable__factory.connect(contractAddress, signerOrProvider);
}

export function getErc721Contract(
  contractAddress: Address,
  signerOrProvider: Signer | providers.Provider,
) {
  return ERC721__factory.connect(contractAddress, signerOrProvider);
}
