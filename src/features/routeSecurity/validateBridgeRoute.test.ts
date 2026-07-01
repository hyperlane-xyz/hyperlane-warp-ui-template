import type { ChainMap, ChainMetadata } from '@hyperlane-xyz/sdk';
import { describe, expect, test } from 'vitest';

import type { RouteResponse } from '../api/types';
import type { TrustedWarpRouteMap } from './trustedWarpRoutes';
import { validateBridgeOnlyRoute } from './validateBridgeRoute';

const NATIVE = '0x0000000000000000000000000000000000000000';
const ROUTER = '0x1111111111111111111111111111111111111111';
const COLLATERAL = '0x2222222222222222222222222222222222222222';
const BAD = '0x3333333333333333333333333333333333333333';
const DST_ROUTER = '0x4444444444444444444444444444444444444444';

const chainMetadata = {
  ethereum: { domainId: 1 },
  base: { domainId: 8453 },
  solanamainnet: { domainId: 1399811149 },
} as unknown as ChainMap<ChainMetadata>;

describe('validateBridgeOnlyRoute', () => {
  test('accepts a registry-matching native bridge route', () => {
    const route = bridgeRoute({
      asset: NATIVE,
      router: ROUTER,
      approval: null,
      warpRouteId: 'ETH/test',
    });

    expect(validateBridgeOnlyRoute(route, context(nativeRoutes()))).toEqual({ valid: true });
  });

  test('rejects native bridge routes that expose WETH as the asset', () => {
    const route = bridgeRoute({
      asset: COLLATERAL,
      router: ROUTER,
      approval: null,
      warpRouteId: 'ETH/test',
    });

    expect(validateBridgeOnlyRoute(route, context(nativeRoutes()))).toMatchObject({
      valid: false,
      reason: 'Native bridge asset must be native sentinel',
    });
  });

  test('rejects native bridge routes that request approval', () => {
    const route = bridgeRoute({
      asset: NATIVE,
      router: ROUTER,
      approval: { token: COLLATERAL, spender: ROUTER, amount: '1', kind: 'erc20' },
      warpRouteId: 'ETH/test',
    });

    expect(validateBridgeOnlyRoute(route, context(nativeRoutes()))).toMatchObject({
      valid: false,
      reason: 'Native bridge route must not request approval',
    });
  });

  test('accepts collateral routes using collateralAddressOrDenom for asset and approval token', () => {
    const route = bridgeRoute({
      asset: COLLATERAL,
      router: ROUTER,
      approval: { token: COLLATERAL, spender: ROUTER, amount: '1', kind: 'erc20' },
      warpRouteId: 'USDC/test',
    });

    expect(
      validateBridgeOnlyRoute(route, context(collateralRoutes(), COLLATERAL, DST_ROUTER)),
    ).toEqual({ valid: true });
  });

  test('rejects routes when the selected source token does not match registry discovery identity', () => {
    const route = bridgeRoute({
      asset: COLLATERAL,
      router: ROUTER,
      approval: null,
      warpRouteId: 'USDC/test',
    });

    expect(
      validateBridgeOnlyRoute(route, context(collateralRoutes(), BAD, DST_ROUTER)),
    ).toMatchObject({
      valid: false,
      reason: 'Source token does not match registry route',
    });
  });

  test('rejects routes when the selected destination token does not match registry discovery identity', () => {
    const route = bridgeRoute({
      asset: COLLATERAL,
      router: ROUTER,
      approval: null,
      warpRouteId: 'USDC/test',
    });

    expect(
      validateBridgeOnlyRoute(route, context(collateralRoutes(), COLLATERAL, BAD)),
    ).toMatchObject({
      valid: false,
      reason: 'Destination token does not match registry route',
    });
  });

  test('rejects collateral routes with a bad approval spender', () => {
    const route = bridgeRoute({
      asset: COLLATERAL,
      router: ROUTER,
      approval: { token: COLLATERAL, spender: BAD, amount: '1', kind: 'erc20' },
      warpRouteId: 'USDC/test',
    });

    expect(validateBridgeOnlyRoute(route, context(collateralRoutes()))).toMatchObject({
      valid: false,
      reason: 'Approval spender does not match registry route',
    });
  });

  test('rejects collateral routes with a bad approval token', () => {
    const route = bridgeRoute({
      asset: COLLATERAL,
      router: ROUTER,
      approval: { token: BAD, spender: ROUTER, amount: '1', kind: 'erc20' },
      warpRouteId: 'USDC/test',
    });

    expect(validateBridgeOnlyRoute(route, context(collateralRoutes()))).toMatchObject({
      valid: false,
      reason: 'Approval token does not match registry route',
    });
  });

  test('rejects bridge routes with a bad router', () => {
    const route = bridgeRoute({
      asset: COLLATERAL,
      router: BAD,
      approval: null,
      warpRouteId: 'USDC/test',
    });

    expect(validateBridgeOnlyRoute(route, context(collateralRoutes()))).toMatchObject({
      valid: false,
      reason: 'Bridge router does not match registry route',
    });
  });

  test('fails closed when the warp route is missing from the registry cache', () => {
    const route = bridgeRoute({
      asset: COLLATERAL,
      router: ROUTER,
      approval: null,
      warpRouteId: 'MISSING/test',
    });

    expect(validateBridgeOnlyRoute(route, context(collateralRoutes()))).toMatchObject({
      valid: false,
      reason: 'Warp route missing from registry',
    });
  });

  test('keeps swap routes outside this bridge-only gate', () => {
    const route: RouteResponse = {
      ...bridgeRoute({
        asset: BAD,
        router: BAD,
        approval: null,
        warpRouteId: 'MISSING/test',
      }),
      steps: [
        {
          type: 'swap',
          chain: 1,
          dex: 'test',
          tokenIn: COLLATERAL,
          tokenOut: BAD,
          amountIn: '1',
          amountOut: '1',
          path: [COLLATERAL, BAD],
          poolCount: 1,
        },
      ],
    };

    expect(validateBridgeOnlyRoute(route, context(collateralRoutes()))).toEqual({ valid: true });
  });

  test('compares non-EVM router addresses case-sensitively', () => {
    const route = bridgeRoute({
      asset: 'SolMint111',
      router: 'solrouter111',
      approval: null,
      warpRouteId: 'SOL/test',
      chain: 1399811149,
      destChain: 1,
    });

    expect(validateBridgeOnlyRoute(route, context(nonEvmRoutes()))).toMatchObject({
      valid: false,
      reason: 'Bridge router does not match registry route',
    });
  });
});

function context(trustedWarpRoutes: TrustedWarpRouteMap, srcToken?: string, dstToken?: string) {
  return { chainMetadata, trustedWarpRoutes, srcToken, dstToken };
}

function nativeRoutes(): TrustedWarpRouteMap {
  return {
    'eth/test': {
      id: 'ETH/test',
      tokens: [
        { chainName: 'ethereum', addressOrDenom: ROUTER, standard: 'EvmHypNative' },
        { chainName: 'base', addressOrDenom: DST_ROUTER, standard: 'EvmHypNative' },
      ],
    },
  };
}

function collateralRoutes(): TrustedWarpRouteMap {
  return {
    'usdc/test': {
      id: 'USDC/test',
      tokens: [
        {
          chainName: 'ethereum',
          addressOrDenom: ROUTER,
          collateralAddressOrDenom: COLLATERAL,
          standard: 'EvmHypCollateral',
        },
        { chainName: 'base', addressOrDenom: DST_ROUTER, standard: 'EvmHypSynthetic' },
      ],
    },
  };
}

function nonEvmRoutes(): TrustedWarpRouteMap {
  return {
    'sol/test': {
      id: 'SOL/test',
      tokens: [
        {
          chainName: 'solanamainnet',
          addressOrDenom: 'SolRouter111',
          collateralAddressOrDenom: 'SolMint111',
          standard: 'SealevelHypCollateral',
        },
        { chainName: 'ethereum', addressOrDenom: ROUTER, standard: 'EvmHypSynthetic' },
      ],
    },
  };
}

function bridgeRoute(args: {
  asset: string;
  router: string;
  approval: RouteResponse['approval'];
  warpRouteId: string;
  chain?: number;
  destChain?: number;
}): RouteResponse {
  return {
    steps: [
      {
        type: 'bridge',
        chain: args.chain ?? 1,
        destChain: args.destChain ?? 8453,
        asset: args.asset,
        router: args.router,
        amountIn: '1',
        amountOut: '1',
        bridgeSymbol: args.warpRouteId.split('/')[0],
        warpRouteId: args.warpRouteId,
        fee: {
          tokenFee: '0',
          igpToken: NATIVE,
          igpAmount: '0',
          localNativeFee: '0',
        },
      },
    ],
    output: '1',
    outputMin: '1',
    executionKind: 'warpDirect',
    connection: { symbol: args.warpRouteId.split('/')[0], warpRouteId: args.warpRouteId },
    gas: { originGas: '0', destGas: '0' },
    tx: null,
    approval: args.approval,
  };
}
