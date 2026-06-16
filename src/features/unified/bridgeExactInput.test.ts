import { describe, expect, test, vi } from 'vitest';

import { createMockToken } from '../../utils/test';
import { findConnectedDestinationToken } from '../tokens/utils';
import { getTransferToken } from '../transfer/fees';
import {
  getExactInputBridgeMaxAmount,
  getExactInputBridgeQuote,
  getExactInputBridgeTransferQuote,
} from './bridgeExactInput';

vi.mock('../transfer/fees', () => ({
  getTransferToken: vi.fn(),
}));

vi.mock('../tokens/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../tokens/utils')>()),
  findConnectedDestinationToken: vi.fn(),
}));

describe('getExactInputBridgeQuote', () => {
  test('deducts same-token bridge fees from the transfer amount', async () => {
    const token = createMockToken();
    vi.spyOn(token, 'isFungibleWith').mockImplementation((other) => other === token);
    const warpCore = {
      getInterchainTransferFee: vi.fn().mockResolvedValue({
        igpQuote: token.amount(100n),
        tokenFeeQuote: token.amount(50n),
      }),
    };

    const quote = await getExactInputBridgeQuote({
      warpCore: warpCore as any,
      originToken: token,
      destinationToken: token,
      inputAmount: 1_000n,
      destination: token.chainName,
      recipient: '0xrecipient',
      sender: '0xsender',
    });

    expect(quote.transferAmount.amount).toBe(850n);
  });

  test('does not deduct fees paid with another token', async () => {
    const token = createMockToken({ symbol: 'USDC' });
    const feeToken = createMockToken({ symbol: 'ETH' });
    vi.spyOn(token, 'isFungibleWith').mockReturnValue(false);
    const warpCore = {
      getInterchainTransferFee: vi.fn().mockResolvedValue({
        igpQuote: feeToken.amount(100n),
        tokenFeeQuote: feeToken.amount(50n),
      }),
    };

    const quote = await getExactInputBridgeQuote({
      warpCore: warpCore as any,
      originToken: token,
      destinationToken: token,
      inputAmount: 1_000n,
      destination: token.chainName,
      recipient: '0xrecipient',
      sender: '0xsender',
    });

    expect(quote.transferAmount.amount).toBe(1_000n);
  });
});

describe('getExactInputBridgeMaxAmount', () => {
  test('adds same-token bridge fees back to SDK max transfer amount', async () => {
    const token = createMockToken();
    vi.spyOn(token, 'isFungibleWith').mockImplementation((other) => other === token);
    vi.mocked(getTransferToken).mockResolvedValue(token);
    vi.mocked(findConnectedDestinationToken).mockReturnValue(token);
    const warpCore = {
      getMaxTransferAmount: vi.fn().mockResolvedValue(token.amount(800n)),
      getInterchainTransferFee: vi.fn().mockResolvedValue({
        igpQuote: token.amount(100n),
        tokenFeeQuote: token.amount(50n),
      }),
    };

    const maxAmount = await getExactInputBridgeMaxAmount({
      warpCore: warpCore as any,
      balance: token.amount(1_000n),
      destinationToken: token,
      recipient: '0xrecipient',
      sender: '0xsender',
    });

    expect(maxAmount?.amount).toBe(950n);
  });
});

describe('getExactInputBridgeTransferQuote', () => {
  test('keeps the original input amount for stale quote checks', async () => {
    const token = createMockToken();
    vi.mocked(getTransferToken).mockResolvedValue(token);
    vi.mocked(findConnectedDestinationToken).mockReturnValue(token);
    const warpCore = {
      getInterchainTransferFee: vi.fn().mockResolvedValue({
        igpQuote: token.amount(0n),
        tokenFeeQuote: undefined,
      }),
    };

    const quote = await getExactInputBridgeTransferQuote({
      warpCore: warpCore as any,
      originToken: token,
      destinationToken: token,
      inputAmount: 1_000n,
      recipient: '0xrecipient',
      sender: '0xsender',
    });

    expect(quote.inputAmount).toBe(1_000n);
  });
});
