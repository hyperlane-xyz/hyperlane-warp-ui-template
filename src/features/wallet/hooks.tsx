import { useChain as useCosmosChain } from '@cosmos-kit/react';
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

import { logger } from '../../utils/logger';
import {
  getCaip2Id,
  getChainReference,
  getEthereumChainId,
  tryGetProtocolType,
} from '../caip/chains';
import { getCosmosChainName } from '../chains/metadata';
import { getChainByRpcEndpoint } from '../chains/utils';
import { getChainMetadata, getMultiProvider } from '../multiProvider';

export interface AccountInfo {
  protocol: ProtocolType;
  address?: Address;
  connectorName?: string;
  isReady: boolean;
}

export function useAccounts(): {
  accounts: Record<ProtocolType, AccountInfo>;
  readyAccounts: Array<AccountInfo>;
} {
  // Evm
  const { address, isConnected, connector } = useEvmAccount();
  const isEvmAccountReady = !!(address && isConnected && connector);
  const evmConnectorName = connector?.name;

  const evmAccountInfo: AccountInfo = useMemo(
    () => ({
      protocol: ProtocolType.Ethereum,
      address: address ? `${address}` : undefined, // massage wagmi addr type
      connectorName: evmConnectorName,
      isReady: isEvmAccountReady,
    }),
    [address, evmConnectorName, isEvmAccountReady],
  );

  // Solana
  const { publicKey, connected, wallet } = useSolanaWallet();
  const isSolAccountReady = !!(publicKey && wallet && connected);
  const solAddress = publicKey?.toBase58();
  const solConnectorName = wallet?.adapter?.name;

  const solAccountInfo: AccountInfo = useMemo(
    () => ({
      protocol: ProtocolType.Sealevel,
      address: solAddress,
      connectorName: solConnectorName,
      isReady: isSolAccountReady,
    }),
    [solAddress, solConnectorName, isSolAccountReady],
  );

  // Cosmos
  const {
    address: cosmAddress,
    wallet: cosmWallet,
    isWalletConnected: isCosmAccountReady,
  } = useCosmosChain(getCosmosChainName());
  const cosmAccountInfo: AccountInfo = useMemo(
    () => ({
      protocol: ProtocolType.Cosmos,
      address: cosmAddress,
      connectorName: cosmWallet?.prettyName,
      isReady: isCosmAccountReady,
    }),
    [cosmAddress, cosmWallet, isCosmAccountReady],
  );

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
        [ProtocolType.Fuel]: { protocol: ProtocolType.Fuel, isReady: false },
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

export function useConnectFns(): Record<ProtocolType, () => void> {
  // Evm
  const { openConnectModal: openEvmModal } = useEvmModal();
  const onConnectEthereum = useCallback(() => openEvmModal?.(), [openEvmModal]);

  // Solana
  const { setVisible: setSolanaModalVisible } = useSolanaModal();
  const onConnectSolana = useCallback(() => setSolanaModalVisible(true), [setSolanaModalVisible]);

  // Cosmos
  const { connect: onConnectCosmos } = useCosmosChain(getCosmosChainName());

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
  const { disconnect: disconnectCosmos, address: addressCosmos } = useCosmosChain(
    getCosmosChainName(),
  );

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
  const { chain: cosmosChainDetails } = useCosmosChain(getCosmosChainName());
  const cosmChain: ActiveChainInfo = useMemo(
    () => ({
      chainDisplayName: cosmosChainDetails?.pretty_name,
      chainCaip2Id: cosmosChainDetails
        ? getCaip2Id(ProtocolType.Cosmos, cosmosChainDetails.chain_id)
        : undefined,
    }),
    [cosmosChainDetails],
  );

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
  const { address: cosmAddress, getSigningCosmWasmClient } = useCosmosChain(getCosmosChainName());

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
      tx: any;
      chainCaip2Id: ChainCaip2Id;
      activeCap2Id?: ChainCaip2Id;
    }) => {
      if (!cosmAddress) throw new Error('Cosmos wallet not connected');
      if (activeCap2Id && activeCap2Id !== chainCaip2Id) await onSwitchCosmNetwork(chainCaip2Id);
      logger.debug(`Sending tx on chain ${chainCaip2Id}`);
      const client = await getSigningCosmWasmClient();
      const result = await client.executeMultiple(cosmAddress, [tx], 'auto');
      const confirm = async () => {
        if (result.transactionHash) return result;
        throw new Error(`Cosmos tx ${result.transactionHash} failed: ${JSON.stringify(result)}`);
      };
      return { hash: result.transactionHash, confirm };
    },
    [onSwitchCosmNetwork, cosmAddress, getSigningCosmWasmClient],
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
