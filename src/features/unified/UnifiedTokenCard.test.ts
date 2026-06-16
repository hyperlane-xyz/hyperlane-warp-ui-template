import { ProtocolType } from '@hyperlane-xyz/utils';
import { describe, expect, test, vi } from 'vitest';

import { createMockToken, createTokenConnectionMock } from '../../utils/test';
import { getTokenKey, groupTokensByCollateral } from '../tokens/utils';
import { getTransferToken } from '../transfer/fees';
import { validateUnifiedBridgeTransfer } from './UnifiedTokenCard';

vi.mock('../transfer/fees', () => ({
  getTransferToken: vi.fn(),
}));

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
