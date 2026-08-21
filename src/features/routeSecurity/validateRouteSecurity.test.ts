import type { ChainMap, ChainMetadata } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { PublicKey } from '@solana/web3.js';
import { encodeFunctionData, erc20Abi } from 'viem';
import { describe, expect, test } from 'vitest';

import type { ChainDiscovery, RouteResponse, RouteTx } from '../api/types';
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
const ETH_WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const BASE_WETH = '0x4200000000000000000000000000000000000006';
const STARKNET_ROUTER = '0x074238dfa02063792077820584c925b679a013cbab38e5ca61af5627d1eda736';
const STARKNET_TOKEN = '0x01a238dfa02063792077820584c925b679a013cbab38e5ca61af5627d1eda736';
const SOL_UNIVERSAL_ROUTER_PROGRAM = '2CttnaLkYbNHbaFDFnQ8PMCnzUwTGrKnskBxPM4TRWGp';
const SOL_ROUTER = 'SolRouter1111111111111111111111111111111111';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const SOL_OWNER = 'ApMsTRbsbBpsmzpht4JpzudaBEef4AqW1GfnEf6az6h9';
const SOL_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

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
    universalRouter: SOL_UNIVERSAL_ROUTER_PROGRAM,
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

const chainAddresses = {
  ethereum: { universalRouter: UNIVERSAL_ROUTER },
  base: { universalRouter: UNIVERSAL_ROUTER },
  solanamainnet: { universalRouter: SOL_UNIVERSAL_ROUTER_PROGRAM },
  starknet: { universalRouter: NATIVE },
};

describe('validateRouteSecurity', () => {
  test('accepts a universal router swap and bridge route with matching approval and tx target', () => {
    expect(validateRouteSecurity(universalRouterRoute(), context())).toEqual({ valid: true });
  });

  test('accepts trusted wrapped native tokens around a native bridge', () => {
    expect(
      validateRouteSecurity(
        wrappedNativeBridgeRoute(),
        context({ registryWarpRoutes: nativeUniversalRouterRoutes() }),
      ),
    ).toEqual({ valid: true });
  });

  test('accepts the native sentinel directly at native bridge boundaries', () => {
    const route = wrappedNativeBridgeRoute();
    if (route.steps[0].type !== 'swap') throw new Error('expected source swap');
    if (route.steps[2].type !== 'swap') throw new Error('expected destination swap');
    route.steps[0].tokenOut = NATIVE;
    route.steps[0].path = [TOKEN, NATIVE];
    route.steps[2].tokenIn = NATIVE;
    route.steps[2].path = [NATIVE, DST_TOKEN];

    expect(
      validateRouteSecurity(route, context({ registryWarpRoutes: nativeUniversalRouterRoutes() })),
    ).toEqual({ valid: true });
  });

  test('does not treat trusted wrapped native as a non-native bridge token', () => {
    const route = universalRouterRoute();
    if (route.steps[0].type !== 'swap') throw new Error('expected source swap');
    route.steps[0].tokenOut = ETH_WETH;
    route.steps[0].path = [TOKEN, ETH_WETH];

    expect(validateRouteSecurity(route, context())).toMatchObject({
      valid: false,
      reason: 'Source token does not match registry route',
    });
  });

  test('does not treat trusted wrapped native specially between ordinary swaps', () => {
    const route = sameChainSwapRoute();
    route.steps = [
      {
        type: 'swap',
        chain: ETH,
        dex: 'test',
        tokenIn: TOKEN,
        tokenOut: ETH_WETH,
        amountIn: '100',
        amountOut: '95',
        path: [TOKEN, ETH_WETH],
        poolCount: 1,
      },
      {
        type: 'swap',
        chain: ETH,
        dex: 'test',
        tokenIn: BAD,
        tokenOut: DST_TOKEN,
        amountIn: '95',
        amountOut: '90',
        path: [BAD, DST_TOKEN],
        poolCount: 1,
      },
    ];

    expect(validateRouteSecurity(route, context({ dstChain: ETH }))).toMatchObject({
      valid: false,
      reason: 'Route step tokens are discontinuous',
    });
  });

  test('rejects an untrusted wrapped native token before a native bridge', () => {
    const route = wrappedNativeBridgeRoute();
    if (route.steps[0].type !== 'swap') throw new Error('expected source swap');
    route.steps[0].tokenOut = BAD;

    expect(
      validateRouteSecurity(route, context({ registryWarpRoutes: nativeUniversalRouterRoutes() })),
    ).toMatchObject({
      valid: false,
      reason: 'Source token does not match registry route',
    });
  });

  test('rejects an untrusted wrapped native token after a native bridge', () => {
    const route = wrappedNativeBridgeRoute();
    if (route.steps[2].type !== 'swap') throw new Error('expected destination swap');
    route.steps[2].tokenIn = BAD;

    expect(
      validateRouteSecurity(route, context({ registryWarpRoutes: nativeUniversalRouterRoutes() })),
    ).toMatchObject({
      valid: false,
      reason: 'Destination token does not match registry route',
    });
  });

  test('rejects wrapped native bridge boundaries outside universal router execution', () => {
    const route = wrappedNativeBridgeRoute();
    route.executionKind = 'warpDirect';

    expect(
      validateRouteSecurity(route, context({ registryWarpRoutes: nativeUniversalRouterRoutes() })),
    ).toMatchObject({
      valid: false,
      reason: 'Source token does not match registry route',
    });
  });

  test('keeps native bridge assets restricted to the native sentinel', () => {
    const route = wrappedNativeBridgeRoute();
    if (route.steps[1].type !== 'bridge') throw new Error('expected bridge');
    route.steps[1].asset = ETH_WETH;

    expect(
      validateRouteSecurity(route, context({ registryWarpRoutes: nativeUniversalRouterRoutes() })),
    ).toMatchObject({
      valid: false,
      reason: 'Native bridge asset must be native sentinel',
    });
  });

  test('keeps native bridge routers bound to the registry', () => {
    const route = wrappedNativeBridgeRoute();
    if (route.steps[1].type !== 'bridge') throw new Error('expected bridge');
    route.steps[1].router = BAD;

    expect(
      validateRouteSecurity(route, context({ registryWarpRoutes: nativeUniversalRouterRoutes() })),
    ).toMatchObject({
      valid: false,
      reason: 'Bridge router does not match registry route',
    });
  });

  test('accepts a same-chain universal router swap route', () => {
    const route = sameChainSwapRoute();

    expect(validateRouteSecurity(route, context({ dstChain: ETH }))).toEqual({ valid: true });
  });

  test('accepts selected native token when route spends and outputs its wrapped token', () => {
    const route = sameChainSwapRoute();
    if (route.steps[0].type !== 'swap') throw new Error('expected swap');
    route.steps[0].chain = BASE;
    route.steps[0].tokenIn = BASE_WETH;
    route.steps[0].tokenOut = BASE_WETH;
    route.steps[0].path = [BASE_WETH, BASE_WETH];
    route.approval = null;

    expect(
      validateRouteSecurity(
        route,
        context({
          srcChain: BASE,
          dstChain: BASE,
          srcToken: NATIVE,
          dstToken: NATIVE,
          srcTokenWrappedAddress: BASE_WETH,
          dstTokenWrappedAddress: BASE_WETH,
        }),
      ),
    ).toEqual({ valid: true });
  });

  test('rejects wrapped native route token when selected native token lacks a wrapped address', () => {
    const route = sameChainSwapRoute();
    if (route.steps[0].type !== 'swap') throw new Error('expected swap');
    route.steps[0].chain = BASE;
    route.steps[0].tokenIn = BASE_WETH;
    route.steps[0].tokenOut = BASE_WETH;
    route.steps[0].path = [BASE_WETH, BASE_WETH];
    route.approval = null;

    expect(
      validateRouteSecurity(
        route,
        context({ srcChain: BASE, dstChain: BASE, srcToken: NATIVE, dstToken: NATIVE }),
      ),
    ).toMatchObject({
      valid: false,
      reason: 'Route input token does not match request',
    });
  });

  test('rejects approval when selected source token is native even if route spends wrapped native', () => {
    const route = sameChainSwapRoute();
    if (route.steps[0].type !== 'swap') throw new Error('expected swap');
    route.steps[0].chain = BASE;
    route.steps[0].tokenIn = BASE_WETH;
    route.steps[0].tokenOut = DST_TOKEN;
    route.steps[0].path = [BASE_WETH, DST_TOKEN];
    route.approval = {
      token: BASE_WETH,
      spender: UNIVERSAL_ROUTER,
      amount: '100',
      kind: 'erc20',
    };

    expect(
      validateRouteSecurity(
        route,
        context({
          srcChain: BASE,
          dstChain: BASE,
          srcToken: NATIVE,
          srcTokenWrappedAddress: BASE_WETH,
        }),
      ),
    ).toMatchObject({
      valid: false,
      reason: 'Native route must not request approval',
    });
  });

  test('rejects pure swap routes whose output token does not match the request', () => {
    const route = sameChainSwapRoute();
    if (route.steps[0].type !== 'swap') throw new Error('expected swap');
    route.steps[0].tokenOut = BAD;

    expect(validateRouteSecurity(route, context({ dstChain: ETH }))).toMatchObject({
      valid: false,
      reason: 'Route output token does not match request',
    });
  });

  test('rejects routes with discontinuous step amounts', () => {
    const route = universalRouterRoute();
    if (route.steps[1].type !== 'bridge') throw new Error('expected bridge');
    route.steps[1].amountIn = '91';

    expect(validateRouteSecurity(route, context())).toMatchObject({
      valid: false,
      reason: 'Route step amounts are discontinuous',
    });
  });

  test('rejects routes with discontinuous step tokens', () => {
    const route = sameChainSwapRoute();
    route.steps = [
      {
        type: 'swap',
        chain: ETH,
        dex: 'test',
        tokenIn: TOKEN,
        tokenOut: MID_TOKEN,
        amountIn: '100',
        amountOut: '95',
        path: [TOKEN, MID_TOKEN],
        poolCount: 1,
      },
      {
        type: 'swap',
        chain: ETH,
        dex: 'test',
        tokenIn: BAD,
        tokenOut: DST_TOKEN,
        amountIn: '95',
        amountOut: '90',
        path: [BAD, DST_TOKEN],
        poolCount: 1,
      },
    ];

    expect(validateRouteSecurity(route, context({ dstChain: ETH }))).toMatchObject({
      valid: false,
      reason: 'Route step tokens are discontinuous',
    });
  });

  test('accepts chain protocols with different casing', () => {
    const mixedCaseChains = chains.map((chain) =>
      chain.id === ETH ? { ...chain, protocol: 'Ethereum' } : chain,
    );

    expect(
      validateRouteSecurity(universalRouterRoute(), context({ chains: mixedCaseChains })),
    ).toEqual({ valid: true });
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

  test('rejects approval amounts below the first route spend', () => {
    const route = universalRouterRoute({
      approval: { token: TOKEN, spender: UNIVERSAL_ROUTER, amount: '99', kind: 'erc20' },
    });

    expect(validateRouteSecurity(route, context())).toMatchObject({
      valid: false,
      reason: 'Approval amount is below route input amount',
    });
  });

  test('rejects invalid approval amounts without throwing', () => {
    const route = universalRouterRoute({
      approval: { token: TOKEN, spender: UNIVERSAL_ROUTER, amount: 'invalid', kind: 'erc20' },
    });

    expect(() => validateRouteSecurity(route, context())).not.toThrow();
    expect(validateRouteSecurity(route, context())).toMatchObject({
      valid: false,
      reason: 'Approval route has invalid amount',
    });
  });

  test('rejects approvals for native first-spend routes', () => {
    const route = universalRouterRoute({
      approval: { token: NATIVE, spender: UNIVERSAL_ROUTER, amount: '100', kind: 'erc20' },
    });
    if (route.steps[0].type !== 'swap') throw new Error('expected swap first step');
    route.steps[0].tokenIn = NATIVE;
    route.steps[0].path = [NATIVE, MID_TOKEN];

    expect(validateRouteSecurity(route, context({ srcToken: NATIVE }))).toMatchObject({
      valid: false,
      reason: 'Native route must not request approval',
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

  test('rejects universal router routes when engine discovery disagrees with registry addresses', () => {
    const route = universalRouterRoute();
    const mismatchedChains = chains.map((chain) =>
      chain.id === ETH ? { ...chain, universalRouter: BAD } : chain,
    );

    expect(validateRouteSecurity(route, context({ chains: mismatchedChains }))).toMatchObject({
      valid: false,
      reason: 'Chain universal router does not match registry',
    });
  });

  test('includes warpRouteId when universal router approval target is unavailable', () => {
    const route = universalRouterRoute();
    const missingUniversalRouter = { ...chainAddresses, ethereum: {} };

    expect(
      validateRouteSecurity(route, context({ chainAddresses: missingUniversalRouter })),
    ).toMatchObject({
      valid: false,
      reason: 'Universal router approval target unavailable',
      warpRouteId: 'TEST/route',
    });
  });

  test('rejects malformed engine token values without throwing', () => {
    const route = universalRouterRoute({
      approval: {
        token: 'not-an-address',
        spender: UNIVERSAL_ROUTER,
        amount: '100',
        kind: 'erc20',
      },
    });

    expect(() => validateRouteSecurity(route, context())).not.toThrow();
    expect(validateRouteSecurity(route, context())).toMatchObject({
      valid: false,
      reason: 'Approval token does not match route input token',
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

  test('accepts SDK warp tx protocols with different casing', () => {
    expect(
      validateRouteSecurity(starknetSdkWarpRoute({ protocol: 'Starknet' }), starknetContext()),
    ).toEqual({
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

  test('accepts SDK warp routes with an SDK approval tx before the transfer tx', () => {
    const route = evmSdkWarpRoute();

    expect(validateRouteSecurity(route, evmSdkWarpContext())).toEqual({ valid: true });
  });

  test('accepts SDK warp routes with revoke and approve txs before the transfer tx', () => {
    const route = evmSdkWarpRoute({ includeRevoke: true });

    expect(validateRouteSecurity(route, evmSdkWarpContext())).toEqual({ valid: true });
  });

  test('rejects SDK warp approval txs with mismatched bridge spender', () => {
    const route = evmSdkWarpRoute({ approvalSpender: BAD });

    expect(validateRouteSecurity(route, evmSdkWarpContext())).toMatchObject({
      valid: false,
      reason: 'SDK approval spender does not match bridge router',
    });
  });

  test('rejects SDK warp revoke txs with nonzero amount', () => {
    const route = evmSdkWarpRoute({ includeRevoke: true, revokeAmount: '1' });

    expect(validateRouteSecurity(route, evmSdkWarpContext())).toMatchObject({
      valid: false,
      reason: 'SDK revoke amount must be zero',
    });
  });

  test('rejects SDK warp tx lists without a transfer tx', () => {
    const route = evmSdkWarpRoute({ omitTransfer: true });

    expect(validateRouteSecurity(route, evmSdkWarpContext())).toMatchObject({
      valid: false,
      reason: 'SDK route missing transfer transaction',
    });
  });

  test('rejects SDK warp tx lists with a trailing revoke after transfer', () => {
    const route = evmSdkWarpRoute({ trailingRevoke: true });

    expect(validateRouteSecurity(route, evmSdkWarpContext())).toMatchObject({
      valid: false,
      reason: 'SDK transfer transaction must be last',
    });
  });

  test('rejects SDK warp tx lists with multiple transfer txs', () => {
    const route = evmSdkWarpRoute({ transferCount: 2 });

    expect(validateRouteSecurity(route, evmSdkWarpContext())).toMatchObject({
      valid: false,
      reason: 'SDK route has multiple transfer transactions',
    });
  });

  test('rejects SDK warp tx lists with unsupported pre-transfer categories', () => {
    const route = evmSdkWarpRoute({ unsupportedCategory: true });

    expect(validateRouteSecurity(route, evmSdkWarpContext())).toMatchObject({
      valid: false,
      reason: 'SDK transaction category is not supported',
    });
  });

  test('accepts Sealevel universal router txs that include bridge router and asset accounts', () => {
    expect(validateRouteSecurity(sealevelUniversalRouterRoute(), solanaContext())).toEqual({
      valid: true,
    });
  });

  test('accepts Sealevel native assets without a token account', () => {
    const route = sealevelUniversalRouterRoute({
      accounts: [{ pubkey: SOL_ROUTER }],
      asset: NATIVE,
      warpRouteId: 'SOL/native',
    });

    expect(
      validateRouteSecurity(
        route,
        solanaContext({
          registryWarpRoutes: solanaNativeRoutes(),
          srcToken: NATIVE,
        }),
      ),
    ).toEqual({ valid: true });
  });

  test('rejects Sealevel universal router txs sent to a different program', () => {
    const route = sealevelUniversalRouterRoute({ txTo: SOL_ROUTER });

    expect(validateRouteSecurity(route, solanaContext())).toMatchObject({
      valid: false,
      reason: 'Sealevel transaction target does not match universal router',
    });
  });

  test('rejects Sealevel universal router routes when engine discovery disagrees with registry addresses', () => {
    const route = sealevelUniversalRouterRoute();
    const mismatchedChains = chains.map((chain) =>
      chain.id === SOL ? { ...chain, universalRouter: SOL_ROUTER } : chain,
    );

    expect(validateRouteSecurity(route, solanaContext({ chains: mismatchedChains }))).toMatchObject(
      {
        valid: false,
        reason: 'Chain universal router does not match registry',
      },
    );
  });

  test('rejects Sealevel universal router txs missing bridge route accounts', () => {
    const route = sealevelUniversalRouterRoute({ accounts: [{ pubkey: SOL_MINT }] });

    expect(validateRouteSecurity(route, solanaContext())).toMatchObject({
      valid: false,
      reason: 'Sealevel transaction missing bridge router account',
    });
  });

  test('rejects Sealevel universal router txs with unsafe pre-instructions', () => {
    const route = sealevelUniversalRouterRoute();
    route.tx = {
      ...route.tx!,
      preInstructions: [{ programId: BAD, accounts: [], data: '' }],
    };

    expect(validateRouteSecurity(route, solanaContext())).toMatchObject({
      valid: false,
      reason: 'Sealevel pre-instruction program is not allowed',
    });
  });

  test('rejects Sealevel system transfer pre-instructions', () => {
    const route = sealevelUniversalRouterRoute();
    route.tx = {
      ...route.tx!,
      preInstructions: [
        {
          programId: '11111111111111111111111111111111',
          accounts: [
            {
              pubkey: 'User111111111111111111111111111111111111',
              isSigner: true,
              isWritable: true,
            },
            {
              pubkey: 'Bad1111111111111111111111111111111111111',
              isSigner: false,
              isWritable: true,
            },
          ],
          data: 'AgAAAAEAAAAAAAAA',
        },
      ],
    };

    expect(validateRouteSecurity(route, solanaContext())).toMatchObject({
      valid: false,
      reason: 'Sealevel pre-instruction program is not allowed',
    });
  });

  test('accepts Sealevel idempotent ATA setup pre-instructions', () => {
    const ata = solanaAta(SOL_OWNER, SOL_MINT, SOL_TOKEN_PROGRAM);
    const route = sealevelUniversalRouterRoute();
    const tx = route.tx as Extract<RouteTx, { to: string }>;
    route.tx = {
      ...tx,
      accounts: [...(tx.accounts ?? []), { pubkey: ata, isSigner: false, isWritable: true }],
      preInstructions: [
        {
          programId: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
          accounts: [
            {
              pubkey: SOL_OWNER,
              isSigner: true,
              isWritable: true,
            },
            {
              pubkey: ata,
              isSigner: false,
              isWritable: true,
            },
            {
              pubkey: SOL_OWNER,
              isSigner: false,
              isWritable: false,
            },
            { pubkey: SOL_MINT, isSigner: false, isWritable: false },
            { pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: false },
            {
              pubkey: SOL_TOKEN_PROGRAM,
              isSigner: false,
              isWritable: false,
            },
          ],
          data: 'AQ==',
        },
      ],
    };

    expect(validateRouteSecurity(route, solanaContext())).toEqual({ valid: true });
  });

  test('rejects Sealevel compute budget priority fee pre-instructions', () => {
    const route = sealevelUniversalRouterRoute();
    route.tx = {
      ...route.tx!,
      preInstructions: [
        {
          programId: 'ComputeBudget111111111111111111111111111111',
          accounts: [],
          data: 'AwDKmjsAAAAA',
        },
      ],
    };

    expect(validateRouteSecurity(route, solanaContext())).toMatchObject({
      valid: false,
      reason: 'Sealevel pre-instruction program is not allowed',
    });
  });

  test('rejects Sealevel ATA setup for mints outside the route', () => {
    const attackerMint = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
    const ata = solanaAta(SOL_OWNER, attackerMint, SOL_TOKEN_PROGRAM);
    const route = sealevelUniversalRouterRoute();
    const tx = route.tx as Extract<RouteTx, { to: string }>;
    route.tx = {
      ...tx,
      accounts: [...(tx.accounts ?? []), { pubkey: ata, isSigner: false, isWritable: true }],
      preInstructions: [
        {
          programId: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
          accounts: [
            { pubkey: SOL_OWNER, isSigner: true, isWritable: true },
            { pubkey: ata, isSigner: false, isWritable: true },
            { pubkey: SOL_OWNER, isSigner: false, isWritable: false },
            { pubkey: attackerMint, isSigner: false, isWritable: false },
            { pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: false },
            { pubkey: SOL_TOKEN_PROGRAM, isSigner: false, isWritable: false },
          ],
          data: 'AQ==',
        },
      ],
    };

    expect(validateRouteSecurity(route, solanaContext())).toMatchObject({
      valid: false,
      reason: 'Sealevel pre-instruction program is not allowed',
    });
  });

  test('rejects Sealevel ATA setup for unauthenticated interior path mints', () => {
    const attackerMint = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
    const ata = solanaAta(SOL_OWNER, attackerMint, SOL_TOKEN_PROGRAM);
    const route = sealevelUniversalRouterRoute();
    route.steps.unshift({
      type: 'swap',
      chain: SOL,
      dex: 'raydium',
      tokenIn: SOL_MINT,
      tokenOut: SOL_MINT,
      amountIn: '100',
      amountOut: '100',
      path: [SOL_MINT, attackerMint, SOL_MINT],
      poolCount: 1,
    });
    const tx = route.tx as Extract<RouteTx, { to: string }>;
    route.tx = {
      ...tx,
      accounts: [...(tx.accounts ?? []), { pubkey: ata, isSigner: false, isWritable: true }],
      preInstructions: [
        {
          programId: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
          accounts: [
            { pubkey: SOL_OWNER, isSigner: true, isWritable: true },
            { pubkey: ata, isSigner: false, isWritable: true },
            { pubkey: SOL_OWNER, isSigner: false, isWritable: false },
            { pubkey: attackerMint, isSigner: false, isWritable: false },
            { pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: false },
            { pubkey: SOL_TOKEN_PROGRAM, isSigner: false, isWritable: false },
          ],
          data: 'AQ==',
        },
      ],
    };

    expect(validateRouteSecurity(route, solanaContext())).toMatchObject({
      valid: false,
      reason: 'Sealevel pre-instruction program is not allowed',
    });
  });
});

function context(routeOverrides: Partial<RouteSecurityTestContext> = {}) {
  return {
    chainMetadata,
    registryWarpRoutes: universalRouterRoutes(),
    chains,
    chainAddresses,
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

function evmSdkWarpContext() {
  return context({
    registryWarpRoutes: evmSdkWarpRoutes(),
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

function wrappedNativeBridgeRoute(): RouteResponse {
  return {
    steps: [
      {
        type: 'swap',
        chain: ETH,
        dex: 'test',
        tokenIn: TOKEN,
        tokenOut: ETH_WETH,
        amountIn: '100',
        amountOut: '90',
        path: [TOKEN, ETH_WETH],
        poolCount: 1,
      },
      {
        type: 'bridge',
        chain: ETH,
        destChain: BASE,
        asset: NATIVE,
        router: BRIDGE_ROUTER,
        amountIn: '90',
        amountOut: '80',
        bridgeSymbol: 'ETH',
        warpRouteId: 'ETH/test',
        fee: { tokenFee: '0', igpToken: NATIVE, igpAmount: '10', localNativeFee: '0' },
      },
      {
        type: 'swap',
        chain: BASE,
        dex: 'test',
        tokenIn: BASE_WETH,
        tokenOut: DST_TOKEN,
        amountIn: '80',
        amountOut: '70',
        path: [BASE_WETH, DST_TOKEN],
        poolCount: 1,
      },
    ],
    output: '70',
    outputMin: '69',
    executionKind: 'universalRouter',
    connection: { symbol: 'ETH', warpRouteId: 'ETH/test' },
    gas: { originGas: '0', destGas: '0' },
    tx: { to: UNIVERSAL_ROUTER, data: '0x', value: '10' },
    approval: {
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

function evmSdkWarpRoute(
  args: {
    approvalAmount?: string;
    approvalSpender?: string;
    approvalToken?: string;
    includeRevoke?: boolean;
    omitTransfer?: boolean;
    trailingRevoke?: boolean;
    revokeAmount?: string;
    transferCount?: number;
    unsupportedCategory?: boolean;
  } = {},
): RouteResponse {
  const warpRouteId = 'TEST/sdk';
  const approvalTx = (category: 'approval' | 'revoke', amount: string) => ({
    protocol: ProtocolType.Ethereum,
    type: 'ethers-v5',
    category,
    transaction: {
      to: args.approvalToken ?? TOKEN,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [(args.approvalSpender ?? BRIDGE_ROUTER) as `0x${string}`, BigInt(amount)],
      }),
    },
    metadata: { warpRouteId },
  });
  const approveAmountTx = approvalTx('approval', args.approvalAmount ?? '100');
  const transferTx = {
    protocol: ProtocolType.Ethereum,
    type: 'ethers-v5',
    category: 'transfer',
    transaction: {
      to: BRIDGE_ROUTER,
      data: '0x',
      value: '0',
    },
    metadata: { warpRouteId },
  };
  const approvalTxs = args.includeRevoke
    ? [approvalTx('revoke', args.revokeAmount ?? '0'), approveAmountTx]
    : [approveAmountTx];
  const txs: NonNullable<RouteResponse['txs']> = args.omitTransfer
    ? approvalTxs
    : [...approvalTxs, transferTx];
  if (args.transferCount === 2) txs.push(transferTx);
  if (args.trailingRevoke) txs.push(approvalTx('revoke', args.revokeAmount ?? '0'));
  if (args.unsupportedCategory)
    txs.splice(0, 1, { ...approvalTx('approval', '100'), category: 'other' });

  return {
    steps: [
      {
        type: 'bridge',
        chain: ETH,
        destChain: BASE,
        asset: TOKEN,
        router: BRIDGE_ROUTER,
        amountIn: '100',
        amountOut: '99',
        bridgeSymbol: 'TEST',
        warpRouteId,
        fee: { tokenFee: '1', igpToken: NATIVE, igpAmount: '0', localNativeFee: '0' },
      },
    ],
    output: '99',
    outputMin: '98',
    executionKind: 'sdkWarp',
    connection: { symbol: 'TEST', warpRouteId },
    gas: { originGas: '0', destGas: '0' },
    tx: txs[0],
    txs,
    approval: null,
  };
}

function starknetSdkWarpRoute(
  args: {
    contractAddress?: string;
    protocol?: string;
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
    asset?: string;
    txTo?: string;
    warpRouteId?: string;
  } = {},
): RouteResponse {
  const warpRouteId = args.warpRouteId ?? 'SOL/test';
  return {
    steps: [
      {
        type: 'bridge',
        chain: SOL,
        destChain: ETH,
        asset: args.asset ?? SOL_MINT,
        router: SOL_ROUTER,
        amountIn: '100',
        amountOut: '100',
        bridgeSymbol: 'SOL',
        warpRouteId,
        fee: { tokenFee: '0', igpToken: NATIVE, igpAmount: '0', localNativeFee: '0' },
      },
    ],
    output: '100',
    outputMin: '100',
    executionKind: 'universalRouter',
    connection: { symbol: 'SOL', warpRouteId },
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

function universalRouterRoutes(): RegistryWarpRouteMap {
  return {
    'test/route': {
      id: 'TEST/route',
      tokens: [
        {
          chainName: 'ethereum',
          addressOrDenom: BRIDGE_ROUTER,
          collateralAddressOrDenom: MID_TOKEN,
          standard: 'EvmHypCollateral',
        },
        { chainName: 'base', addressOrDenom: DST_TOKEN, standard: 'EvmHypSynthetic' },
      ],
    },
  };
}

function nativeUniversalRouterRoutes(): RegistryWarpRouteMap {
  return {
    'eth/test': {
      id: 'ETH/test',
      tokens: [
        { chainName: 'ethereum', addressOrDenom: BRIDGE_ROUTER, standard: 'EvmHypNative' },
        { chainName: 'base', addressOrDenom: DST_ROUTER, standard: 'EvmHypNative' },
      ],
    },
  };
}

function evmSdkWarpRoutes(): RegistryWarpRouteMap {
  return {
    'test/sdk': {
      id: 'TEST/sdk',
      tokens: [
        {
          chainName: 'ethereum',
          addressOrDenom: BRIDGE_ROUTER,
          collateralAddressOrDenom: TOKEN,
          standard: 'EvmHypCollateral',
        },
        { chainName: 'base', addressOrDenom: DST_TOKEN, standard: 'EvmHypSynthetic' },
      ],
    },
  };
}

function solanaNativeRoutes(): RegistryWarpRouteMap {
  return {
    'sol/native': {
      id: 'SOL/native',
      tokens: [
        {
          chainName: 'solanamainnet',
          addressOrDenom: SOL_ROUTER,
          standard: 'SealevelHypNative',
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
  protocol: string;
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

function solanaAta(owner: string, mint: string, tokenProgram: string): string {
  const [address] = PublicKey.findProgramAddressSync(
    [
      new PublicKey(owner).toBuffer(),
      new PublicKey(tokenProgram).toBuffer(),
      new PublicKey(mint).toBuffer(),
    ],
    new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
  );
  return address.toBase58();
}
