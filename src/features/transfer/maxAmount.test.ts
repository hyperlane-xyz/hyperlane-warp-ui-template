import { MultiProtocolProvider, WarpCore } from '@hyperlane-xyz/sdk';
import { HexString, KnownProtocolType } from '@hyperlane-xyz/utils';
import { AccountInfo, getAccountAddressAndPubKey } from '@hyperlane-xyz/widgets';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMockToken, createTokenConnectionMock } from '../../utils/test';
import { getTransferToken } from './fees';
import { fetchMaxAmount } from './maxAmount';

vi.mock('@hyperlane-xyz/widgets', () => ({
  getAccountAddressAndPubKey: vi.fn(),
}));

vi.mock('./fees', () => ({
  getTransferToken: vi.fn(),
}));

describe('fetchMaxAmount', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('forwards destinationTokenAddress to max transfer estimation', async () => {
    const destinationToken = createMockToken({
      chainName: 'arbitrum',
      addressOrDenom: '0x2222222222222222222222222222222222222222',
    });
    const originToken = createMockToken({
      chainName: 'ethereum',
      addressOrDenom: '0x1111111111111111111111111111111111111111',
      connections: [],
    });
    const routeToken = createMockToken({
      chainName: originToken.chainName,
      addressOrDenom: originToken.addressOrDenom,
      collateralAddressOrDenom: originToken.collateralAddressOrDenom,
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: destinationToken.chainName,
          addressOrDenom: destinationToken.addressOrDenom,
          collateralAddressOrDenom: destinationToken.collateralAddressOrDenom,
        }),
      ],
    });
    const balance = originToken.amount(1_000_000n);
    const maxAmount = originToken.amount(900_000n);

    vi.mocked(getAccountAddressAndPubKey).mockImplementation((_mp, chain) => ({
      address: chain === destinationToken.chainName ? '0xrecipient' : '0xsender',
      publicKey: Promise.resolve('0x1234' as HexString),
    }));
    vi.mocked(getTransferToken).mockResolvedValue(originToken);

    const warpCore = {
      getTokensForRoute: vi.fn().mockReturnValue([routeToken]),
      getMaxTransferAmount: vi.fn().mockResolvedValue(maxAmount),
    } as unknown as WarpCore;
    const multiProvider = {
      tryGetChainMetadata: vi.fn(),
    } as unknown as MultiProtocolProvider;

    await fetchMaxAmount(multiProvider, warpCore, {
      accounts: {} as unknown as Record<KnownProtocolType, AccountInfo>,
      balance,
      origin: originToken.chainName,
      destinationToken,
      recipient: '0xrecipient',
    });

    expect(warpCore.getMaxTransferAmount).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: destinationToken.chainName,
        destinationTokenAddress: destinationToken.addressOrDenom,
      }),
    );
  });
});
