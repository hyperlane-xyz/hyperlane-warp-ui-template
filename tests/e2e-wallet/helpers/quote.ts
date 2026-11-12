import type { Page, Route } from '@playwright/test';
import { encodeFunctionData, erc20Abi, getAddress } from 'viem';

import type { RouteTx } from '../../../src/features/api/types';

export const E2E_ROUTE_TX_TO = '0x52dd779c1b5eeb54d5f218EfA72D52117ca04115'.toLowerCase();
export const E2E_APPROVAL_SPENDER = E2E_ROUTE_TX_TO;
const E2E_WARP_ROUTE_ID = 'USDC/arbitrum-base-ethereum-lisk-optimism-polygon-zeronetwork';

const E2E_WARP_ROUTER_BY_CHAIN_ID: Record<number, string> = {
  1: '0xa6826c7Dd74c4e1B400AEF4a362692f99872F5F5',
  8453: '0x103C9CF52bBF6A6815a6c7e07C5Fb376De016C7D',
  42161: '0x14adE09354a20ed23E690afc803E64E60a84e7D3',
};

interface InstallQuoteMockOptions {
  expiresInSeconds?: number;
  approval?: 'erc20' | 'none';
  swapSide?: 'origin' | 'destination';
  sdkBridge?: boolean;
  output?: string;
  outputMin?: string;
  txTo?: string;
}

export async function installQuoteMock(
  page: Page,
  opts: InstallQuoteMockOptions = {},
): Promise<void> {
  await page.route('**/v1/quote', async (route: Route) => {
    const body = route.request().postDataJSON() as {
      srcChain: number;
      dstChain: number;
      srcToken: string;
      dstToken: string;
      amount: string;
    };

    const txTo = opts.txTo ?? E2E_ROUTE_TX_TO;
    const steps =
      body.srcChain === body.dstChain
        ? [
            {
              type: 'swap',
              chain: body.srcChain,
              dex: 'e2e',
              tokenIn: body.srcToken,
              tokenOut: body.dstToken,
              amountIn: body.amount,
              amountOut: opts.output ?? body.amount,
              path: [body.srcToken, body.dstToken],
              poolCount: 1,
              minPoolTvlUsd: null,
            },
          ]
        : [
            {
              type: 'swap',
              chain: body.srcChain,
              dex: 'e2e',
              tokenIn: body.srcToken,
              tokenOut: body.srcToken,
              amountIn: body.amount,
              amountOut: opts.output ?? body.amount,
              path: [body.srcToken],
              poolCount: 1,
              minPoolTvlUsd: null,
            },
            {
              type: 'bridge',
              chain: body.srcChain,
              destChain: body.dstChain,
              asset: body.srcToken,
              router: E2E_WARP_ROUTER_BY_CHAIN_ID[body.srcChain],
              amountIn: opts.output ?? body.amount,
              amountOut: opts.output ?? body.amount,
              fee: {
                tokenFee: '0',
                igpToken: '0x0000000000000000000000000000000000000000',
                igpAmount: '0',
                igpIncludedInAmountIn: false,
                localNativeFee: '0',
              },
              bridgeSymbol: 'E2E',
              warpRouteId: E2E_WARP_ROUTE_ID,
            },
          ];

    const sdkTransfer: RouteTx = {
      protocol: 'ethereum',
      type: 'ethers-v5',
      category: 'transfer',
      transaction: {
        to: E2E_WARP_ROUTER_BY_CHAIN_ID[body.srcChain],
        data: '0x12345678',
        value: '0',
      },
      metadata: { warpRouteId: E2E_WARP_ROUTE_ID },
    };
    const sdkTransactions: RouteTx[] = [];
    if (opts.sdkBridge && opts.approval === 'erc20') {
      sdkTransactions.push({
        ...sdkTransfer,
        category: 'approval',
        transaction: {
          to: body.srcToken,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [getAddress(E2E_WARP_ROUTER_BY_CHAIN_ID[body.srcChain]), BigInt(body.amount)],
          }),
          value: '0',
        },
      });
    }
    sdkTransactions.push(sdkTransfer);

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        expiresAt: Math.floor(Date.now() / 1000) + (opts.expiresInSeconds ?? 60),
        routes: [
          {
            steps: opts.sdkBridge
              ? steps.filter((step) => step.type === 'bridge')
              : opts.swapSide === 'destination' && body.srcChain !== body.dstChain
                ? [
                    steps[1],
                    {
                      ...steps[0],
                      chain: body.dstChain,
                      tokenIn: body.dstToken,
                      tokenOut: body.dstToken,
                      path: [body.dstToken],
                    },
                  ]
                : steps,
            output: opts.output ?? body.amount,
            outputMin: opts.outputMin ?? opts.output ?? body.amount,
            executionKind: opts.sdkBridge ? 'sdkWarp' : 'universalRouter',
            connection: null,
            gas: {
              originGas: '100000',
              destGas: '0',
            },
            tx: opts.sdkBridge
              ? sdkTransfer
              : {
                  to: txTo,
                  data: '0x12345678',
                  value: '0',
                },
            txs: opts.sdkBridge
              ? sdkTransactions
              : [
                  {
                    to: txTo,
                    data: '0x12345678',
                    value: '0',
                  },
                ],
            approval:
              !opts.sdkBridge && opts.approval === 'erc20'
                ? {
                    token: body.srcToken,
                    spender: E2E_APPROVAL_SPENDER,
                    amount: body.amount,
                    kind: 'erc20',
                  }
                : null,
          },
        ],
      }),
    });
  });
}
