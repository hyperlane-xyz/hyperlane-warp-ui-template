import { DeliverTxResponse, ExecuteResult } from '@cosmjs/cosmwasm-stargate';
import { useChain, useChains } from '@cosmos-kit/react';
import { useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';

import { ProviderType } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

import { PLACEHOLDER_COSMOS_CHAIN } from '../../../consts/values';
import { logger } from '../../../utils/logger';
import { getCosmosChainNames } from '../../chains/metadata';
import { getChainMetadata } from '../../chains/utils';

import { AccountInfo, ActiveChainInfo, ChainAddress, ChainTransactionFns } from './types';

export function useCosmosAccount(): AccountInfo {
  const chainToContext = useChains(getCosmosChainNames());
  return useMemo<AccountInfo>(() => {
    const cosmAddresses: Array<ChainAddress> = [];
    let cosmConnectorName: string | undefined = undefined;
    let isCosmAccountReady = false;
    for (const [chainName, context] of Object.entries(chainToContext)) {
      if (!context.address) continue;
      cosmAddresses.push({ address: context.address, chainName });
      isCosmAccountReady = true;
      cosmConnectorName ||= context.wallet?.prettyName;
    }
    return {
      protocol: ProtocolType.Cosmos,
      addresses: cosmAddresses,
      connectorName: cosmConnectorName,
      isReady: isCosmAccountReady,
    };
  }, [chainToContext]);
}

export function useCosmosConnectFn(): () => void {
  const { openView } = useChain(PLACEHOLDER_COSMOS_CHAIN);
  return openView;
}

export function useCosmosDisconnectFn(): () => Promise<void> {
  const { disconnect, address } = useChain(PLACEHOLDER_COSMOS_CHAIN);
  const safeDisconnect = async () => {
    if (address) await disconnect();
  };
  return safeDisconnect;
}

export function useCosmosActiveChain(): ActiveChainInfo {
  return useMemo(() => ({} as ActiveChainInfo), []);
}

export function useCosmosTransactionFns(): ChainTransactionFns {
  const chainToContext = useChains(getCosmosChainNames());

  const onSwitchNetwork = useCallback(async (chainName: ChainName) => {
    const displayName = getChainMetadata(chainName).displayName || chainName;
    toast.warn(`Cosmos wallet must be connected to origin chain ${displayName}}`);
  }, []);

  const onSendTx = useCallback(
    async ({
      tx,
      chainName,
      activeChainName,
      providerType,
    }: {
      tx: any;
      chainName: ChainName;
      activeChainName?: ChainName;
      providerType?: ProviderType;
    }) => {
      const chainContext = chainToContext[chainName];
      if (!chainContext?.address) throw new Error(`Cosmos wallet not connected for ${chainName}`);
      if (activeChainName && activeChainName !== chainName) await onSwitchNetwork(chainName);
      logger.debug(`Sending ${tx.type} tx on chain ${chainName}`);
      const { getSigningCosmWasmClient, getSigningStargateClient } = chainContext;
      let result: ExecuteResult | DeliverTxResponse;
      if (providerType === ProviderType.CosmJsWasm) {
        const client = await getSigningCosmWasmClient();
        result = await client.executeMultiple(chainContext.address, [tx], 'auto');
      } else if (providerType === ProviderType.CosmJs) {
        const client = await getSigningStargateClient();
        result = await client.signAndBroadcast(chainContext.address, [tx], 'auto');
      } else {
        throw new Error(`Invalid cosmos provider type ${providerType}`);
      }

      const confirm = async () => {
        if (result.transactionHash) return result;
        throw new Error(`Cosmos tx ${result.transactionHash} failed: ${JSON.stringify(result)}`);
      };
      return { hash: result.transactionHash, confirm };
    },
    [onSwitchNetwork, chainToContext],
  );

  return { sendTransaction: onSendTx, switchNetwork: onSwitchNetwork };
}
