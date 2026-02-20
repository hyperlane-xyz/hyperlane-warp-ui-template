import { WarpCore } from '@hyperlane-xyz/sdk';
import { describe, expect, test, vi } from 'vitest';
import { createMockToken, createTokenConnectionMock } from '../../utils/test';
import {
  findConnectionToDestinationToken,
  matchesDestinationToken,
  resolveTransferRoute,
} from './routeResolution';

describe('routeResolution', () => {
  test('resolves route token pair by exact destination token', () => {
    const destinationToken = createMockToken({
      chainName: 'arbitrum',
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
    const originToken = createMockToken({
      chainName: 'ethereum',
      addressOrDenom: '0x1111111111111111111111111111111111111111',
      collateralAddressOrDenom: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      connections: [],
    });
    const routeOriginToken = createMockToken({
      chainName: 'ethereum',
      addressOrDenom: '0x3333333333333333333333333333333333333333',
      collateralAddressOrDenom: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: destinationToken.chainName,
          addressOrDenom: destinationToken.addressOrDenom,
          collateralAddressOrDenom: destinationToken.collateralAddressOrDenom,
        }),
      ],
    });

    const warpCore = {
      getTokensForRoute: vi.fn().mockReturnValue([routeOriginToken]),
    } as unknown as WarpCore;

    const resolved = resolveTransferRoute({
      warpCore,
      originToken,
      destinationToken,
    });

    expect(resolved).toBeDefined();
    expect(resolved?.originToken).toBe(routeOriginToken);
    expect(resolved?.destinationToken.addressOrDenom).toBe(destinationToken.addressOrDenom);
  });

  test('returns undefined when exact destination token route is missing', () => {
    const destinationToken = createMockToken({
      chainName: 'arbitrum',
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
    const originToken = createMockToken({
      chainName: 'ethereum',
      addressOrDenom: '0x1111111111111111111111111111111111111111',
      collateralAddressOrDenom: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      connections: [],
    });
    const routeOriginToken = createMockToken({
      chainName: 'ethereum',
      addressOrDenom: '0x3333333333333333333333333333333333333333',
      collateralAddressOrDenom: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: destinationToken.chainName,
          addressOrDenom: '0x4444444444444444444444444444444444444444',
          collateralAddressOrDenom: destinationToken.collateralAddressOrDenom,
        }),
      ],
    });

    const warpCore = {
      getTokensForRoute: vi.fn().mockReturnValue([routeOriginToken]),
    } as unknown as WarpCore;

    const resolved = resolveTransferRoute({
      warpCore,
      originToken,
      destinationToken,
    });

    expect(resolved).toBeUndefined();
  });

  test('supports destination collateral fallback only when explicitly enabled', () => {
    const destinationToken = createMockToken({
      chainName: 'arbitrum',
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
    const routeDestinationToken = createMockToken({
      chainName: 'arbitrum',
      addressOrDenom: '0x3333333333333333333333333333333333333333',
      collateralAddressOrDenom: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
    const originToken = createMockToken({
      chainName: 'ethereum',
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: routeDestinationToken.chainName,
          addressOrDenom: routeDestinationToken.addressOrDenom,
          collateralAddressOrDenom: routeDestinationToken.collateralAddressOrDenom,
        }),
      ],
    });

    expect(matchesDestinationToken(routeDestinationToken, destinationToken)).toBe(false);
    expect(matchesDestinationToken(routeDestinationToken, destinationToken, true)).toBe(true);

    expect(findConnectionToDestinationToken(originToken, destinationToken)).toBeUndefined();
    expect(findConnectionToDestinationToken(originToken, destinationToken, true)).toBeDefined();
  });
});
