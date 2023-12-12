import { DeliverTxResponse, ExecuteResult } from '@cosmjs/cosmwasm-stargate';
import { useChain, useChains } from '@cosmos-kit/react';
import { useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';

import { ProtocolType } from '@hyperlane-xyz/utils';

import { PLACEHOLDER_COSMOS_CHAIN } from '../../../consts/values';
import { logger } from '../../../utils/logger';
import { getCaip2Id } from '../../caip/chains';
import { getCosmosChainNames } from '../../chains/metadata';
import { getChainMetadata, getMultiProvider } from '../../multiProvider';

import { AccountInfo, ActiveChainInfo, ChainAddress, ChainTransactionFns } from './types';

export function useCosmosAccount(): AccountInfo {
  const chainToContext = useChains(getCosmosChainNames());
  return useMemo<AccountInfo>(() => {
    const cosmAddresses: Array<ChainAddress> = [];
    let cosmConnectorName: string | undefined = undefined;
    let isCosmAccountReady = false;
    const multiProvider = getMultiProvider();
    for (const [chainName, context] of Object.entries(chainToContext)) {
      if (!context.address) continue;
      const caip2Id = getCaip2Id(ProtocolType.Cosmos, multiProvider.getChainId(chainName));
      cosmAddresses.push({ address: context.address, chainCaip2Id: caip2Id });
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

  const onSwitchNetwork = useCallback(async (chainCaip2Id: ChainCaip2Id) => {
    const chainName = getChainMetadata(chainCaip2Id).displayName;
    toast.warn(`Cosmos wallet must be connected to origin chain ${chainName}}`);
  }, []);

  const onSendTx = useCallback(
    async ({
      tx,
      chainCaip2Id,
      activeCap2Id,
    }: {
      tx: { type: 'cosmwasm' | 'stargate'; request: any };
      chainCaip2Id: ChainCaip2Id;
      activeCap2Id?: ChainCaip2Id;
    }) => {
      const chainName = getChainMetadata(chainCaip2Id).name;
      const chainContext = chainToContext[chainName];
      if (!chainContext?.address) throw new Error(`Cosmos wallet not connected for ${chainName}`);
      if (activeCap2Id && activeCap2Id !== chainCaip2Id) await onSwitchNetwork(chainCaip2Id);
      logger.debug(`Sending ${tx.type} tx on chain ${chainCaip2Id}`);
      const { getSigningCosmWasmClient, getSigningStargateClient } = chainContext;
      let result: ExecuteResult | DeliverTxResponse;
      if (tx.type === 'cosmwasm') {
        const client = await getSigningCosmWasmClient();
        result = await client.executeMultiple(chainContext.address, [tx.request], 'auto');
      } else if (tx.type === 'stargate') {
        const client = await getSigningStargateClient();
        result = await client.signAndBroadcast(chainContext.address, [tx.request], 'auto');
      } else {
        throw new Error('Invalid cosmos tx type');
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
