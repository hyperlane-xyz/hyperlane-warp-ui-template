import { BigNumber, BigNumberish, Contract, providers } from 'ethers';

const ICA_ROUTER_ABI = [
  'function quoteGasForCommitReveal(uint32 _destinationDomain, uint256 _gasLimit) external view returns (uint256)',
  'function quoteGasPayment(uint32 _destinationDomain, uint256 _gasLimit) external view returns (uint256)',
];

export async function getIcaCommitRevealFee(
  provider: providers.Provider,
  icaRouterAddress: string,
  destinationDomain: number,
  gasLimit: BigNumberish = 50_000,
): Promise<BigNumber> {
  const router = new Contract(icaRouterAddress, ICA_ROUTER_ABI, provider);
  try {
    return await router.callStatic.quoteGasForCommitReveal(destinationDomain, gasLimit);
  } catch {
    return router.callStatic.quoteGasPayment(destinationDomain, gasLimit);
  }
}
