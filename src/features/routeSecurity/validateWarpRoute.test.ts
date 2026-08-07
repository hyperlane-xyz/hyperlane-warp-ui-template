import type { ChainMap, ChainMetadata } from '@hyperlane-xyz/sdk';
import { describe, expect, test } from 'vitest';

import type { ChainDiscovery, RouteResponse } from '../api/types';
import type { RegistryWarpRouteMap } from '../warpRoutes/registryWarpRoutes';
import { validateWarpRoute } from './validateWarpRoute';

const NATIVE = '0x0000000000000000000000000000000000000000';
const ROUTER = '0x1111111111111111111111111111111111111111';
const COLLATERAL = '0x2222222222222222222222222222222222222222';
const BAD = '0x3333333333333333333333333333333333333333';
const DST_ROUTER = '0x4444444444444444444444444444444444444444';
const DST_COLLATERAL = '0x4545454545454545454545454545454545454545';
const UNIVERSAL_ROUTER = '0x5555555555555555555555555555555555555555';
const PERMIT2 = '0x6666666666666666666666666666666666666666';
const ALT_ROUTER = '0x7777777777777777777777777777777777777777';
const ALT_COLLATERAL = '0x8888888888888888888888888888888888888888';
const OP_EZETH = '0xacEB607CdF59EB8022Cc0699eEF3eCF246d149e2';
const ARB_EZETH = '0xB26bBfC6d1F469C821Ea25099017862e7368F4E8';
const EZETH_MAINNET_COLLATERAL = '0x2416092f143378750bb29b79eD961ab195CcEea5';
const STARKNET_ROUTER = '0x074238dfa02063792077820584c925b679a013cbab38e5ca61af5627d1eda736';
const STARKNET_TOKEN = '0x01a238dfa02063792077820584c925b679a013cbab38e5ca61af5627d1eda736';

const chainMetadata = {
  ethereum: { chainId: 1, domainId: 1001 },
  base: { chainId: 8453, domainId: 1002 },
  optimism: { chainId: 10, domainId: 1005 },
  arbitrum: { chainId: 42161, domainId: 1006 },
  celestia: { chainId: 222, domainId: 1007 },
  osmosis: { chainId: 555, domainId: 1008 },
  radix: { chainId: 333, domainId: 1009 },
  aleo: { chainId: 444, domainId: 1010 },
  solanamainnet: { chainId: 1399811149, domainId: 1003 },
  starknet: { chainId: 358974494, domainId: 1004 },
} as unknown as ChainMap<ChainMetadata>;

const chains = [
  chain({ id: 1, chainName: 'ethereum' }),
  chain({ id: 8453, chainName: 'base' }),
  chain({ id: 10, chainName: 'optimism' }),
  chain({ id: 42161, chainName: 'arbitrum' }),
  chain({ id: 222, chainName: 'celestia' }),
  chain({ id: 555, chainName: 'osmosis' }),
  chain({ id: 333, chainName: 'radix' }),
  chain({ id: 444, chainName: 'aleo' }),
  chain({ id: 1399811149, chainName: 'solanamainnet' }),
  chain({ id: 358974494, chainName: 'starknet' }),
];

const chainAddresses = {
  ethereum: { universalRouter: UNIVERSAL_ROUTER },
  base: { universalRouter: UNIVERSAL_ROUTER },
  solanamainnet: { universalRouter: UNIVERSAL_ROUTER },
  starknet: { universalRouter: UNIVERSAL_ROUTER },
};

describe('validateWarpRoute', () => {
  test('accepts a registry-matching native bridge route', () => {
    const route = bridgeRoute({
      asset: NATIVE,
      router: ROUTER,
      approval: null,
      warpRouteId: 'ETH/test',
    });

    expect(validateWarpRoute(route, context(nativeRoutes()))).toEqual({ valid: true });
  });

  test('rejects native bridge routes that expose WETH as the asset', () => {
    const route = bridgeRoute({
      asset: COLLATERAL,
      router: ROUTER,
      approval: null,
      warpRouteId: 'ETH/test',
    });

    expect(validateWarpRoute(route, context(nativeRoutes()))).toMatchObject({
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

    expect(validateWarpRoute(route, context(nativeRoutes()))).toMatchObject({
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

    expect(validateWarpRoute(route, context(collateralRoutes(), COLLATERAL, DST_ROUTER))).toEqual({
      valid: true,
    });
  });

  test('accepts routes with multiple registry tokens on the origin and destination chains', () => {
    const route = bridgeRoute({
      asset: ALT_COLLATERAL,
      router: ALT_ROUTER,
      approval: null,
      warpRouteId: 'MULTI/test',
    });

    expect(
      validateWarpRoute(
        route,
        context(multiTokenDestinationRoutes(), ALT_COLLATERAL, ALT_COLLATERAL),
      ),
    ).toEqual({ valid: true });
  });

  test('accepts non-lockbox XERC20 routes using addressOrDenom for selected token identity', () => {
    const route = bridgeRoute({
      asset: OP_EZETH,
      router: OP_EZETH,
      approval: { token: OP_EZETH, spender: OP_EZETH, amount: '1', kind: 'erc20' },
      warpRouteId: 'EZETH/renzo-prod',
      chain: 10,
      destChain: 42161,
    });

    expect(validateWarpRoute(route, context(xerc20Routes(), OP_EZETH, ARB_EZETH))).toEqual({
      valid: true,
    });
  });

  test.each([['EvmM0Portal'], ['EvmM0PortalLite']])(
    'accepts %s routes using collateralAddressOrDenom for spend token',
    (standard) => {
      const route = bridgeRoute({
        asset: COLLATERAL,
        router: ROUTER,
        approval: { token: COLLATERAL, spender: ROUTER, amount: '1', kind: 'erc20' },
        warpRouteId: `${standard}/test`,
      });

      expect(
        validateWarpRoute(
          route,
          context(collateralLikeRoutes(standard), COLLATERAL, DST_COLLATERAL),
        ),
      ).toEqual({ valid: true });
    },
  );

  test.each([['EvmHypSyntheticRebase'], ['EvmHypXERC20Lockbox'], ['EvmHypVSXERC20Lockbox']])(
    'accepts %s routes using addressOrDenom for spend token',
    (standard) => {
      const route = bridgeRoute({
        asset: ROUTER,
        router: ROUTER,
        approval: { token: ROUTER, spender: ROUTER, amount: '1', kind: 'erc20' },
        warpRouteId: `${standard}/test`,
      });

      expect(
        validateWarpRoute(route, context(collateralLikeRoutes(standard), ROUTER, DST_ROUTER)),
      ).toEqual({ valid: true });
    },
  );

  test.each([
    ['SealevelHypSynthetic', 1399811149, 'solanamainnet', 'SolRouter111', 'SolMint111'],
    ['CwHypSynthetic', 555, 'osmosis', 'cw-router-111', 'cw-token-111'],
    ['AleoHypSynthetic', 444, 'aleo', 'aleo-router-111', 'aleo-token-111'],
    [
      'CosmosNativeHypSynthetic',
      222,
      'celestia',
      '0x726f757465725f61707000000000000000000000000000020000000000000013',
      'hyperlane/0x726f757465725f61707000000000000000000000000000010000000000000014',
    ],
  ])(
    'accepts %s routes using addressOrDenom for spend token',
    (standard, chainId, chainName, router, collateral) => {
      const route = bridgeRoute({
        asset: router,
        router,
        approval: null,
        warpRouteId: `${standard}/test`,
        chain: chainId,
        destChain: 1,
      });

      expect(
        validateWarpRoute(
          route,
          context(nonEvmRoute(standard, chainName, router, collateral), router, ROUTER),
        ),
      ).toEqual({ valid: true });
    },
  );

  test.each([
    ['StarknetHypCollateral', 358974494, 'starknet', STARKNET_ROUTER, STARKNET_TOKEN],
    ['SealevelHypCrossCollateral', 1399811149, 'solanamainnet', 'SolRouter111', 'SolMint111'],
  ])(
    'accepts %s routes using collateralAddressOrDenom for spend token',
    (standard, chainId, chainName, router, collateral) => {
      const route = bridgeRoute({
        asset: collateral,
        router,
        approval: null,
        warpRouteId: `${standard}/test`,
        chain: chainId,
        destChain: 1,
      });

      expect(
        validateWarpRoute(
          route,
          context(nonEvmRoute(standard, chainName, router, collateral), collateral, ROUTER),
        ),
      ).toEqual({ valid: true });
    },
  );

  test.each([
    [
      'CosmosNativeHypCollateral',
      222,
      'celestia',
      '0x726f757465725f61707000000000000000000000000000010000000000000014',
      'hyperlane/0x726f757465725f61707000000000000000000000000000020000000000000013',
    ],
    [
      'RadixHypCollateral',
      333,
      'radix',
      'component_rdx1crrj42g0855jnpvfs6t9tff25vtq3lm292g3h07xrnz9l49mnsu3hy',
      'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
    ],
  ])(
    'accepts %s routes using native sentinel for selected token identity',
    (standard, chainId, chainName, router, collateral) => {
      const route = bridgeRoute({
        asset: NATIVE,
        router,
        approval: null,
        warpRouteId: `${standard}/test`,
        chain: chainId,
        destChain: 1,
      });

      expect(
        validateWarpRoute(
          route,
          context(nonEvmRoute(standard, chainName, router, collateral), NATIVE, ROUTER),
        ),
      ).toEqual({ valid: true });
    },
  );

  test('rejects routes when the selected source token does not match registry discovery identity', () => {
    const route = bridgeRoute({
      asset: COLLATERAL,
      router: ROUTER,
      approval: null,
      warpRouteId: 'USDC/test',
    });

    expect(validateWarpRoute(route, context(collateralRoutes(), BAD, DST_ROUTER))).toMatchObject({
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

    expect(validateWarpRoute(route, context(collateralRoutes(), COLLATERAL, BAD))).toMatchObject({
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

    expect(validateWarpRoute(route, context(collateralRoutes()))).toMatchObject({
      valid: false,
      reason: 'Approval spender does not match registry route',
    });
  });

  test('accepts universal router ERC20 approvals for bridge-only routes', () => {
    const route = bridgeRoute({
      asset: COLLATERAL,
      router: ROUTER,
      approval: { token: COLLATERAL, spender: UNIVERSAL_ROUTER, amount: '1', kind: 'erc20' },
      warpRouteId: 'USDC/test',
      executionKind: 'universalRouter',
    });

    expect(validateWarpRoute(route, context(collateralRoutes()))).toEqual({ valid: true });
  });

  test('rejects universal router approvals when engine discovery disagrees with registry addresses', () => {
    const route = bridgeRoute({
      asset: COLLATERAL,
      router: ROUTER,
      approval: { token: COLLATERAL, spender: UNIVERSAL_ROUTER, amount: '1', kind: 'erc20' },
      warpRouteId: 'USDC/test',
      executionKind: 'universalRouter',
    });
    const mismatchedChains = chains.map((chain) =>
      chain.id === 1 ? { ...chain, universalRouter: BAD } : chain,
    );

    expect(
      validateWarpRoute(route, context(collateralRoutes(), undefined, undefined, mismatchedChains)),
    ).toMatchObject({
      valid: false,
      reason: 'Chain universal router does not match registry',
    });
  });

  test('accepts Permit2 approvals that target the universal router', () => {
    const route = bridgeRoute({
      asset: COLLATERAL,
      router: ROUTER,
      approval: {
        token: COLLATERAL,
        spender: PERMIT2,
        permit2Spender: UNIVERSAL_ROUTER,
        amount: '1',
        kind: 'permit2',
      },
      warpRouteId: 'USDC/test',
      executionKind: 'universalRouter',
    });

    expect(validateWarpRoute(route, context(collateralRoutes()))).toEqual({ valid: true });
  });

  test('rejects Permit2 approvals without a target spender', () => {
    const route = bridgeRoute({
      asset: COLLATERAL,
      router: ROUTER,
      approval: { token: COLLATERAL, spender: PERMIT2, amount: '1', kind: 'permit2' },
      warpRouteId: 'USDC/test',
      executionKind: 'universalRouter',
    });

    expect(validateWarpRoute(route, context(collateralRoutes()))).toMatchObject({
      valid: false,
      reason: 'Permit2 approval missing chain contracts',
    });
  });

  test('rejects collateral routes with a bad approval token', () => {
    const route = bridgeRoute({
      asset: COLLATERAL,
      router: ROUTER,
      approval: { token: BAD, spender: ROUTER, amount: '1', kind: 'erc20' },
      warpRouteId: 'USDC/test',
    });

    expect(validateWarpRoute(route, context(collateralRoutes()))).toMatchObject({
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

    expect(validateWarpRoute(route, context(collateralRoutes()))).toMatchObject({
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

    expect(validateWarpRoute(route, context(collateralRoutes()))).toMatchObject({
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

    expect(validateWarpRoute(route, context(collateralRoutes()))).toEqual({ valid: true });
  });

  test('validates bridge router inside swap-containing routes', () => {
    const bridge = bridgeRoute({
      asset: COLLATERAL,
      router: BAD,
      approval: null,
      warpRouteId: 'USDC/test',
    });
    const route: RouteResponse = {
      ...bridge,
      steps: [
        {
          type: 'swap',
          chain: 1,
          dex: 'test',
          tokenIn: ROUTER,
          tokenOut: COLLATERAL,
          amountIn: '1',
          amountOut: '1',
          path: [ROUTER, COLLATERAL],
          poolCount: 1,
        },
        bridge.steps[0],
      ],
    };

    expect(validateWarpRoute(route, context(collateralRoutes(), ROUTER, DST_ROUTER))).toMatchObject(
      {
        valid: false,
        reason: 'Bridge router does not match registry route',
      },
    );
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

    expect(validateWarpRoute(route, context(nonEvmRoutes()))).toMatchObject({
      valid: false,
      reason: 'Bridge router does not match registry route',
    });
  });

  test('compares non-EVM hex addresses case-insensitively', () => {
    const route = bridgeRoute({
      asset: STARKNET_TOKEN.toUpperCase().replace('X', 'x'),
      router: STARKNET_ROUTER.toUpperCase().replace('X', 'x'),
      approval: null,
      warpRouteId: 'STRK/test',
      chain: 358974494,
      destChain: 1,
    });

    expect(validateWarpRoute(route, context(starknetRoutes()))).toEqual({ valid: true });
  });

  test('falls back to metadata chainId when engine chain discovery is unavailable', () => {
    const route = bridgeRoute({
      asset: COLLATERAL,
      router: ROUTER,
      approval: null,
      warpRouteId: 'USDC/test',
    });

    expect(validateWarpRoute(route, context(collateralRoutes(), undefined, undefined, []))).toEqual(
      {
        valid: true,
      },
    );
  });
});

function context(
  registryWarpRoutes: RegistryWarpRouteMap,
  srcToken?: string,
  dstToken?: string,
  chainDiscovery: ChainDiscovery[] = chains,
) {
  return {
    chainMetadata,
    chainAddresses,
    registryWarpRoutes,
    chains: chainDiscovery,
    srcToken,
    dstToken,
  };
}

function nativeRoutes(): RegistryWarpRouteMap {
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

function collateralRoutes(): RegistryWarpRouteMap {
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

function multiTokenDestinationRoutes(): RegistryWarpRouteMap {
  return {
    'multi/test': {
      id: 'MULTI/test',
      tokens: [
        {
          chainName: 'ethereum',
          addressOrDenom: ROUTER,
          collateralAddressOrDenom: COLLATERAL,
          standard: 'EvmHypCrossCollateralRouter',
        },
        {
          chainName: 'ethereum',
          addressOrDenom: ALT_ROUTER,
          collateralAddressOrDenom: ALT_COLLATERAL,
          standard: 'EvmHypCrossCollateralRouter',
        },
        {
          chainName: 'base',
          addressOrDenom: DST_ROUTER,
          collateralAddressOrDenom: DST_COLLATERAL,
          standard: 'EvmHypCrossCollateralRouter',
        },
        {
          chainName: 'base',
          addressOrDenom: ALT_ROUTER,
          collateralAddressOrDenom: ALT_COLLATERAL,
          standard: 'EvmHypCrossCollateralRouter',
        },
      ],
    },
  };
}

function xerc20Routes(): RegistryWarpRouteMap {
  return {
    'ezeth/renzo-prod': {
      id: 'EZETH/renzo-prod',
      tokens: [
        {
          chainName: 'optimism',
          addressOrDenom: OP_EZETH,
          collateralAddressOrDenom: EZETH_MAINNET_COLLATERAL,
          standard: 'EvmHypXERC20',
        },
        {
          chainName: 'arbitrum',
          addressOrDenom: ARB_EZETH,
          collateralAddressOrDenom: EZETH_MAINNET_COLLATERAL,
          standard: 'EvmHypXERC20',
        },
      ],
    },
  };
}

function collateralLikeRoutes(standard: string): RegistryWarpRouteMap {
  const routeId = `${standard}/test`;
  return {
    [routeId.toLowerCase()]: {
      id: routeId,
      tokens: [
        {
          chainName: 'ethereum',
          addressOrDenom: ROUTER,
          collateralAddressOrDenom: COLLATERAL,
          standard,
        },
        {
          chainName: 'base',
          addressOrDenom: DST_ROUTER,
          collateralAddressOrDenom: DST_COLLATERAL,
          standard,
        },
      ],
    },
  };
}

function nonEvmRoute(
  standard: string,
  chainName: string,
  router: string,
  collateral: string,
): RegistryWarpRouteMap {
  const routeId = `${standard}/test`;
  return {
    [routeId.toLowerCase()]: {
      id: routeId,
      tokens: [
        {
          chainName,
          addressOrDenom: router,
          collateralAddressOrDenom: collateral,
          standard,
        },
        { chainName: 'ethereum', addressOrDenom: ROUTER, standard: 'EvmHypSynthetic' },
      ],
    },
  };
}

function nonEvmRoutes(): RegistryWarpRouteMap {
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

function starknetRoutes(): RegistryWarpRouteMap {
  return {
    'strk/test': {
      id: 'STRK/test',
      tokens: [
        {
          chainName: 'starknet',
          addressOrDenom: STARKNET_ROUTER,
          collateralAddressOrDenom: STARKNET_TOKEN,
          standard: 'StarknetHypCollateral',
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
  executionKind?: RouteResponse['executionKind'];
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
    executionKind: args.executionKind ?? 'warpDirect',
    connection: { symbol: args.warpRouteId.split('/')[0], warpRouteId: args.warpRouteId },
    gas: { originGas: '0', destGas: '0' },
    tx: null,
    approval: args.approval,
  };
}

function chain(args: { id: number; chainName: string }): ChainDiscovery {
  return {
    id: args.id,
    name: args.chainName,
    chainName: args.chainName,
    protocol: 'ethereum',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    universalRouter: UNIVERSAL_ROUTER,
    permit2: PERMIT2,
    dex: null,
    canSwap: true,
    canExecute: true,
    supportsNative: true,
  };
}
