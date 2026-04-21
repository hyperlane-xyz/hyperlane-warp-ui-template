import type { IToken, Token, WarpCore } from '@hyperlane-xyz/sdk';
import {
  PredicateAttestation,
  TokenAmount,
  WarpTxCategory,
  WarpTypedTransaction,
  isPredicateCapableAdapter,
} from '@hyperlane-xyz/sdk';
import { ProtocolType, assert } from '@hyperlane-xyz/utils';

import { fetchAttestation as fetchAttestationFromProxy } from '../../lib/predicateClient';
import { logger } from '../../utils/logger';

interface FetchAttestationParams {
  warpCore: WarpCore;
  token: Token;
  destination: string;
  sender: string;
  recipient: string;
  amount: TokenAmount<IToken>;
  destinationToken?: IToken;
}

export interface PredicateAttestationResult {
  attestation: PredicateAttestation;
  // Pinned at attestation-build time so callers can pass the same value
  // to getTransferRemoteTxs / estimateTransferRemoteFees and avoid IGP drift.
  interchainFee: TokenAmount<IToken>;
  tokenFeeQuote: TokenAmount<IToken> | undefined;
}

/**
 * Fetches Predicate attestation for a token transfer if required.
 * Returns undefined if attestation is not needed or fails.
 *
 * @throws Error if attestation is required but fetch fails
 */
export async function fetchPredicateAttestation({
  warpCore,
  token,
  destination,
  sender,
  recipient,
  amount,
  destinationToken,
}: FetchAttestationParams): Promise<PredicateAttestationResult | undefined> {
  if (token.protocol !== ProtocolType.Ethereum) {
    return undefined;
  }

  const needsAttestation = await warpCore.isPredicateSupported(token, destination);

  if (!needsAttestation) {
    return undefined;
  }

  logger.debug('Route requires Predicate attestation, fetching...');

  const adapter = token.getHypAdapter(warpCore.multiProvider);

  if (!isPredicateCapableAdapter(adapter)) {
    throw new Error(`Token adapter for ${token.chainName} does not support Predicate`);
  }

  const wrapperAddress = await adapter.getPredicateWrapperAddress();
  assert(wrapperAddress, 'Predicate wrapper address not found');

  // Quote IGP once here so the same value is pinned into the calldata AND returned to callers.
  // Both getTransferRemoteTxs (calldata build) and the downstream submit/fee-estimate calls
  // must use the identical msg_value; the Predicate wrapper hashes it into the Statement
  // preimage, so any IGP drift between the two calls causes _authorizeTransaction to revert.
  const { igpQuote, tokenFeeQuote } = await warpCore.getInterchainTransferFee({
    originTokenAmount: amount,
    destination,
    sender,
    recipient,
    destinationToken,
  });

  // Build the transfer tx WITHOUT an attestation to obtain the inner transferRemote calldata.
  // The on-chain PredicateWrapper.transferRemoteWithAttestation() reconstructs that same
  // inner calldata and passes it to Predicate.validateAttestation() — it cannot include the
  // attestation bytes in what it verifies (that would be circular). Empirically, a dummy-
  // attestation approach produces different calldata that the verifier rejects at estimateGas.
  const tempTxs = await warpCore.getTransferRemoteTxs({
    originTokenAmount: amount,
    destination,
    sender,
    recipient,
    interchainFee: igpQuote,
    tokenFeeQuote,
    destinationToken,
  });

  assert(tempTxs.length > 0, 'No transactions returned for transfer');

  // Use last tx: preTransferRemoteTxs (approval/revoke) are prepended before the transfer tx
  const tempTx =
    tempTxs.find((tx) => tx.category === WarpTxCategory.Transfer) ??
    tempTxs[tempTxs.length - 1];
  assert(tempTx && typeof tempTx === 'object', 'Invalid transaction object');

  const transaction = (tempTx as WarpTypedTransaction).transaction;
  assert(transaction, 'Transfer transaction missing');

  const txData = transaction.data?.toString();
  assert(txData, 'Transfer tx missing calldata');

  logger.debug('Fetching attestation for tx:', {
    to: wrapperAddress,
    from: sender,
    chain: token.chainName,
  });

  // Fetch attestation from Predicate API via proxy
  const response = await fetchAttestationFromProxy({
    to: wrapperAddress,
    from: sender,
    data: txData,
    msg_value: transaction.value?.toString() || '0',
    chain: token.chainName,
  });

  logger.debug('Predicate attestation received:', response.attestation.uuid);
  return { attestation: response.attestation, interchainFee: igpQuote, tokenFeeQuote };
}
