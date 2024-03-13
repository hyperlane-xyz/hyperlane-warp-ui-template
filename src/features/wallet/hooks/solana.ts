import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Connection, Transaction } from '@solana/web3.js';
import { useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';

import { ProtocolType } from '@hyperlane-xyz/utils';

import { getMultiProvider } from '../../../context/context';
import { logger } from '../../../utils/logger';
import { getChainByRpcEndpoint } from '../../chains/utils';

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
      chainName: metadata.name,
    };
  }, [connectionEndpoint]);
}

export function useSolTransactionFns(): ChainTransactionFns {
  const { sendTransaction: sendSolTransaction } = useWallet();

  const onSwitchNetwork = useCallback(async (chainName: ChainName) => {
    toast.warn(`Solana wallet must be connected to origin chain ${chainName}}`);
  }, []);

  const onSendTx = useCallback(
    async ({
      tx,
      chainName,
      activeChainName,
    }: {
      tx: Transaction;
      chainName: ChainName;
      activeChainName?: ChainName;
    }) => {
      if (activeChainName && activeChainName !== chainName) await onSwitchNetwork(chainName);
      const rpcUrl = getMultiProvider().getRpcUrl(chainName);
      const connection = new Connection(rpcUrl, 'confirmed');
      const {
        context: { slot: minContextSlot },
        value: { blockhash, lastValidBlockHeight },
      } = await connection.getLatestBlockhashAndContext();

      logger.debug(`Sending tx on chain ${chainName}`);
      const signature = await sendSolTransaction(tx, connection, { minContextSlot });

      const confirm = () =>
        connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature });
      return { hash: signature, confirm };
    },
    [onSwitchNetwork, sendSolTransaction],
  );

  return { sendTransaction: onSendTx, switchNetwork: onSwitchNetwork };
}
