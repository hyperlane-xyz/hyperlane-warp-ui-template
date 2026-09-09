export const HYPERLIQUID_EVM_CHAIN = 'hyperevm';

export const HYPERLIQUID_CORE_WRITER = '0x3333333333333333333333333333333333333333';
export const HYPERLIQUID_HYPE_SYSTEM_ADDRESS = '0x2222222222222222222222222222222222222222';
export const HYPERLIQUID_USDC_SYSTEM_ADDRESS = '0x2000000000000000000000000000000000000000';

export const HYPERLIQUID_CORE_DEX = {
  perps: 0,
  spot: 0xffffffff,
} as const;

export enum HyperliquidCoreTransferKind {
  NotHyperliquid = 'not-hyperliquid',
  DepositIntoCore = 'deposit-into-core',
  WithdrawFromCoreSecondLeg = 'withdraw-from-core-second-leg',
}

export enum HyperliquidCoreCompletionMode {
  None = 'none',
  UsdcDepositFor = 'usdc-deposit-for',
  UserSystemTransfer = 'user-system-transfer',
  RequiresIntentAdapter = 'requires-intent-adapter',
}

export interface HyperliquidCoreTransferPlanInput {
  originChainName: string;
  destinationChainName: string;
  tokenSymbol: string;
}

export interface HyperliquidCoreTransferPlan {
  kind: HyperliquidCoreTransferKind;
  completionMode: HyperliquidCoreCompletionMode;
  adapterCanCreditUser: boolean;
  requiresUserSecondLeg: boolean;
}

const USDC_SYMBOLS = new Set(['USDC', 'USDC.E']);
const HYPE_SYMBOLS = new Set(['HYPE', 'WHYPE']);

export function getHyperliquidCoreTransferPlan({
  originChainName,
  destinationChainName,
  tokenSymbol,
}: HyperliquidCoreTransferPlanInput): HyperliquidCoreTransferPlan {
  const normalizedSymbol = tokenSymbol.toUpperCase();

  if (destinationChainName === HYPERLIQUID_EVM_CHAIN) {
    if (USDC_SYMBOLS.has(normalizedSymbol)) {
      return {
        kind: HyperliquidCoreTransferKind.DepositIntoCore,
        completionMode: HyperliquidCoreCompletionMode.UsdcDepositFor,
        adapterCanCreditUser: true,
        requiresUserSecondLeg: false,
      };
    }

    if (HYPE_SYMBOLS.has(normalizedSymbol)) {
      return {
        kind: HyperliquidCoreTransferKind.DepositIntoCore,
        completionMode: HyperliquidCoreCompletionMode.UserSystemTransfer,
        adapterCanCreditUser: false,
        requiresUserSecondLeg: true,
      };
    }

    return {
      kind: HyperliquidCoreTransferKind.DepositIntoCore,
      completionMode: HyperliquidCoreCompletionMode.RequiresIntentAdapter,
      adapterCanCreditUser: false,
      requiresUserSecondLeg: true,
    };
  }

  if (originChainName === HYPERLIQUID_EVM_CHAIN) {
    return {
      kind: HyperliquidCoreTransferKind.WithdrawFromCoreSecondLeg,
      completionMode: HyperliquidCoreCompletionMode.None,
      adapterCanCreditUser: false,
      requiresUserSecondLeg: true,
    };
  }

  return {
    kind: HyperliquidCoreTransferKind.NotHyperliquid,
    completionMode: HyperliquidCoreCompletionMode.None,
    adapterCanCreditUser: false,
    requiresUserSecondLeg: false,
  };
}
