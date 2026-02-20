import { TokenAmount, WarpCore } from '@hyperlane-xyz/sdk';
import { HexString } from '@hyperlane-xyz/utils';
import { describe, expect, test, vi } from 'vitest';
import { createMockToken } from '../../utils/test';
import { fetchFeeQuotes } from './useFeeQuotes';

describe('fetchFeeQuotes', () => {
  test('returns null when required inputs are missing', async () => {
    const warpCore = {} as WarpCore;
    const result = await fetchFeeQuotes(warpCore, undefined, undefined);
    expect(result).toBeNull();
  });

  test('forwards destinationTokenAddress to fee estimation', async () => {
    const originToken = createMockToken({
      chainName: 'ethereum',
      addressOrDenom: '0x1111111111111111111111111111111111111111',
      decimals: 6,
    });
    const destinationToken = createMockToken({
      chainName: 'arbitrum',
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      decimals: 6,
    });
    const feeEstimate = {
      interchainQuote: new TokenAmount(1n, originToken),
      localQuote: new TokenAmount(1n, originToken),
      tokenFeeQuote: undefined,
    };
    const warpCore = {
      estimateTransferRemoteFees: vi.fn().mockResolvedValue(feeEstimate),
    } as unknown as WarpCore;

    await fetchFeeQuotes(
      warpCore,
      originToken,
      destinationToken,
      '0xsender',
      Promise.resolve('0x1234' as HexString),
      '1',
      '0xrecipient',
    );

    expect(warpCore.estimateTransferRemoteFees).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: destinationToken.chainName,
        destinationTokenAddress: destinationToken.addressOrDenom,
      }),
    );
  });
});
