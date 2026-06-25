import { describe, expect, test } from 'vitest';

import { QuoteRequestSchema, Recipient } from './types';

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
});
