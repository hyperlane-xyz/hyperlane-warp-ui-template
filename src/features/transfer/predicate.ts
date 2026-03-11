import type { Token, WarpCore } from '@hyperlane-xyz/sdk';
import { TokenAmount } from '@hyperlane-xyz/sdk';
import { assert } from '@hyperlane-xyz/utils';
import { getPredicateClient } from '../../lib/predicateClient';
import { logger } from '../../utils/logger';

// TODO: Import from SDK when available
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PredicateAttestation = any;

interface FetchAttestationParams {
  warpCore: WarpCore;
  token: Token;
  destination: string;
  sender: string;
  recipient: string;
  amount: TokenAmount;
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
}: FetchAttestationParams): Promise<PredicateAttestation | undefined> {
  const predicateClient = getPredicateClient();

  // TODO: Use proper types when SDK updated
  const needsAttestation = await (warpCore as any).isPredicateSupported(token, destination);

  if (!needsAttestation) {
    return undefined;
  }

  logger.debug('Route requires Predicate attestation, fetching...');

  // Get adapter with type safety
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = token.getAdapter(warpCore.multiProvider as any) as any;

  // Type guard: ensure adapter has predicate methods (will exist when SDK updated)
  if (typeof adapter.getPredicateWrapperAddress !== 'function') {
    throw new Error(
      `Token adapter for ${token.chainName} does not support Predicate (missing getPredicateWrapperAddress)`,
    );
  }

  const wrapperAddress = await adapter.getPredicateWrapperAddress();
  assert(wrapperAddress, 'Predicate wrapper address not found');

  // Build temporary transaction to get calldata
  const tempTxs = await warpCore.getTransferRemoteTxs({
    originTokenAmount: amount,
    destination,
    sender,
    recipient,
  });

  assert(tempTxs.length > 0, 'No transactions returned for transfer');

  // Type guard: ensure transaction has required structure
  const tempTx = tempTxs[0];
  assert(tempTx && typeof tempTx === 'object', 'Invalid transaction object');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transaction = (tempTx as any).transaction;
  assert(transaction, 'Transfer transaction missing');

  const txData = transaction.data?.toString();
  assert(txData, 'Transfer tx missing calldata');

  logger.debug('Fetching attestation for tx:', {
    to: wrapperAddress,
    from: sender,
    chain: token.chainName,
  });

  // Fetch attestation from Predicate API via proxy
  const response = await predicateClient.fetchAttestation({
    to: wrapperAddress,
    from: sender,
    data: txData,
    msg_value: transaction.value?.toString() || '0',
    chain: token.chainName,
  });

  logger.debug('Predicate attestation received:', response.attestation.uuid);
  return response.attestation;
}
