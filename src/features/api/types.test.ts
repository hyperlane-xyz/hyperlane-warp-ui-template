import { describe, expect, test } from 'vitest';

import { AvailableRoutesResponseSchema, CallCommitmentSchema, QuoteResponseSchema } from './types';

describe('QuoteResponseSchema', () => {
  test('accepts structured route rejections', () => {
    expect(() =>
      QuoteResponseSchema.parse({
        expiresAt: Math.floor(Date.now() / 1000) + 30,
        routes: [],
        rejections: [
          {
            code: 'insufficient_destination_collateral',
            message: 'Insufficient destination liquidity for this amount',
            srcChain: 8453,
            dstChain: 1399811149,
            srcToken: '0x2079997e72ffe2b4e455d94cd88b5eca0d9155e4',
            dstToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            amount: '1000000',
            warpRouteId: 'USDCFEE/sol',
            details: { availableCollateral: '900000', requiredCollateral: '1000000' },
          },
        ],
      }),
    ).not.toThrow();
  });

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
                  igpIncludedInAmountIn: false,
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

describe('AvailableRoutesResponseSchema', () => {
  test('accepts engine available route tokens', () => {
    expect(() =>
      AvailableRoutesResponseSchema.parse({
        direction: 'fromSource',
        tokens: [
          {
            chainId: 8453,
            address: '0x1111111111111111111111111111111111111111',
            symbol: 'USDC',
            name: 'USD Coin',
            standard: 'EvmHypCollateral',
            decimals: 6,
            isNative: false,
            isBridgeToken: true,
            isPoolToken: false,
            canBridge: true,
            canSwap: false,
            bridgeSymbols: ['USDC'],
            warpRouteIds: ['USDC/base'],
          },
        ],
      }),
    ).not.toThrow();
  });
});

describe('CallCommitmentSchema', () => {
  test('accepts engine calldata CCS payloads', () => {
    expect(() =>
      CallCommitmentSchema.parse({
        version: 1,
        commitment: `0x${'11'.repeat(32)}`,
        hash: {
          algorithm: 'keccak256',
          preimage: 'salt || borsh(commands, inputs)',
        },
        ccs: {
          method: 'POST',
          path: '/calldata',
          body: {
            commitment: `0x${'11'.repeat(32)}`,
            originDomain: 1,
            data: '0x1234',
            salt: `0x${'22'.repeat(32)}`,
            relayers: [`0x${'33'.repeat(32)}`],
            destinationAccount: `0x${'44'.repeat(32)}`,
            revealAccounts: [
              {
                pubkey: '11111111111111111111111111111111',
                isWritable: true,
                isSigner: false,
              },
            ],
          },
        },
      }),
    ).not.toThrow();
  });

  test('rejects non-engine CCS paths', () => {
    expect(() =>
      CallCommitmentSchema.parse({
        version: 1,
        commitment: `0x${'11'.repeat(32)}`,
        hash: {
          algorithm: 'keccak256',
          preimage: 'salt || borsh(commands, inputs)',
        },
        ccs: {
          method: 'POST',
          path: '/v1/call-commitments',
          body: {
            commitment: `0x${'11'.repeat(32)}`,
            originDomain: 1,
            data: '0x1234',
            salt: `0x${'22'.repeat(32)}`,
            relayers: [],
            destinationAccount: `0x${'44'.repeat(32)}`,
          },
        },
      }),
    ).toThrow();
  });
});
