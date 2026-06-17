import type { Page, Route } from '@playwright/test';

export const E2E_ROUTE_TX_TO = '0x1111111111111111111111111111111111111111';
export const E2E_APPROVAL_SPENDER = '0x2222222222222222222222222222222222222222';

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

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        expiresAt: Math.floor(Date.now() / 1000) + 60,
        routes: [
          {
            steps: [
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
            ],
            output: opts.output ?? body.amount,
            outputMin: opts.outputMin ?? opts.output ?? body.amount,
            executionKind: 'universalRouter',
            connection: null,
            gas: {
              originGas: '100000',
              destGas: '0',
            },
            tx: {
              to: opts.txTo ?? E2E_ROUTE_TX_TO,
              data: '0x12345678',
              value: '0',
            },
            txs: [
              {
                to: opts.txTo ?? E2E_ROUTE_TX_TO,
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
