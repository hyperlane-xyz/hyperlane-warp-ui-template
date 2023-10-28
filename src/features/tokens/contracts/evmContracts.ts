import { Signer, providers } from 'ethers';

import {
  ERC20__factory,
  ERC721__factory,
  HypERC20Collateral__factory,
  HypERC20__factory,
  HypERC721Collateral__factory,
  HypERC721__factory,
  HypNative__factory,
} from '@hyperlane-xyz/core';

export function getHypErc20CollateralContract(
  contractAddress: Address,
  signerOrProvider: Signer | providers.Provider,
) {
  return HypERC20Collateral__factory.connect(contractAddress, signerOrProvider);
}

export function getHypErc721CollateralContract(
  contractAddress: Address,
  signerOrProvider: Signer | providers.Provider,
) {
  return HypERC721Collateral__factory.connect(contractAddress, signerOrProvider);
}

export function getHypErc20Contract(
  contractAddress: Address,
  signerOrProvider: Signer | providers.Provider,
) {
  return HypERC20__factory.connect(contractAddress, signerOrProvider);
}

export function getHypErc721Contract(
  contractAddress: Address,
  signerOrProvider: Signer | providers.Provider,
) {
  return HypERC721__factory.connect(contractAddress, signerOrProvider);
}

export function getHypNativeContract(
  contractAddress: Address,
  signerOrProvider: Signer | providers.Provider,
) {
  return HypNative__factory.connect(contractAddress, signerOrProvider);
}

export function getErc20Contract(
  contractAddress: Address,
  signerOrProvider: Signer | providers.Provider,
) {
  return ERC20__factory.connect(contractAddress, signerOrProvider);
}

export function getErc721Contract(
  contractAddress: Address,
  signerOrProvider: Signer | providers.Provider,
) {
  return ERC721__factory.connect(contractAddress, signerOrProvider);
}
