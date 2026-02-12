import type { DexFlavor } from '@hyperlane-xyz/sdk';
import { getDexFlavorIsUni, normalizePoolParam } from '@hyperlane-xyz/sdk';
import { eqAddress } from '@hyperlane-xyz/utils';
import { BigNumber, BigNumberish, utils } from 'ethers';

export type CommitmentCall = {
  to: string;
  data: string;
  value?: string | number;
};

const V3_SWAP_EXACT_IN_COMMAND = '0x00';

export function applySlippage(amount: BigNumber, slippage: number): BigNumber {
  if (!Number.isFinite(slippage) || slippage < 0 || slippage >= 1) {
    throw new Error(`slippage must be >= 0 and < 1, received ${slippage}`);
  }
  const slippageBps = Math.floor(slippage * 10_000);
  return amount.mul(10_000 - slippageBps).div(10_000);
}

export function buildUniversalRouterV3SwapExactInCall(params: {
  universalRouter: string;
  recipient: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: BigNumberish;
  amountOutMinimum: BigNumberish;
  deadline: BigNumberish;
  payerIsUser?: boolean;
  poolParam?: number;
  dexFlavor?: DexFlavor;
}): CommitmentCall {
  if (eqAddress(params.tokenIn, params.tokenOut)) {
    throw new Error('tokenIn and tokenOut must differ for destination swap');
  }

  const poolParam = normalizePoolParam(params.poolParam);
  const isUni = getDexFlavorIsUni(params.dexFlavor);
  const path = utils.solidityPack(
    ['address', 'uint24', 'address'],
    [params.tokenIn, poolParam, params.tokenOut],
  );
  const encodedInput = utils.defaultAbiCoder.encode(
    ['address', 'uint256', 'uint256', 'bytes', 'bool', 'bool'],
    [
      params.recipient,
      BigNumber.from(params.amountIn),
      BigNumber.from(params.amountOutMinimum),
      path,
      params.payerIsUser ?? true,
      isUni,
    ],
  );

  const executeData = new utils.Interface([
    'function execute(bytes commands, bytes[] inputs, uint256 deadline) external payable',
  ]).encodeFunctionData('execute', [V3_SWAP_EXACT_IN_COMMAND, [encodedInput], params.deadline]);

  return {
    to: params.universalRouter,
    data: executeData,
  };
}
