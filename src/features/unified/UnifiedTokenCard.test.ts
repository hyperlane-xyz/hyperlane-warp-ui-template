import { ProtocolType } from '@hyperlane-xyz/utils';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { createMockToken, createTokenConnectionMock } from '../../utils/test';
import { TransactionHistoryItemType, useStore } from '../store';
import { SwapStatus } from '../swap/types';
import { validateSwapForm } from '../swap/validate';
import { getTokenKey, groupTokensByCollateral } from '../tokens/utils';
import { getTransferToken } from '../transfer/fees';
import { UnifiedRouteMode } from './tokens/routes';
import {
  getInitialUnifiedTokenQuery,
  getKnownTotalFees,
  getUnifiedSwapIntentKey,
  hydrateInitialUnifiedTokenKeys,
  submitSwap,
  validateUnifiedBridgeTransfer,
} from './UnifiedTokenCard';

vi.mock('../swap/validate', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../swap/validate')>()),
  validateSwapForm: vi.fn(),
}));

vi.mock('../transfer/fees', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../transfer/fees')>()),
  getTransferToken: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

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

describe('getUnifiedSwapIntentKey', () => {
  const values = {
    srcChain: 1,
    dstChain: 2,
    srcToken: '0x1111111111111111111111111111111111111111',
    dstToken: '0x2222222222222222222222222222222222222222',
    amount: '1',
    recipient: '',
    slippageBps: 100,
  };

  test('changes when the quoted swap intent changes', () => {
    const initial = getUnifiedSwapIntentKey(UnifiedRouteMode.Swap, values, '0xrecipient');
    const changedAmount = getUnifiedSwapIntentKey(
      UnifiedRouteMode.Swap,
      { ...values, amount: '2' },
      '0xrecipient',
    );
    const changedRecipient = getUnifiedSwapIntentKey(UnifiedRouteMode.Swap, values, '0xother');

    expect(changedAmount).not.toBe(initial);
    expect(changedRecipient).not.toBe(initial);
  });

  test('uses an empty key outside swap mode', () => {
    expect(getUnifiedSwapIntentKey(UnifiedRouteMode.Bridge, values, '0xrecipient')).toBe('');
    expect(getUnifiedSwapIntentKey(null, values, '0xrecipient')).toBe('');
  });
});

describe('getKnownTotalFees', () => {
  test('keeps known interchain fees when local gas is unknown', () => {
    const token = createMockToken();

    const fees = getKnownTotalFees({
      interchainQuote: token.amount(100n),
      tokenFeeQuote: token.amount(50n),
    });

    expect(fees).toHaveLength(1);
    expect(fees[0].amount).toBe(150n);
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
      bridgeRoutePair: { originToken, destinationToken },
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
      bridgeRoutePair: { originToken, destinationToken: connectedDestinationToken },
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

describe('submitSwap', () => {
  afterEach(() => {
    useStore.getState().resetTransactionHistory();
    useStore.getState().setSelectedTransactionId(null);
    useStore.getState().setActiveSwapTransactionId(null);
    useStore.getState().setSwapLoading(false);
  });

  test('creates local history and executes the selected route', async () => {
    vi.mocked(validateSwapForm).mockResolvedValue(null);

    const srcAddress = '0x1111111111111111111111111111111111111111';
    const dstAddress = '0x2222222222222222222222222222222222222222';
    const sender = '0x3333333333333333333333333333333333333333';
    const recipient = '0x4444444444444444444444444444444444444444';
    const universalRouter = '0x5555555555555555555555555555555555555555';
    const route = {
      isBridgeOnly: false,
      feeBreakdown: { components: [], originGas: 0n, destGas: 0n },
      raw: {
        steps: [
          {
            type: 'swap',
            chain: 1,
            dex: 'test-dex',
            tokenIn: srcAddress,
            tokenOut: dstAddress,
            amountIn: '100',
            amountOut: '95',
            path: [srcAddress, dstAddress],
            poolCount: 1,
            minPoolTvlUsd: null,
          },
        ],
        output: '95',
        outputMin: '90',
        connection: null,
        gas: { originGas: '0', destGas: '0' },
        tx: { to: universalRouter, data: '0x1234', value: '0' },
      },
    } as any;
    const execute = vi.fn().mockResolvedValue('0xhash');
    const setErrors = vi.fn();

    await submitSwap({
      values: {
        srcChain: 1,
        dstChain: 2,
        srcToken: srcAddress,
        dstToken: dstAddress,
        amount: '1',
        recipient,
        slippageBps: 50,
      },
      bestRoute: route,
      originToken: {
        key: 'src',
        chainName: 'ethereum',
        chainId: 1,
        addressOrDenom: srcAddress,
        symbol: 'SRC',
        name: 'Source',
        decimals: 18,
        isNative: false,
        swapToken: {
          chainId: 1,
          chainName: 'ethereum',
          address: srcAddress,
          addressOrDenom: srcAddress,
          symbol: 'SRC',
          name: 'Source',
          decimals: 18,
          isNative: false,
          canBridge: false,
          canSwap: true,
          isBridgeToken: false,
          isPoolToken: false,
          bridgeSymbols: [],
          warpRouteIds: [],
        },
        capabilities: { bridge: false, swap: true },
      },
      destinationToken: {
        key: 'dst',
        chainName: 'base',
        chainId: 2,
        addressOrDenom: dstAddress,
        symbol: 'DST',
        name: 'Destination',
        decimals: 18,
        isNative: false,
        swapToken: {
          chainId: 2,
          chainName: 'base',
          address: dstAddress,
          addressOrDenom: dstAddress,
          symbol: 'DST',
          name: 'Destination',
          decimals: 18,
          isNative: false,
          canBridge: false,
          canSwap: true,
          isBridgeToken: false,
          isPoolToken: false,
          bridgeSymbols: [],
          warpRouteIds: [],
        },
        capabilities: { bridge: false, swap: true },
      },
      sender,
      recipient,
      chains: [
        {
          id: 1,
          name: 'Ethereum',
          chainName: 'ethereum',
          protocol: ProtocolType.Ethereum,
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          universalRouter,
          dex: 'test-dex',
          canSwap: true,
          canExecute: true,
          supportsNative: true,
        },
        {
          id: 2,
          name: 'Base',
          chainName: 'base',
          protocol: ProtocolType.Ethereum,
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          universalRouter,
          dex: 'test-dex',
          canSwap: true,
          canExecute: true,
          supportsNative: true,
        },
      ],
      multiProvider: {} as any,
      approvalPending: false,
      quoteExpiresAt: Math.floor(Date.now() / 1000) + 60,
      universalRouter,
      amountAtomic: 100n,
      swap: { execute } as any,
      setErrors,
    });

    const state = useStore.getState();
    const historyItem = state.transactionHistory[0];
    expect(historyItem.type).toBe(TransactionHistoryItemType.Swap);
    expect(historyItem.data).toMatchObject({
      status: SwapStatus.Preparing,
      srcChain: 1,
      dstChain: 2,
      srcToken: srcAddress,
      dstToken: dstAddress,
      amountIn: '100',
      amountOut: '95',
      sender,
      recipient,
    });
    expect(state.selectedTransactionId).toBe(historyItem.id);
    expect(state.activeSwapTransactionId).toBeNull();
    expect(state.swapLoading).toBe(false);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: historyItem.id,
        route,
        srcChainId: 1,
        dstChainId: 2,
        srcToken: srcAddress,
        dstToken: dstAddress,
        sender,
        recipient,
        spender: universalRouter,
        approvalAmount: 100n,
        isNative: false,
      }),
    );
    expect(setErrors).not.toHaveBeenCalled();
  });

  test('stores destination outcome for CCS destination-swap routes', async () => {
    vi.mocked(validateSwapForm).mockResolvedValue(null);

    const srcAddress = '0x1111111111111111111111111111111111111111';
    const bridgeToken = '0x2222222222222222222222222222222222222222';
    const dstAddress = '0x3333333333333333333333333333333333333333';
    const sender = '0x4444444444444444444444444444444444444444';
    const recipient = '0x5555555555555555555555555555555555555555';
    const universalRouter = '0x6666666666666666666666666666666666666666';
    const commitment = `0x${'a'.repeat(64)}`;
    const salt = `0x${'b'.repeat(64)}`;
    const relayer = `0x${'c'.repeat(64)}`;
    const destinationAccount = `0x${'d'.repeat(64)}`;
    const solanaDestSwapPda = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
    const route = {
      isBridgeOnly: false,
      feeBreakdown: { components: [], originGas: 0n, destGas: 0n },
      raw: {
        steps: [
          {
            type: 'bridge',
            chain: 1,
            destChain: 2,
            asset: srcAddress,
            router: '0x7777777777777777777777777777777777777777',
            amountIn: '100',
            amountOut: '98',
            fee: {
              tokenFee: '0',
              igpToken: '0x0000000000000000000000000000000000000000',
              igpAmount: '0',
            },
          },
          {
            type: 'swap',
            chain: 2,
            dex: 'test-dex',
            tokenIn: bridgeToken,
            tokenOut: dstAddress,
            amountIn: '98',
            amountOut: '95',
            path: [bridgeToken, dstAddress],
            poolCount: 1,
            minPoolTvlUsd: null,
          },
        ],
        output: '95',
        outputMin: '90',
        connection: { symbol: 'USDC', warpRouteId: 'USDC/test' },
        gas: { originGas: '0', destGas: '0' },
        tx: { to: universalRouter, data: '0x1234', value: '0' },
        callCommitment: {
          version: 1,
          commitment,
          hash: { algorithm: 'keccak256', preimage: '0x', encodedCalls: '0x' },
          ccs: {
            method: 'POST',
            path: '/calldata',
            body: {
              commitment,
              originDomain: 1,
              data: '0x1234',
              salt,
              relayers: [relayer],
              destinationAccount,
              revealAccounts: [
                {
                  pubkey: solanaDestSwapPda,
                  isWritable: true,
                  isSigner: false,
                },
              ],
            },
          },
        },
      },
    } as any;
    const execute = vi.fn().mockResolvedValue('0xhash');

    await submitSwap({
      values: {
        srcChain: 1,
        dstChain: 2,
        srcToken: srcAddress,
        dstToken: dstAddress,
        amount: '1',
        recipient,
        slippageBps: 50,
      },
      bestRoute: route,
      originToken: {
        chainName: 'ethereum',
        swapToken: {
          chainId: 1,
          chainName: 'ethereum',
          address: srcAddress,
          addressOrDenom: srcAddress,
          symbol: 'SRC',
          name: 'Source',
          decimals: 18,
          isNative: false,
          canBridge: false,
          canSwap: true,
          isBridgeToken: false,
          isPoolToken: false,
          bridgeSymbols: [],
          warpRouteIds: [],
        },
      } as any,
      destinationToken: {
        chainName: 'base',
        swapToken: {
          chainId: 2,
          chainName: 'base',
          address: dstAddress,
          addressOrDenom: dstAddress,
          symbol: 'DST',
          name: 'Destination',
          decimals: 18,
          isNative: false,
          canBridge: false,
          canSwap: true,
          isBridgeToken: false,
          isPoolToken: false,
          bridgeSymbols: [],
          warpRouteIds: [],
        },
      } as any,
      sender,
      recipient,
      chains: [
        {
          id: 1,
          name: 'Ethereum',
          chainName: 'ethereum',
          protocol: ProtocolType.Ethereum,
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          universalRouter,
          dex: 'test-dex',
          canSwap: true,
          canExecute: true,
          supportsNative: true,
        },
        {
          id: 2,
          name: 'Base',
          chainName: 'base',
          protocol: ProtocolType.Ethereum,
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          universalRouter,
          dex: 'test-dex',
          canSwap: true,
          canExecute: true,
          supportsNative: true,
        },
      ],
      multiProvider: {} as any,
      approvalPending: false,
      quoteExpiresAt: Math.floor(Date.now() / 1000) + 60,
      universalRouter,
      amountAtomic: 100n,
      swap: { execute } as any,
      setErrors: vi.fn(),
    });

    const historyItem = useStore.getState().transactionHistory[0];
    expect(historyItem.type).toBe(TransactionHistoryItemType.Swap);
    expect(historyItem.data).toMatchObject({
      destinationOutcome: {
        bridgeToken,
        dstToken: dstAddress,
        minAmountOut: '90',
      },
      amountIn: '100',
      amountOut: '95',
      solanaDestSwapPda,
    });
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: historyItem.id,
        route,
        srcChainId: 1,
        dstChainId: 2,
        srcToken: srcAddress,
        dstToken: dstAddress,
        sender,
        recipient,
        spender: universalRouter,
        approvalAmount: 100n,
        isNative: false,
      }),
    );
  });
});
