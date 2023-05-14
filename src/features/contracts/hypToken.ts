import { Signer, providers } from 'ethers';

import {
  HypERC20Collateral__factory,
  HypERC20__factory,
  HypERC721Collateral__factory,
  HypERC721__factory,
  HypNative__factory,
  TokenType,
} from '@hyperlane-xyz/hyperlane-token';

// Get the connected HypERC20Collateral, HypERC721Collateral, HypNative, HypERC20, HypERC721 contract
export function getTokenRouterContract(
  type: TokenType,
  contractAddress: Address,
  signerOrProvider: Signer | providers.Provider,
  isERC721: boolean | false,
) {
  if (type === TokenType.collateral) {
    if (isERC721) {
      return getHypErc721CollateralContract(contractAddress, signerOrProvider);
    }
    return getHypErc20CollateralContract(contractAddress, signerOrProvider);
  } else if (type === TokenType.native) {
    return getHypNativeContract(contractAddress, signerOrProvider);
  } else if (type === TokenType.synthetic) {
    if (isERC721) {
      return getHypErc721Contract(contractAddress, signerOrProvider);
    }
    return getHypErc20Contract(contractAddress, signerOrProvider);
  } else {
    throw new Error(`Unsupported token type: ${type}}`);
  }
}

function getHypErc20CollateralContract(
  contractAddress: Address,
  signerOrProvider: Signer | providers.Provider,
) {
  return HypERC20Collateral__factory.connect(contractAddress, signerOrProvider);
}

function getHypErc721CollateralContract(
  contractAddress: Address,
  signerOrProvider: Signer | providers.Provider,
) {
  return HypERC721Collateral__factory.connect(contractAddress, signerOrProvider);
}

function getHypErc20Contract(
  contractAddress: Address,
  signerOrProvider: Signer | providers.Provider,
) {
  return HypERC20__factory.connect(contractAddress, signerOrProvider);
}

function getHypErc721Contract(
  contractAddress: Address,
  signerOrProvider: Signer | providers.Provider,
) {
  return HypERC721__factory.connect(contractAddress, signerOrProvider);
}

function getHypNativeContract(
  contractAddress: Address,
  signerOrProvider: Signer | providers.Provider,
) {
  return HypNative__factory.connect(contractAddress, signerOrProvider);
}
