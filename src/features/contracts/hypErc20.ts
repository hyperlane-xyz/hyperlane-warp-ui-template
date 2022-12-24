import { Signer, providers } from 'ethers';

// TODO get factory properly exported from hyperlane-token
import { HypERC20Collateral__factory } from '@hyperlane-xyz/hyperlane-token/dist/src/types/factories/contracts/HypERC20Collateral__factory';
import { HypERC20__factory } from '@hyperlane-xyz/hyperlane-token/dist/src/types/factories/contracts/HypERC20__factory';

export function getHypErc20CollateralContract(
  contractAddress: Address,
  signerOrProvider: Signer | providers.Provider,
) {
  return HypERC20Collateral__factory.connect(contractAddress, signerOrProvider);
}

export function getHypErc20Contract(
  contractAddress: Address,
  signerOrProvider: Signer | providers.Provider,
) {
  return HypERC20__factory.connect(contractAddress, signerOrProvider);
}
