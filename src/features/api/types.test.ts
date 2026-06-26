import { describe, expect, test } from 'vitest';

import {
  QuoteResponseSchema,
  QuoteRequestSchema,
  ReadinessResponseSchema,
  Recipient,
} from './types';

const bytes32A = `0x${'a'.repeat(64)}`;
const bytes32B = `0x${'b'.repeat(64)}`;
const bytes32C = `0x${'c'.repeat(64)}`;
const bytes32D = `0x${'d'.repeat(64)}`;
const baseQuoteRequest = {
  srcChain: 8453,
  dstChain: 42161,
  srcToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  dstToken: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
  amount: '1000000',
  sender: '0x4444444444444444444444444444444444444444',
};

describe('api schemas', () => {
  test('accepts current engine readiness snapshot fields', () => {
    expect(
      ReadinessResponseSchema.parse({
        ok: true,
        graphReady: true,
        graphConnections: 42,
        coreConfigChains: 10,
        chainCacheHydrated: true,
        activeSnapshotUpdatedAt: '2026-06-26T00:00:00.000Z',
        activeSnapshotAgeMs: 1234,
        activeSnapshotExpiresAt: null,
        lastRouteCacheRefreshAt: '2026-06-26T00:00:01.000Z',
        lastRouteCacheRefreshStatus: 'ok',
      }),
    ).toMatchObject({
      activeSnapshotAgeMs: 1234,
      activeSnapshotExpiresAt: null,
    });
  });

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

  test('requires quote commitment salt to be bytes32', () => {
    expect(
      QuoteRequestSchema.parse({ ...baseQuoteRequest, commitmentSalt: bytes32A }),
    ).toMatchObject({
      commitmentSalt: bytes32A,
    });
    expect(() =>
      QuoteRequestSchema.parse({ ...baseQuoteRequest, commitmentSalt: '0x1234' }),
    ).toThrow();
  });

  test('matches engine main quote request numeric bounds', () => {
    expect(() => QuoteRequestSchema.parse(baseQuoteRequest)).not.toThrow();
    expect(() => QuoteRequestSchema.parse({ ...baseQuoteRequest, srcChain: 0 })).toThrow();
    expect(() => QuoteRequestSchema.parse({ ...baseQuoteRequest, dstChain: 1.5 })).toThrow();
    expect(() => QuoteRequestSchema.parse({ ...baseQuoteRequest, amount: '0' })).toThrow();
    expect(() =>
      QuoteRequestSchema.parse({ ...baseQuoteRequest, amount: (2n ** 256n).toString() }),
    ).toThrow();
    expect(() => QuoteRequestSchema.parse({ ...baseQuoteRequest, slippageBps: -1 })).toThrow();
    expect(() => QuoteRequestSchema.parse({ ...baseQuoteRequest, slippageBps: 10_001 })).toThrow();
    expect(() => QuoteRequestSchema.parse({ ...baseQuoteRequest, slippageBps: 100 })).not.toThrow();
  });

  test('accepts explicit classic approval quote mode', () => {
    expect(
      QuoteRequestSchema.parse({
        ...baseQuoteRequest,
        usePermit2: false,
      }).usePermit2,
    ).toBe(false);
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

  test('accepts Solana route tx fields from engine main', () => {
    const solanaProgram = '9xQeWvG816bUx9EPfQ4gZrsWKQZy4vEJ7xmY2p4z9Pq';
    const solanaAccount = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

    const parsed = QuoteResponseSchema.parse({
      routes: [
        {
          steps: [
            {
              type: 'swap',
              chain: 1399811149,
              dex: 'test-dex',
              tokenIn: solanaAccount,
              tokenOut: 'So11111111111111111111111111111111111111112',
              amountIn: '1000000',
              amountOut: '990000',
              path: [solanaAccount, 'So11111111111111111111111111111111111111112'],
              poolCount: 1,
              minPoolTvlUsd: null,
              poolAddress: solanaProgram,
            },
          ],
          output: '990000',
          outputMin: '980000',
          connection: null,
          gas: { originGas: '0', destGas: '0' },
          tx: {
            to: solanaProgram,
            data: 'AQIDBA==',
            value: '0',
            accounts: [{ pubkey: solanaAccount, isSigner: false, isWritable: true }],
            additionalSigners: ['AQID'],
            altAddresses: [solanaProgram],
            preInstructions: [
              {
                programId: solanaProgram,
                accounts: [{ pubkey: solanaAccount, isSigner: false, isWritable: true }],
                data: 'BQYH',
              },
            ],
          },
        },
      ],
      expiresAt: 1,
    });

    expect(parsed.routes[0].tx).toMatchObject({
      to: solanaProgram,
      accounts: [{ pubkey: solanaAccount, isSigner: false, isWritable: true }],
    });
  });

  test('accepts /calldata CCS commitments from engine main', () => {
    const parsed = QuoteResponseSchema.parse({
      routes: [
        {
          steps: [],
          output: '0',
          outputMin: '0',
          connection: null,
          gas: { originGas: '0', destGas: '0' },
          tx: null,
          callCommitment: {
            version: 1,
            commitment: bytes32A,
            hash: { algorithm: 'keccak256', preimage: '0x', encodedCalls: '0x' },
            ccs: {
              method: 'POST',
              path: '/calldata',
              body: {
                commitment: bytes32A,
                originDomain: 8453,
                data: '0x1234',
                salt: bytes32B,
                relayers: [bytes32C],
                destinationAccount: bytes32D,
                revealAccounts: [
                  {
                    pubkey: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
                    isWritable: true,
                    isSigner: false,
                  },
                ],
              },
            },
          },
        },
      ],
      expiresAt: 1,
    });

    expect(parsed.routes[0].callCommitment?.ccs.path).toBe('/calldata');
  });
});
