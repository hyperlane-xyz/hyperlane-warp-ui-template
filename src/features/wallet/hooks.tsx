import { DeliverTxResponse, ExecuteResult } from '@cosmjs/cosmwasm-stargate';
import { useChain as useCosmosChain, useChains as useCosmosChains } from '@cosmos-kit/react';
import { useConnectModal as useEvmModal } from '@rainbow-me/rainbowkit';
import { useConnection, useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { useWalletModal as useSolanaModal } from '@solana/wallet-adapter-react-ui';
import { Connection } from '@solana/web3.js';
import {
  sendTransaction as sendEvmTransaction,
  switchNetwork as switchEvmNetwork,
} from '@wagmi/core';
import { providers } from 'ethers';
import { useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import {
  useAccount as useEvmAccount,
  useDisconnect as useEvmDisconnect,
  useNetwork as useEvmNetwork,
} from 'wagmi';

import { ProtocolType, sleep } from '@hyperlane-xyz/utils';

import { PLACEHOLDER_COSMOS_CHAIN } from '../../consts/values';
import { logger } from '../../utils/logger';
import {
  getCaip2Id,
  getChainReference,
  getEthereumChainId,
  tryGetProtocolType,
} from '../caip/chains';
import { getCosmosChainNames } from '../chains/metadata';
import { getChainByRpcEndpoint } from '../chains/utils';
import { getChainMetadata, getMultiProvider } from '../multiProvider';

interface ChainAddress {
  address: string;
  chainCaip2Id?: ChainCaip2Id;
}

export interface AccountInfo {
  protocol: ProtocolType;
  // This needs to be an array instead of a single address b.c.
  // Cosmos wallets have different addresses per chain
  addresses: Array<ChainAddress>;
  connectorName?: string;
  isReady: boolean;
}

export function useAccounts(): {
  accounts: Record<ProtocolType, AccountInfo>;
  readyAccounts: Array<AccountInfo>;
} {
  // Evm
  const {
    address: evmAddress,
    isConnected: isEvmConnected,
    connector: evmConnector,
  } = useEvmAccount();
  const isEvmAccountReady = !!(evmAddress && isEvmConnected && evmConnector);
  const evmConnectorName = evmConnector?.name;

  const evmAccountInfo: AccountInfo = useMemo(
    () => ({
      protocol: ProtocolType.Ethereum,
      addresses: evmAddress ? [{ address: `${evmAddress}` }] : [],
      connectorName: evmConnectorName,
      isReady: isEvmAccountReady,
    }),
    [evmAddress, evmConnectorName, isEvmAccountReady],
  );

  // Solana
  const { publicKey, connected, wallet } = useSolanaWallet();
  const isSolAccountReady = !!(publicKey && wallet && connected);
  const solAddress = publicKey?.toBase58();
  const solConnectorName = wallet?.adapter?.name;

  const solAccountInfo: AccountInfo = useMemo(
    () => ({
      protocol: ProtocolType.Sealevel,
      addresses: solAddress ? [{ address: solAddress }] : [],
      connectorName: solConnectorName,
      isReady: isSolAccountReady,
    }),
    [solAddress, solConnectorName, isSolAccountReady],
  );

  // Cosmos
  const cosmosChainToContext = useCosmosChains(getCosmosChainNames());
  const cosmAccountInfo: AccountInfo = useMemo(() => {
    const cosmAddresses: Array<ChainAddress> = [];
    let cosmConnectorName: string | undefined = undefined;
    let isCosmAccountReady = false;
    const multiProvider = getMultiProvider();
    for (const [chainName, context] of Object.entries(cosmosChainToContext)) {
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
  }, [cosmosChainToContext]);

  // Filtered ready accounts
  const readyAccounts = useMemo(
    () => [evmAccountInfo, solAccountInfo, cosmAccountInfo].filter((a) => a.isReady),
    [evmAccountInfo, solAccountInfo, cosmAccountInfo],
  );

  return useMemo(
    () => ({
      accounts: {
        [ProtocolType.Ethereum]: evmAccountInfo,
        [ProtocolType.Sealevel]: solAccountInfo,
        [ProtocolType.Cosmos]: cosmAccountInfo,
        [ProtocolType.Fuel]: { protocol: ProtocolType.Fuel, isReady: false, addresses: [] },
      },
      readyAccounts,
    }),
    [evmAccountInfo, solAccountInfo, cosmAccountInfo, readyAccounts],
  );
}

export function useAccountForChain(chainCaip2Id?: ChainCaip2Id): AccountInfo | undefined {
  const { accounts } = useAccounts();
  if (!chainCaip2Id) return undefined;
  const protocol = tryGetProtocolType(chainCaip2Id);
  if (!protocol) return undefined;
  return accounts[protocol];
}

export function useAccountAddressForChain(chainCaip2Id?: ChainCaip2Id): Address | undefined {
  return getAccountAddressForChain(chainCaip2Id, useAccountForChain(chainCaip2Id));
}

export function getAccountAddressForChain(
  chainCaip2Id?: ChainCaip2Id,
  account?: AccountInfo,
): Address | undefined {
  if (!chainCaip2Id || !account?.addresses.length) return undefined;
  // Return the address for the chain if it exists, otherwise return the first address
  // We fallback to first because only cosmos has the notion of per-chain addresses
  return (
    account.addresses.find((a) => a.chainCaip2Id === chainCaip2Id)?.address ||
    account.addresses[0].address
  );
}

export function useConnectFns(): Record<ProtocolType, () => void> {
  // Evm
  const { openConnectModal: openEvmModal } = useEvmModal();
  const onConnectEthereum = useCallback(() => openEvmModal?.(), [openEvmModal]);

  // Solana
  const { setVisible: setSolanaModalVisible } = useSolanaModal();
  const onConnectSolana = useCallback(() => setSolanaModalVisible(true), [setSolanaModalVisible]);

  // Cosmos
  const { openView: onConnectCosmos } = useCosmosChain(PLACEHOLDER_COSMOS_CHAIN);

  return useMemo(
    () => ({
      [ProtocolType.Ethereum]: onConnectEthereum,
      [ProtocolType.Sealevel]: onConnectSolana,
      [ProtocolType.Cosmos]: onConnectCosmos,
      [ProtocolType.Fuel]: () => alert('TODO'),
    }),
    [onConnectEthereum, onConnectSolana, onConnectCosmos],
  );
}

export function useDisconnectFns(): Record<ProtocolType, () => Promise<void>> {
  // Evm
  const { disconnectAsync: disconnectEvm } = useEvmDisconnect();

  // Solana
  const { disconnect: disconnectSol } = useSolanaWallet();

  // Cosmos
  const { disconnect: disconnectCosmos, address: addressCosmos } =
    useCosmosChain(PLACEHOLDER_COSMOS_CHAIN);

  const onClickDisconnect =
    (env: ProtocolType, disconnectFn?: () => Promise<void> | void) => async () => {
      try {
        if (!disconnectFn) throw new Error('Disconnect function is null');
        await disconnectFn();
      } catch (error) {
        logger.error(`Error disconnecting from ${env} wallet`, error);
        toast.error('Could not disconnect wallet');
      }
    };

  return useMemo(
    () => ({
      [ProtocolType.Ethereum]: onClickDisconnect(ProtocolType.Ethereum, disconnectEvm),
      [ProtocolType.Sealevel]: onClickDisconnect(ProtocolType.Sealevel, disconnectSol),
      [ProtocolType.Cosmos]: onClickDisconnect(ProtocolType.Cosmos, async () => {
        if (addressCosmos) await disconnectCosmos();
      }),
      [ProtocolType.Fuel]: onClickDisconnect(ProtocolType.Fuel, () => {
        'TODO';
      }),
    }),
    [disconnectEvm, disconnectSol, disconnectCosmos, addressCosmos],
  );
}

export interface ActiveChainInfo {
  chainDisplayName?: string;
  chainCaip2Id?: ChainCaip2Id;
}

export function useActiveChains(): {
  chains: Record<ProtocolType, ActiveChainInfo>;
  readyChains: Array<ActiveChainInfo>;
} {
  // Evm
  const { chain: evmChainDetails } = useEvmNetwork();
  const evmChain: ActiveChainInfo = useMemo(
    () => ({
      chainDisplayName: evmChainDetails?.name,
      chainCaip2Id: evmChainDetails
        ? getCaip2Id(ProtocolType.Ethereum, evmChainDetails.id)
        : undefined,
    }),
    [evmChainDetails],
  );

  // Solana
  const { connection } = useConnection();
  const connectionEndpoint = connection?.rpcEndpoint;
  const solChain: ActiveChainInfo = useMemo(() => {
    const metadata = getChainByRpcEndpoint(connectionEndpoint);
    if (!metadata) return {};
    return {
      chainDisplayName: metadata.displayName,
      chainCaip2Id: getCaip2Id(ProtocolType.Sealevel, metadata.chainId),
    };
  }, [connectionEndpoint]);

  // Cosmos
  const cosmChain = useMemo(() => ({} as ActiveChainInfo), []);

  const readyChains = useMemo(
    () => [evmChain, solChain, cosmChain].filter((c) => !!c.chainDisplayName),
    [evmChain, solChain, cosmChain],
  );

  return useMemo(
    () => ({
      chains: {
        [ProtocolType.Ethereum]: evmChain,
        [ProtocolType.Sealevel]: solChain,
        [ProtocolType.Cosmos]: cosmChain,
        [ProtocolType.Fuel]: {},
      },
      readyChains,
    }),
    [evmChain, solChain, cosmChain, readyChains],
  );
}

export type SendTransactionFn<TxResp = any> = (params: {
  tx: any;
  chainCaip2Id: ChainCaip2Id;
  activeCap2Id?: ChainCaip2Id;
}) => Promise<{ hash: string; confirm: () => Promise<TxResp> }>;

export type SwitchNetworkFn = (chainCaip2Id: ChainCaip2Id) => Promise<void>;

export function useTransactionFns(): Record<
  ProtocolType,
  {
    sendTransaction: SendTransactionFn;
    switchNetwork?: SwitchNetworkFn;
  }
> {
  // Evm
  const onSwitchEvmNetwork = useCallback(async (chainCaip2Id: ChainCaip2Id) => {
    const chainId = getEthereumChainId(chainCaip2Id);
    await switchEvmNetwork({ chainId });
    // Some wallets seem to require a brief pause after switch
    await sleep(1500);
  }, []);
  // Note, this doesn't use wagmi's prepare + send pattern because we're potentially sending two transactions
  // The prepare hooks are recommended to use pre-click downtime to run async calls, but since the flow
  // may require two serial txs, the prepare hooks aren't useful and complicate hook architecture considerably.
  // See https://github.com/hyperlane-xyz/hyperlane-warp-ui-template/issues/19
  // See https://github.com/wagmi-dev/wagmi/discussions/1564
  const onSendEvmTx = useCallback(
    async ({
      tx,
      chainCaip2Id,
      activeCap2Id,
    }: {
      tx: any;
      chainCaip2Id: ChainCaip2Id;
      activeCap2Id?: ChainCaip2Id;
    }) => {
      if (activeCap2Id && activeCap2Id !== chainCaip2Id) await onSwitchEvmNetwork(chainCaip2Id);
      const chainId = getEthereumChainId(chainCaip2Id);
      logger.debug(`Sending tx on chain ${chainCaip2Id}`);
      const { hash, wait } = await sendEvmTransaction({
        chainId,
        request: tx as providers.TransactionRequest,
        mode: 'recklesslyUnprepared',
      });
      return { hash, confirm: () => wait(1) };
    },
    [onSwitchEvmNetwork],
  );

  // Solana
  const { sendTransaction: sendSolTransaction } = useSolanaWallet();

  const onSwitchSolNetwork = useCallback(async (chainCaip2Id: ChainCaip2Id) => {
    const chainName = getChainMetadata(chainCaip2Id).displayName;
    toast.warn(`Solana wallet must be connected to origin chain ${chainName}}`);
  }, []);

  const onSendSolTx = useCallback(
    async ({
      tx,
      chainCaip2Id,
      activeCap2Id,
    }: {
      tx: any;
      chainCaip2Id: ChainCaip2Id;
      activeCap2Id?: ChainCaip2Id;
    }) => {
      if (activeCap2Id && activeCap2Id !== chainCaip2Id) await onSwitchSolNetwork(chainCaip2Id);
      const rpcUrl = getMultiProvider().getRpcUrl(getChainReference(chainCaip2Id));
      const connection = new Connection(rpcUrl, 'confirmed');
      const {
        context: { slot: minContextSlot },
        value: { blockhash, lastValidBlockHeight },
      } = await connection.getLatestBlockhashAndContext();

      logger.debug(`Sending tx on chain ${chainCaip2Id}`);
      const signature = await sendSolTransaction(tx, connection, { minContextSlot });

      const confirm = () =>
        connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature });
      return { hash: signature, confirm };
    },
    [onSwitchSolNetwork, sendSolTransaction],
  );

  // Cosmos
  const cosmosChainToContext = useCosmosChains(getCosmosChainNames());

  const onSwitchCosmNetwork = useCallback(async (chainCaip2Id: ChainCaip2Id) => {
    const chainName = getChainMetadata(chainCaip2Id).displayName;
    toast.warn(`Cosmos wallet must be connected to origin chain ${chainName}}`);
  }, []);

  const onSendCosmTx = useCallback(
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
      const chainContext = cosmosChainToContext[chainName];
      if (!chainContext?.address) throw new Error(`Cosmos wallet not connected for ${chainName}`);
      if (activeCap2Id && activeCap2Id !== chainCaip2Id) await onSwitchCosmNetwork(chainCaip2Id);
      logger.debug(`Sending ${tx.type} tx on chain ${chainCaip2Id}`);
      const { getSigningCosmWasmClient, getSigningStargateClient } = chainContext;
      let result: ExecuteResult | DeliverTxResponse;
      let confirm: () => Promise<any>;
      if (tx.type === 'cosmwasm') {
        const client = await getSigningCosmWasmClient();
        result = await client.executeMultiple(chainContext.address, [tx.request], 'auto');
        confirm = async () => {
          if (result.transactionHash) return result;
          throw new Error(`Cosmos tx ${result.transactionHash} failed: ${JSON.stringify(result)}`);
        };
      } else if (tx.type === 'stargate') {
        const client = await getSigningStargateClient();
        result = await client.signAndBroadcast(chainContext.address, [tx.request], 'auto');
      } else {
        throw new Error('Invalid cosmos tx type');
      }

      confirm = async () => {
        if (result.transactionHash) return result;
        throw new Error(`Cosmos tx ${result.transactionHash} failed: ${JSON.stringify(result)}`);
      };
      return { hash: result.transactionHash, confirm };
    },
    [onSwitchCosmNetwork, cosmosChainToContext],
  );

  return useMemo(
    () => ({
      [ProtocolType.Ethereum]: { sendTransaction: onSendEvmTx, switchNetwork: onSwitchEvmNetwork },
      [ProtocolType.Sealevel]: { sendTransaction: onSendSolTx, switchNetwork: onSwitchSolNetwork },
      [ProtocolType.Cosmos]: { sendTransaction: onSendCosmTx, switchNetwork: onSwitchCosmNetwork },
      [ProtocolType.Fuel]: {
        sendTransaction: () => alert('TODO') as any,
        switchNetwork: () => alert('TODO') as any,
      },
    }),
    [
      onSendEvmTx,
      onSendSolTx,
      onSwitchEvmNetwork,
      onSwitchSolNetwork,
      onSendCosmTx,
      onSwitchCosmNetwork,
    ],
  );
}
