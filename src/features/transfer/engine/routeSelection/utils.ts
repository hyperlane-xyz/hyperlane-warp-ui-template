import type { QuoteStep } from '../../../api/types';
import { formatFeeAmount } from '../../../balances/utils';

export interface FlowNode {
  tokenAddress: string;
  chainId: number;
}

export function buildFlowNodes(steps: QuoteStep[]): FlowNode[] {
  const nodes: FlowNode[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    if (step.type === 'swap') {
      if (nodes.length === 0) nodes.push({ tokenAddress: step.tokenIn, chainId: step.chain });
      nodes.push({ tokenAddress: step.tokenOut, chainId: step.chain });
    } else {
      // Cross-chain step: step.asset is the token address on the SOURCE chain.
      if (nodes.length === 0) nodes.push({ tokenAddress: step.asset, chainId: step.chain });

      // After delivery, the token lives on destChain. Its address may differ
      // from step.asset (e.g. USDC on Ethereum ≠ USDC on Base). The next swap
      // step's tokenIn is the correct address on destChain — use it when available.
      const nextStep = steps[i + 1];
      const destAddress =
        nextStep?.type === 'swap'
          ? nextStep.tokenIn
          : nextStep?.type === 'bridge'
            ? nextStep.asset
            : step.asset;
      nodes.push({ tokenAddress: destAddress, chainId: step.destChain });
    }
  }

  return nodes;
}

// Use fee-level precision (8 dp) so small ETH/token amounts don't round to "0.0000".
export function formatStepAmount(raw: string, decimals: number): string {
  try {
    return formatFeeAmount(BigInt(raw), decimals);
  } catch {
    return raw;
  }
}

export function computeRate(
  rawIn: string,
  decimalsIn: number,
  rawOut: string,
  decimalsOut: number,
): string | null {
  try {
    const inVal = Number(BigInt(rawIn)) / 10 ** decimalsIn;
    const outVal = Number(BigInt(rawOut)) / 10 ** decimalsOut;
    if (inVal === 0) return null;
    const rate = outVal / inVal;
    return rate.toLocaleString(undefined, { maximumSignificantDigits: 5 });
  } catch {
    return null;
  }
}

export function formatWarpRouteId(id: string): string {
  const parts = id.split('/');
  return parts.length >= 3 ? `${parts[0]}/${parts[1]}` : id;
}
