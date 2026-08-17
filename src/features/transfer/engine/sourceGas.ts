import { type MultiProtocolProvider, type TypedTransaction } from '@hyperlane-xyz/sdk';
import { type HexString, ProtocolType } from '@hyperlane-xyz/utils';

import { logger } from '../../../utils/logger';
import { getRouteTxs } from '../../api/routeTx';
import type { RouteResponse } from '../../api/types';
import { PENDING_APPROVAL_GAS_BUDGET } from '../../balances/evm';
import { estimateNativeGasCostForUnits } from '../../balances/read';
import type { FeeBreakdown } from './types';
import { getRouteTxProviderType, toWalletTx } from './useTransfer';

const NATIVE_ADDRESS = '0x0000000000000000000000000000000000000000';

export function withSourceGasFee(
  feeBreakdown: FeeBreakdown | undefined,
  chainId: number | undefined,
  amount: bigint | undefined,
): FeeBreakdown | undefined {
  if (!feeBreakdown || chainId == null) return feeBreakdown;
  const components = feeBreakdown.components.filter(
    (component) => component.category !== 'localGas',
  );
  if (amount && amount > 0n) {
    components.push({ category: 'localGas', chainId, tokenAddress: NATIVE_ADDRESS, amount });
  }
  return { ...feeBreakdown, components };
}

export async function estimateRouteSourceGasCost({
  multiProvider,
  chainName,
  sender,
  senderPubKey,
  route,
  approvalPending,
}: {
  multiProvider: MultiProtocolProvider;
  chainName: string;
  sender: string;
  senderPubKey?: Promise<HexString | undefined> | HexString;
  route: RouteResponse;
  approvalPending?: boolean;
}): Promise<bigint> {
  const protocol = multiProvider.tryGetProtocol(chainName);
  if (!protocol) throw new Error(`Unknown source protocol for ${chainName}`);
  const useEvmBudget = protocol === ProtocolType.Ethereum && approvalPending;

  if (!useEvmBudget) {
    try {
      const txType = getRouteTxProviderType(protocol as ProtocolType);
      const rpcUrl = multiProvider.tryGetChainMetadata(chainName)?.rpcUrls?.[0]?.http;
      const publicKey = await senderPubKey;
      const estimates = await Promise.all(
        getRouteTxs(route).map(async (routeTx) => {
          const transaction = (await toWalletTx(routeTx, txType, {
            sender,
            rpcUrl,
          })) as TypedTransaction;
          return multiProvider.estimateTransactionFee({
            chainNameOrId: chainName,
            transaction,
            sender,
            senderPubKey: publicKey,
          });
        }),
      );
      return estimates.reduce((total, estimate) => total + BigInt(estimate.fee), 0n);
    } catch (err) {
      logger.warn('Failed to estimate source transaction fee', err as Error);
      if (protocol !== ProtocolType.Ethereum) {
        throw new Error('Unable to estimate source transaction fee', { cause: err });
      }
    }
  }

  return estimateNativeGasCostForUnits(multiProvider, {
    chainName,
    gasUnits: approvalPending ? PENDING_APPROVAL_GAS_BUDGET : BigInt(route.gas.originGas),
  });
}
