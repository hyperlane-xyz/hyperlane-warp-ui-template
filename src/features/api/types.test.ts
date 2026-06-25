import { describe, expect, test } from 'vitest';

import { QuoteResponseSchema, QuoteRequestSchema, Recipient } from './types';

describe('api schemas', () => {
  test('accepts native non-EVM recipients for quote requests', () => {
    const solanaRecipient = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

    expect(Recipient.parse(solanaRecipient)).toBe(solanaRecipient);
    expect(
      QuoteRequestSchema.parse({
        srcChain: 8453,
        dstChain: 1399811149,
        srcToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        dstToken: '0x0000000000000000000000000000000000000000',
        amount: '1000000',
        sender: '0x4444444444444444444444444444444444444444',
        recipient: solanaRecipient,
      }).recipient,
    ).toBe(solanaRecipient);
  });

  test('rejects empty recipients', () => {
    expect(() => Recipient.parse('')).toThrow();
  });

  test('accepts native non-EVM token and sender refs for quote requests', () => {
    const solanaRef = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

    expect(() =>
      QuoteRequestSchema.parse({
        srcChain: 1399811149,
        dstChain: 8453,
        srcToken: solanaRef,
        dstToken: '0x0000000000000000000000000000000000000000',
        amount: '1000000',
        sender: solanaRef,
        recipient: '0x4444444444444444444444444444444444444444',
      }),
    ).not.toThrow();
  });

  test('accepts non-EVM bridge assets in quote responses', () => {
    const solanaAsset = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

    const parsed = QuoteResponseSchema.parse({
      routes: [
        {
          steps: [
            {
              type: 'bridge',
              chain: 1399811149,
              destChain: 8453,
              asset: solanaAsset,
              router: '0x1111111111111111111111111111111111111111',
              amountIn: '1000000',
              amountOut: '990000',
              fee: {
                tokenFee: '0',
                igpToken: '0x0000000000000000000000000000000000000000',
                igpAmount: '1',
              },
            },
          ],
          output: '990000',
          outputMin: '980000',
          connection: null,
          gas: { originGas: '0', destGas: '0' },
          tx: null,
        },
      ],
      expiresAt: 1,
    });

    expect(parsed.routes[0].steps[0]).toMatchObject({ asset: solanaAsset });
  });
});
