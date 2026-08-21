import { describe, expect, test } from 'vitest';

import type { QuoteBridgeStep, QuoteSwapStep } from '../../../api/types';
import { buildFlowNodes } from './utils';

const ALEO_CHAIN_ID = 1634493807;
const SOLANA_CHAIN_ID = 1399811149;
const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000';
const SOLANA_ALEO = 'SolanaAleoSynthetic1111111111111111111111111';

const bridgeStep: QuoteBridgeStep = {
  type: 'bridge',
  chain: ALEO_CHAIN_ID,
  destChain: SOLANA_CHAIN_ID,
  asset: NATIVE_TOKEN,
  router: 'hyp_warp_token_credits.aleo/router',
  amountIn: '100000',
  amountOut: '100000',
  bridgeSymbol: 'ALEO',
  warpRouteId: 'ALEO/aleo',
  fee: {
    tokenFee: '0',
    igpToken: NATIVE_TOKEN,
    igpAmount: '7661056',
    localNativeFee: '0',
  },
};

describe('buildFlowNodes', () => {
  test('uses the selected destination token for a terminal bridge', () => {
    expect(buildFlowNodes([bridgeStep], { destinationTokenAddress: SOLANA_ALEO })).toEqual([
      { chainId: ALEO_CHAIN_ID, tokenAddress: NATIVE_TOKEN },
      { chainId: SOLANA_CHAIN_ID, tokenAddress: SOLANA_ALEO },
    ]);
  });

  test('uses the next destination swap input for a non-terminal bridge', () => {
    const swapStep: QuoteSwapStep = {
      type: 'swap',
      chain: SOLANA_CHAIN_ID,
      dex: 'raydium',
      tokenIn: 'SolanaBridgeMint11111111111111111111111111',
      tokenOut: SOLANA_ALEO,
      amountIn: '100000',
      amountOut: '99000',
      path: ['SolanaBridgeMint11111111111111111111111111', SOLANA_ALEO],
      poolCount: 1,
    };

    expect(
      buildFlowNodes([bridgeStep, swapStep], { destinationTokenAddress: SOLANA_ALEO }),
    ).toEqual([
      { chainId: ALEO_CHAIN_ID, tokenAddress: NATIVE_TOKEN },
      { chainId: SOLANA_CHAIN_ID, tokenAddress: swapStep.tokenIn },
      { chainId: SOLANA_CHAIN_ID, tokenAddress: SOLANA_ALEO },
    ]);
  });
});
