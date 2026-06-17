import { describe, expect, test } from 'vitest';

import { QuoteResponseSchema } from './types';

describe('QuoteResponseSchema', () => {
  test('accepts engine bridge quote metadata', () => {
    expect(() =>
      QuoteResponseSchema.parse({
        expiresAt: Math.floor(Date.now() / 1000) + 30,
        routes: [
          {
            steps: [
              {
                type: 'bridge',
                chain: 1,
                destChain: 8453,
                asset: '0x1111111111111111111111111111111111111111',
                router: '0x2222222222222222222222222222222222222222',
                amountIn: '100',
                amountOut: '99',
                bridgeSymbol: 'USDC',
                warpRouteId: 'USDC/base',
                fee: {
                  tokenFee: '1',
                  igpToken: '0x0000000000000000000000000000000000000000',
                  igpAmount: '2',
                  localNativeFee: '3',
                },
              },
            ],
            output: '99',
            outputMin: '99',
            executionKind: 'warpDirect',
            connection: {
              symbol: 'USDC',
              warpRouteId: 'USDC/base',
            },
            gas: {
              originGas: '100000',
              destGas: '0',
            },
            tx: {
              to: '0x3333333333333333333333333333333333333333',
              data: '0x1234',
              value: '2',
            },
            txs: [
              {
                to: '0x3333333333333333333333333333333333333333',
                data: '0x1234',
                value: '2',
              },
            ],
            approval: {
              token: '0x1111111111111111111111111111111111111111',
              spender: '0x3333333333333333333333333333333333333333',
              amount: '100',
              kind: 'erc20',
            },
          },
        ],
      }),
    ).not.toThrow();
  });
});
