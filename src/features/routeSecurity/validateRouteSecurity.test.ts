import type { ChainMap, ChainMetadata } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { describe, expect, test } from 'vitest';

import type { ChainDiscovery, RouteResponse } from '../api/types';
import type { RegistryWarpRouteMap } from '../warpRoutes/registryWarpRoutes';
import { validateRouteSecurity } from './validateRouteSecurity';

const NATIVE = '0x0000000000000000000000000000000000000000';
const TOKEN = '0x1111111111111111111111111111111111111111';
const MID_TOKEN = '0x2222222222222222222222222222222222222222';
const DST_TOKEN = '0x3333333333333333333333333333333333333333';
const UNIVERSAL_ROUTER = '0x4444444444444444444444444444444444444444';
const BAD = '0x5555555555555555555555555555555555555555';
const PERMIT2 = '0x6666666666666666666666666666666666666666';
const BRIDGE_ROUTER = '0x7777777777777777777777777777777777777777';
const DST_ROUTER = '0x8888888888888888888888888888888888888888';
const STARKNET_ROUTER = '0x074238dfa02063792077820584c925b679a013cbab38e5ca61af5627d1eda736';
const STARKNET_TOKEN = '0x01a238dfa02063792077820584c925b679a013cbab38e5ca61af5627d1eda736';
const SOL_UNIVERSAL_ROUTER_PROGRAM = '2CttnaLkYbNHbaFDFnQ8PMCnzUwTGrKnskBxPM4TRWGp';
const SOL_ROUTER = 'SolRouter1111111111111111111111111111111111';
const SOL_MINT = 'SolMint111111111111111111111111111111111111';

const ETH = 1;
const BASE = 8453;
const SOL = 1399811149;
const STARKNET = 358974494;

const chainMetadata = {
  ethereum: { chainId: ETH, domainId: ETH },
  base: { chainId: BASE, domainId: BASE },
  solanamainnet: { chainId: SOL, domainId: SOL },
  starknet: { chainId: STARKNET, domainId: STARKNET },
} as unknown as ChainMap<ChainMetadata>;

const chains = [
  chain({ id: ETH, chainName: 'ethereum', protocol: ProtocolType.Ethereum }),
  chain({ id: BASE, chainName: 'base', protocol: ProtocolType.Ethereum }),
  chain({
    id: SOL,
    chainName: 'solanamainnet',
    protocol: ProtocolType.Sealevel,
    universalRouter: NATIVE,
    permit2: NATIVE,
  }),
  chain({
    id: STARKNET,
    chainName: 'starknet',
    protocol: ProtocolType.Starknet,
    universalRouter: NATIVE,
    permit2: NATIVE,
  }),
];

describe('validateRouteSecurity', () => {
  test('accepts a universal router swap and bridge route with matching approval and tx target', () => {
    expect(validateRouteSecurity(universalRouterRoute(), context())).toEqual({ valid: true });
  });

  test('accepts a same-chain universal router swap route', () => {
    const route = sameChainSwapRoute();

    expect(validateRouteSecurity(route, context({ dstChain: ETH }))).toEqual({ valid: true });
  });

  test('rejects a route whose path starts on a different chain', () => {
    const route = universalRouterRoute();
    route.steps[0].chain = BASE;

    expect(validateRouteSecurity(route, context())).toMatchObject({
      valid: false,
      reason: 'Route step chain does not match expected path',
    });
  });

  test('rejects a route whose final chain does not match the request destination', () => {
    expect(
      validateRouteSecurity(universalRouterRoute(), context({ dstChain: STARKNET })),
    ).toMatchObject({
      valid: false,
      reason: 'Route destination does not match request destination',
    });
  });

  test('rejects Permit2 approvals because the UI only performs direct ERC20 approval', () => {
    const route = universalRouterRoute({
      approval: {
        token: TOKEN,
        spender: PERMIT2,
        permit2Spender: UNIVERSAL_ROUTER,
        amount: '100',
        kind: 'permit2',
      },
    });

    expect(validateRouteSecurity(route, context())).toMatchObject({
      valid: false,
      reason: 'Permit2 approvals are not supported by this UI',
    });
  });

  test('rejects approval amounts above the first route spend', () => {
    const route = universalRouterRoute({
      approval: { token: TOKEN, spender: UNIVERSAL_ROUTER, amount: '101', kind: 'erc20' },
    });

    expect(validateRouteSecurity(route, context())).toMatchObject({
      valid: false,
      reason: 'Approval amount exceeds route input amount',
    });
  });

  test('rejects universal router approvals to a different spender', () => {
    const route = universalRouterRoute({
      approval: { token: TOKEN, spender: BAD, amount: '100', kind: 'erc20' },
    });

    expect(validateRouteSecurity(route, context())).toMatchObject({
      valid: false,
      reason: 'Approval spender does not match chain universal router',
    });
  });

  test('rejects EVM route txs sent to a different executor', () => {
    const route = universalRouterRoute({ txTo: BAD });

    expect(validateRouteSecurity(route, context())).toMatchObject({
      valid: false,
      reason: 'EVM transaction target does not match route executor',
    });
  });

  test('accepts warpDirect EVM route txs sent to the bridge router', () => {
    const route = universalRouterRoute({
      approval: null,
      executionKind: 'warpDirect',
      txTo: BRIDGE_ROUTER,
    });

    expect(validateRouteSecurity(route, context())).toEqual({ valid: true });
  });

  test('accepts an SDK warp tx with matching protocol and warpRouteId metadata', () => {
    expect(validateRouteSecurity(starknetSdkWarpRoute(), starknetContext())).toEqual({
      valid: true,
    });
  });

  test('rejects SDK warp txs with mismatched protocol', () => {
    const route = starknetSdkWarpRoute({ protocol: ProtocolType.Ethereum });

    expect(validateRouteSecurity(route, starknetContext())).toMatchObject({
      valid: false,
      reason: 'SDK transaction protocol does not match source chain',
    });
  });

  test('rejects SDK warp txs with mismatched warpRouteId metadata', () => {
    const route = starknetSdkWarpRoute({ warpRouteId: 'OTHER/test' });

    expect(validateRouteSecurity(route, starknetContext())).toMatchObject({
      valid: false,
      reason: 'SDK transaction warpRouteId does not match route',
    });
  });

  test('rejects SDK warp txs with known targets that do not match the bridge router', () => {
    const route = starknetSdkWarpRoute({ contractAddress: BAD });

    expect(validateRouteSecurity(route, starknetContext())).toMatchObject({
      valid: false,
      reason: 'SDK transaction target does not match bridge router',
    });
  });

  test('accepts SDK warp txs without an inspectable transaction target', () => {
    const route = starknetSdkWarpRoute({ transaction: { manifest: 'opaque' } });

    expect(validateRouteSecurity(route, starknetContext())).toEqual({ valid: true });
  });

  test('accepts Sealevel universal router txs that include bridge router and asset accounts', () => {
    expect(validateRouteSecurity(sealevelUniversalRouterRoute(), solanaContext())).toEqual({
      valid: true,
    });
  });

  test('rejects Sealevel universal router txs missing bridge route accounts', () => {
    const route = sealevelUniversalRouterRoute({ accounts: [{ pubkey: SOL_MINT }] });

    expect(validateRouteSecurity(route, solanaContext())).toMatchObject({
      valid: false,
      reason: 'Sealevel transaction missing bridge router account',
    });
  });
});

function context(routeOverrides: Partial<RouteSecurityTestContext> = {}) {
  return {
    chainMetadata,
    registryWarpRoutes: {},
    chains,
    srcChain: ETH,
    dstChain: BASE,
    srcToken: TOKEN,
    dstToken: DST_TOKEN,
    ...routeOverrides,
  };
}

function starknetContext() {
  return context({
    registryWarpRoutes: starknetRoutes(),
    srcChain: STARKNET,
    dstChain: ETH,
    srcToken: STARKNET_TOKEN,
    dstToken: DST_ROUTER,
  });
}

function solanaContext(overrides: Partial<RouteSecurityTestContext> = {}) {
  return context({
    registryWarpRoutes: solanaRoutes(),
    srcChain: SOL,
    dstChain: ETH,
    srcToken: SOL_MINT,
    dstToken: DST_ROUTER,
    ...overrides,
  });
}

type RouteSecurityTestContext = Parameters<typeof validateRouteSecurity>[1];

function universalRouterRoute(
  args: {
    approval?: RouteResponse['approval'];
    executionKind?: RouteResponse['executionKind'];
    txTo?: string;
  } = {},
): RouteResponse {
  return {
    steps: [
      {
        type: 'swap',
        chain: ETH,
        dex: 'test',
        tokenIn: TOKEN,
        tokenOut: MID_TOKEN,
        amountIn: '100',
        amountOut: '90',
        path: [TOKEN, MID_TOKEN],
        poolCount: 1,
      },
      {
        type: 'bridge',
        chain: ETH,
        destChain: BASE,
        asset: MID_TOKEN,
        router: BRIDGE_ROUTER,
        amountIn: '90',
        amountOut: '90',
        bridgeSymbol: 'TEST',
        warpRouteId: 'TEST/route',
        fee: { tokenFee: '0', igpToken: NATIVE, igpAmount: '0', localNativeFee: '0' },
      },
    ],
    output: '90',
    outputMin: '89',
    executionKind: args.executionKind ?? 'universalRouter',
    connection: { symbol: 'TEST', warpRouteId: 'TEST/route' },
    gas: { originGas: '0', destGas: '0' },
    tx: { to: args.txTo ?? UNIVERSAL_ROUTER, data: '0x', value: '0' },
    approval:
      'approval' in args
        ? args.approval!
        : {
            token: TOKEN,
            spender: UNIVERSAL_ROUTER,
            amount: '100',
            kind: 'erc20',
          },
  };
}

function sameChainSwapRoute(): RouteResponse {
  return {
    steps: [
      {
        type: 'swap',
        chain: ETH,
        dex: 'test',
        tokenIn: TOKEN,
        tokenOut: DST_TOKEN,
        amountIn: '100',
        amountOut: '90',
        path: [TOKEN, DST_TOKEN],
        poolCount: 1,
      },
    ],
    output: '90',
    outputMin: '89',
    executionKind: 'universalRouter',
    connection: null,
    gas: { originGas: '0', destGas: '0' },
    tx: { to: UNIVERSAL_ROUTER, data: '0x', value: '0' },
    approval: {
      token: TOKEN,
      spender: UNIVERSAL_ROUTER,
      amount: '100',
      kind: 'erc20',
    },
  };
}

function starknetSdkWarpRoute(
  args: {
    contractAddress?: string;
    protocol?: ProtocolType;
    transaction?: unknown;
    warpRouteId?: string;
  } = {},
): RouteResponse {
  return {
    steps: [
      {
        type: 'bridge',
        chain: STARKNET,
        destChain: ETH,
        asset: STARKNET_TOKEN,
        router: STARKNET_ROUTER,
        amountIn: '100',
        amountOut: '100',
        bridgeSymbol: 'STRK',
        warpRouteId: 'STRK/test',
        fee: { tokenFee: '0', igpToken: NATIVE, igpAmount: '0', localNativeFee: '0' },
      },
    ],
    output: '100',
    outputMin: '100',
    executionKind: 'sdkWarp',
    connection: { symbol: 'STRK', warpRouteId: 'STRK/test' },
    gas: { originGas: '0', destGas: '0' },
    tx: {
      protocol: args.protocol ?? ProtocolType.Starknet,
      type: 'starknet',
      category: 'transfer',
      transaction: args.transaction ?? {
        contractAddress: args.contractAddress ?? STARKNET_ROUTER,
        entrypoint: 'transfer_remote',
        calldata: [],
      },
      metadata: { warpRouteId: args.warpRouteId ?? 'STRK/test' },
    },
    approval: null,
  };
}

function sealevelUniversalRouterRoute(
  args: {
    accounts?: Array<{ pubkey: string; isSigner?: boolean; isWritable?: boolean }>;
    txTo?: string;
  } = {},
): RouteResponse {
  return {
    steps: [
      {
        type: 'bridge',
        chain: SOL,
        destChain: ETH,
        asset: SOL_MINT,
        router: SOL_ROUTER,
        amountIn: '100',
        amountOut: '100',
        bridgeSymbol: 'SOL',
        warpRouteId: 'SOL/test',
        fee: { tokenFee: '0', igpToken: NATIVE, igpAmount: '0', localNativeFee: '0' },
      },
    ],
    output: '100',
    outputMin: '100',
    executionKind: 'universalRouter',
    connection: { symbol: 'SOL', warpRouteId: 'SOL/test' },
    gas: { originGas: '0', destGas: '0' },
    tx: {
      to: args.txTo ?? SOL_UNIVERSAL_ROUTER_PROGRAM,
      data: '',
      value: '0',
      accounts: (args.accounts ?? [{ pubkey: SOL_ROUTER }, { pubkey: SOL_MINT }]).map(
        (account) => ({
          pubkey: account.pubkey,
          isSigner: account.isSigner ?? false,
          isWritable: account.isWritable ?? false,
        }),
      ),
    },
    approval: null,
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
        { chainName: 'ethereum', addressOrDenom: DST_ROUTER, standard: 'EvmHypSynthetic' },
      ],
    },
  };
}

function solanaRoutes(): RegistryWarpRouteMap {
  return {
    'sol/test': {
      id: 'SOL/test',
      tokens: [
        {
          chainName: 'solanamainnet',
          addressOrDenom: SOL_ROUTER,
          collateralAddressOrDenom: SOL_MINT,
          standard: 'SealevelHypCollateral',
        },
        { chainName: 'ethereum', addressOrDenom: DST_ROUTER, standard: 'EvmHypSynthetic' },
      ],
    },
  };
}

function chain(args: {
  id: number;
  chainName: string;
  protocol: ProtocolType;
  universalRouter?: string;
  permit2?: string;
}): ChainDiscovery {
  return {
    id: args.id,
    name: args.chainName,
    chainName: args.chainName,
    protocol: args.protocol,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    universalRouter: args.universalRouter ?? UNIVERSAL_ROUTER,
    permit2: args.permit2 ?? PERMIT2,
    dex: null,
    canSwap: true,
    canExecute: true,
    supportsNative: true,
  };
}
