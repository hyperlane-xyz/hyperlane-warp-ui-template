import { ProtocolType } from '@hyperlane-xyz/utils';
import { describe, expect, test, vi } from 'vitest';

import { createMockToken, createTokenConnectionMock } from '../../utils/test';
import { getTokenKey, groupTokensByCollateral } from '../tokens/utils';
import { getTransferToken } from '../transfer/fees';
import {
  getInitialUnifiedTokenQuery,
  hydrateInitialUnifiedTokenKeys,
  validateUnifiedBridgeTransfer,
} from './UnifiedTokenCard';

vi.mock('../transfer/fees', () => ({
  getTransferToken: vi.fn(),
}));

describe('getInitialUnifiedTokenQuery', () => {
  test('builds the lookup query before form defaults can hydrate', () => {
    const query = getInitialUnifiedTokenQuery(
      new URLSearchParams(
        'origin=bsc&originToken=0xfb6115445Bff7b52FeB98650C87f44907E58f802&destination=base&destinationToken=0x63706e401c06ac8513145b7687A14804d17f814b',
      ),
    );

    expect(query).toEqual({
      ids: [
        'bsc-0xfb6115445Bff7b52FeB98650C87f44907E58f802',
        'base-0x63706e401c06ac8513145b7687A14804d17f814b',
      ],
    });
  });

  test('returns an empty query when there are no address-style token refs', () => {
    expect(
      getInitialUnifiedTokenQuery(
        new URLSearchParams('origin=ethereum&originToken=USDC&destination=base'),
      ),
    ).toEqual({});
  });
});

describe('hydrateInitialUnifiedTokenKeys', () => {
  test('sets initial token keys without clearing typed fields', () => {
    const result = hydrateInitialUnifiedTokenKeys(
      {
        originTokenKey: undefined,
        destinationTokenKey: undefined,
        amount: '123',
        recipient: '0xrecipient',
        slippageBps: 100,
      },
      {
        originTokenKey: 'origin',
        destinationTokenKey: 'destination',
      },
    );

    expect(result).toEqual({
      originTokenKey: 'origin',
      destinationTokenKey: 'destination',
      amount: '123',
      recipient: '0xrecipient',
      slippageBps: 100,
    });
  });

  test('does not overwrite an existing token selection', () => {
    const values = {
      originTokenKey: 'selected-origin',
      destinationTokenKey: undefined,
      amount: '123',
      recipient: '0xrecipient',
      slippageBps: 100,
    };

    const result = hydrateInitialUnifiedTokenKeys(values, {
      originTokenKey: 'default-origin',
      destinationTokenKey: 'default-destination',
    });

    expect(result).toBe(values);
  });
});

describe('validateUnifiedBridgeTransfer', () => {
  test('validates the fee-adjusted bridge amount for exact-input transfers', async () => {
    const destinationToken = createMockToken({
      chainName: 'destination',
      symbol: 'USDC',
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: '0x2222222222222222222222222222222222222222',
    });
    const originToken = createMockToken({
      chainName: 'origin',
      symbol: 'USDC',
      addressOrDenom: '0x1111111111111111111111111111111111111111',
      collateralAddressOrDenom: '0x1111111111111111111111111111111111111111',
      connections: [createTokenConnectionMock(undefined, destinationToken)],
    });
    vi.spyOn(originToken, 'isFungibleWith').mockImplementation((token) => token === originToken);
    vi.mocked(getTransferToken).mockResolvedValue(originToken);

    const validateTransfer = vi.fn().mockResolvedValue(null);
    const warpCore = {
      multiProvider: {
        getProtocol: vi.fn().mockReturnValue(ProtocolType.Ethereum),
      },
      getInterchainTransferFee: vi.fn().mockResolvedValue({
        igpQuote: originToken.amount(100n),
        tokenFeeQuote: originToken.amount(50n),
      }),
      validateTransfer,
    };

    const errors = await validateUnifiedBridgeTransfer({
      warpCore: warpCore as any,
      bridgeTokenMap: new Map([
        [getTokenKey(originToken), originToken],
        [getTokenKey(destinationToken), destinationToken],
      ]),
      collateralGroups: groupTokensByCollateral([originToken]),
      values: {
        originTokenKey: 'origin',
        destinationTokenKey: 'destination',
        amount: '0.001',
        recipient: '',
        slippageBps: 50,
      },
      originToken: { bridgeToken: originToken } as any,
      destinationToken: { bridgeToken: destinationToken } as any,
      recipient: '0xrecipient',
      sender: '0xsender',
      accounts: {
        [ProtocolType.Ethereum]: {
          protocol: ProtocolType.Ethereum,
          addresses: [{ address: '0xsender' }],
        },
      } as any,
      routerAddressesByChainMap: {},
    });

    expect(errors).toBeNull();
    expect(validateTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        originTokenAmount: expect.objectContaining({ amount: 850n }),
      }),
    );
  });

  test('validates against the connected destination token for route-token transfers', async () => {
    const selectedDestinationToken = createMockToken({
      chainName: 'destination',
      symbol: 'USDC',
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: '0x9999999999999999999999999999999999999999',
    });
    const connectedDestinationToken = createMockToken({
      chainName: 'destination',
      symbol: 'USDC',
      addressOrDenom: '0x3333333333333333333333333333333333333333',
      collateralAddressOrDenom: '0x9999999999999999999999999999999999999999',
    });
    const originToken = createMockToken({
      chainName: 'origin',
      symbol: 'USDC',
      addressOrDenom: '0x1111111111111111111111111111111111111111',
      collateralAddressOrDenom: '0x1111111111111111111111111111111111111111',
      connections: [createTokenConnectionMock(undefined, connectedDestinationToken)],
    });
    vi.spyOn(originToken, 'isFungibleWith').mockImplementation((token) => token === originToken);
    vi.mocked(getTransferToken).mockResolvedValue(originToken);

    const validateTransfer = vi.fn().mockResolvedValue(null);
    const warpCore = {
      multiProvider: {
        getProtocol: vi.fn().mockReturnValue(ProtocolType.Ethereum),
      },
      getInterchainTransferFee: vi.fn().mockResolvedValue({
        igpQuote: originToken.amount(0n),
        tokenFeeQuote: undefined,
      }),
      validateTransfer,
    };

    const errors = await validateUnifiedBridgeTransfer({
      warpCore: warpCore as any,
      bridgeTokenMap: new Map([
        [getTokenKey(originToken), originToken],
        [getTokenKey(selectedDestinationToken), selectedDestinationToken],
        [getTokenKey(connectedDestinationToken), connectedDestinationToken],
      ]),
      collateralGroups: groupTokensByCollateral([originToken]),
      values: {
        originTokenKey: 'origin',
        destinationTokenKey: 'destination',
        amount: '0.001',
        recipient: '',
        slippageBps: 50,
      },
      originToken: { bridgeToken: originToken } as any,
      destinationToken: { bridgeToken: selectedDestinationToken } as any,
      recipient: '0xrecipient',
      sender: '0xsender',
      accounts: {
        [ProtocolType.Ethereum]: {
          protocol: ProtocolType.Ethereum,
          addresses: [{ address: '0xsender' }],
        },
      } as any,
      routerAddressesByChainMap: {},
    });

    expect(errors).toBeNull();
    expect(validateTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationToken: connectedDestinationToken,
      }),
    );
  });
});
