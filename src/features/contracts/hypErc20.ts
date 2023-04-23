import { Signer, providers } from 'ethers';

import {
  HypERC20Collateral__factory,
  HypERC20__factory,
  HypNative__factory,
  TokenType,
} from '@hyperlane-xyz/hyperlane-token';

// Get the connected HypERC20Collateral, HypNative, or HypERC20 contract
export function getTokenRouterContract(
  type: TokenType,
  contractAddress: Address,
  signerOrProvider: Signer | providers.Provider,
) {
  if (type === TokenType.collateral) {
    return getHypErc20CollateralContract(contractAddress, signerOrProvider);
  } else if (type === TokenType.native) {
    return getHypNativeContract(contractAddress, signerOrProvider);
  } else if (type === TokenType.synthetic) {
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

function getHypErc20Contract(
  contractAddress: Address,
  signerOrProvider: Signer | providers.Provider,
) {
  return HypERC20__factory.connect(contractAddress, signerOrProvider);
}

function getHypNativeContract(
  contractAddress: Address,
  signerOrProvider: Signer | providers.Provider,
) {
  return HypNative__factory.connect(contractAddress, signerOrProvider);
}
