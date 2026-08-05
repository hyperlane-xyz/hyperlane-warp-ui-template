import type { Page, Route } from '@playwright/test';

export const E2E_ROUTE_TX_TO = '0x52dd779c1b5eeb54d5f218EfA72D52117ca04115'.toLowerCase();
export const E2E_APPROVAL_SPENDER = E2E_ROUTE_TX_TO;
const E2E_WARP_ROUTE_ID = 'USDC/arbitrum-base-ethereum-lisk-optimism-polygon-zeronetwork';

const E2E_WARP_ROUTER_BY_CHAIN_ID: Record<number, string> = {
  1: '0xa6826c7Dd74c4e1B400AEF4a362692f99872F5F5',
  8453: '0x103C9CF52bBF6A6815a6c7e07C5Fb376De016C7D',
  42161: '0x14adE09354a20ed23E690afc803E64E60a84e7D3',
};

interface InstallQuoteMockOptions {
  approval?: 'erc20' | 'none';
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
                localNativeFee: '0',
              },
              bridgeSymbol: 'E2E',
              warpRouteId: E2E_WARP_ROUTE_ID,
            },
          ];

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        expiresAt: Math.floor(Date.now() / 1000) + 60,
        routes: [
          {
            steps,
            output: opts.output ?? body.amount,
            outputMin: opts.outputMin ?? opts.output ?? body.amount,
            executionKind: 'universalRouter',
            connection: null,
            gas: {
              originGas: '100000',
              destGas: '0',
            },
            tx: {
              to: txTo,
              data: '0x12345678',
              value: '0',
            },
            txs: [
              {
                to: txTo,
                data: '0x12345678',
                value: '0',
              },
            ],
            approval:
              opts.approval === 'erc20'
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
