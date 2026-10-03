import { describe, expect, it } from 'vitest';

import {
  HYPERLIQUID_CORE_DEX,
  HYPERLIQUID_CORE_WRITER,
  HYPERLIQUID_HYPE_SYSTEM_ADDRESS,
  HYPERLIQUID_USDC_SYSTEM_ADDRESS,
  HyperliquidCoreCompletionMode,
  HyperliquidCoreTransferKind,
  getHyperliquidCoreTransferPlan,
} from './coreTransfers';

describe('Hyperliquid Core transfer planning', () => {
  it('exposes stable Core constants', () => {
    expect(HYPERLIQUID_CORE_WRITER).toBe('0x3333333333333333333333333333333333333333');
    expect(HYPERLIQUID_HYPE_SYSTEM_ADDRESS).toBe('0x2222222222222222222222222222222222222222');
    expect(HYPERLIQUID_USDC_SYSTEM_ADDRESS).toBe('0x2000000000000000000000000000000000000000');
    expect(HYPERLIQUID_CORE_DEX.perps).toBe(0);
    expect(HYPERLIQUID_CORE_DEX.spot).toBe(0xffffffff);
  });

  it('plans USDC deposits as recipient-aware CoreDepositWallet deposits', () => {
    const plan = getHyperliquidCoreTransferPlan({
      originChainName: 'base',
      destinationChainName: 'hyperevm',
      tokenSymbol: 'USDC',
    });

    expect(plan).toEqual({
      kind: HyperliquidCoreTransferKind.DepositIntoCore,
      completionMode: HyperliquidCoreCompletionMode.UsdcDepositFor,
      adapterCanCreditUser: true,
      requiresUserSecondLeg: false,
    });
  });

  it('does not claim adapter support for HYPE system transfers', () => {
    const plan = getHyperliquidCoreTransferPlan({
      originChainName: 'ethereum',
      destinationChainName: 'hyperevm',
      tokenSymbol: 'HYPE',
    });

    expect(plan).toEqual({
      kind: HyperliquidCoreTransferKind.DepositIntoCore,
      completionMode: HyperliquidCoreCompletionMode.UserSystemTransfer,
      adapterCanCreditUser: false,
      requiresUserSecondLeg: true,
    });
  });

  it('marks generic linked spot deposits as adapter-intent work', () => {
    const plan = getHyperliquidCoreTransferPlan({
      originChainName: 'solanamainnet',
      destinationChainName: 'hyperevm',
      tokenSymbol: 'SOL',
    });

    expect(plan).toEqual({
      kind: HyperliquidCoreTransferKind.DepositIntoCore,
      completionMode: HyperliquidCoreCompletionMode.RequiresIntentAdapter,
      adapterCanCreditUser: false,
      requiresUserSecondLeg: true,
    });
  });

  it('marks HyperEVM-origin routes as withdrawal second legs', () => {
    const plan = getHyperliquidCoreTransferPlan({
      originChainName: 'hyperevm',
      destinationChainName: 'base',
      tokenSymbol: 'USDC',
    });

    expect(plan).toEqual({
      kind: HyperliquidCoreTransferKind.WithdrawFromCoreSecondLeg,
      completionMode: HyperliquidCoreCompletionMode.None,
      adapterCanCreditUser: false,
      requiresUserSecondLeg: true,
    });
  });
});
