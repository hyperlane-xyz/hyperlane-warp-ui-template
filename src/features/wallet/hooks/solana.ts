import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Connection, Transaction } from '@solana/web3.js';
import { useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';

import { ProtocolType } from '@hyperlane-xyz/utils';

import { logger } from '../../../utils/logger';
import { getCaip2Id, getChainReference } from '../../caip/chains';
import { getChainByRpcEndpoint } from '../../chains/utils';
import { getChainMetadata, getMultiProvider } from '../../multiProvider';

import { AccountInfo, ActiveChainInfo, ChainTransactionFns } from './types';

export function useSolAccount(): AccountInfo {
  const { publicKey, connected, wallet } = useWallet();
  const isReady = !!(publicKey && wallet && connected);
  const address = publicKey?.toBase58();
  const connectorName = wallet?.adapter?.name;

  return useMemo<AccountInfo>(
    () => ({
      protocol: ProtocolType.Sealevel,
      addresses: address ? [{ address: address }] : [],
      connectorName: connectorName,
      isReady: isReady,
    }),
    [address, connectorName, isReady],
  );
}

export function useSolConnectFn(): () => void {
  const { setVisible } = useWalletModal();
  return useCallback(() => setVisible(true), [setVisible]);
}

export function useSolDisconnectFn(): () => Promise<void> {
  const { disconnect } = useWallet();
  return disconnect;
}

export function useSolActiveChain(): ActiveChainInfo {
  const { connection } = useConnection();
  const connectionEndpoint = connection?.rpcEndpoint;
  return useMemo<ActiveChainInfo>(() => {
    const metadata = getChainByRpcEndpoint(connectionEndpoint);
    if (!metadata) return {};
    return {
      chainDisplayName: metadata.displayName,
      chainCaip2Id: getCaip2Id(ProtocolType.Sealevel, metadata.chainId),
    };
  }, [connectionEndpoint]);
}

export function useSolTransactionFns(): ChainTransactionFns {
  const { sendTransaction: sendSolTransaction } = useWallet();

  const onSwitchNetwork = useCallback(async (chainCaip2Id: ChainCaip2Id) => {
    const chainName = getChainMetadata(chainCaip2Id).displayName;
    toast.warn(`Solana wallet must be connected to origin chain ${chainName}}`);
  }, []);

  const onSendTx = useCallback(
    async ({
      tx,
      chainCaip2Id,
      activeCap2Id,
    }: {
      tx: Transaction;
      chainCaip2Id: ChainCaip2Id;
      activeCap2Id?: ChainCaip2Id;
    }) => {
      if (activeCap2Id && activeCap2Id !== chainCaip2Id) await onSwitchNetwork(chainCaip2Id);
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
    [onSwitchNetwork, sendSolTransaction],
  );

  return { sendTransaction: onSendTx, switchNetwork: onSwitchNetwork };
}
