import {
  EvmQuotedTransferProvider,
  type IToken,
  type QuotedCallsParams,
  type QuotedTransferProvider,
  type Token,
  type TokenAmount,
} from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

import { TransferFormValues } from './types';
import { useQuotedCallsFeeQuotes } from './useQuotedCalls';
import { useSvmQuotedTransfer } from './useSvmQuotedTransfer';

export interface QuotedTransferResult {
  isLoading: boolean;
  fees: {
    interchainQuote: TokenAmount;
    localQuote: TokenAmount;
    tokenFeeQuote?: TokenAmount;
  } | null;
  /**
   * Submit-time provider getter. EVM and SVM both resolve to a
   * `QuotedTransferProvider`, so `WarpCore.getTransferRemoteTxs({ quotedTransfer })`
   * dispatches with no per-VM branching. Awaits any in-flight discovery/refetch.
   */
  getQuotedTransfer: () => Promise<QuotedTransferProvider | null>;
  /**
   * EVM-only: the QuotedCalls wrapper params, still needed for the ERC20
   * approval spender and the review-panel `Spender:` line (the provider keeps
   * them private). `null` for SVM origins.
   */
  quotedCallsParams: QuotedCallsParams | null;
}

/**
 * Single offchain-quoting entry point for the transfer form. Runs both the EVM
 * (`useQuotedCallsFeeQuotes`) and SVM (`useSvmQuotedTransfer`) hooks — each
 * self-gates on origin protocol, so only the matching one does work — and picks
 * the active result by protocol. The component consumes one hook and one
 * provider getter instead of branching on origin itself; EVM wraps its
 * `QuotedCallsParams` into an `EvmQuotedTransferProvider` so submit is
 * protocol-agnostic.
 */
export function useQuotedTransfer(
  values: TransferFormValues,
  enabled: boolean,
  originToken: Token | undefined,
  destinationToken: IToken | undefined,
): QuotedTransferResult {
  const evm = useQuotedCallsFeeQuotes(values, enabled, originToken, destinationToken);
  const svm = useSvmQuotedTransfer(values, originToken, destinationToken, enabled);

  if (originToken?.protocol === ProtocolType.Sealevel) {
    return {
      isLoading: svm.isLoading,
      fees: svm.fees,
      getQuotedTransfer: svm.getQuotedTransfer,
      quotedCallsParams: null,
    };
  }

  return {
    isLoading: evm.isLoading,
    fees: evm.fees,
    getQuotedTransfer: async () => {
      const params = await evm.getQuotedCallsParams();
      return params ? new EvmQuotedTransferProvider(params) : null;
    },
    quotedCallsParams: evm.quotedCallsParams,
  };
}
