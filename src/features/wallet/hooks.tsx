import { useConnection, useWallet as useWalletSolana } from '@solana/wallet-adapter-react';
import { useEffect } from 'react';
import { toast } from 'react-toastify';
import {
  useAccount as useAccountWagmi,
  useDisconnect as useDisconnectWagmi,
  useNetwork as useNetworkWagmi,
} from 'wagmi';

import { logger } from '../../utils/logger';

import { ChainEnvironment } from './types';

interface AccountInfo {
  env: ChainEnvironment;
  address?: Address;
  connectorName?: string;
  isReady: boolean;
}

export function useAccounts(): {
  accounts: Record<ChainEnvironment, AccountInfo>;
  readyAccounts: Array<AccountInfo>;
} {
  // Evm
  const { address, isConnected, connector } = useAccountWagmi();
  const isEvmAccountReady = !!(address && isConnected && connector);

  const evmAccountInfo = {
    env: ChainEnvironment.Evm,
    address: address ? `${address}` : undefined, // massage wagmi addr type
    connectorName: connector?.name,
    isReady: isEvmAccountReady,
  };

  useEffect(() => {
    if (isEvmAccountReady) logger.debug('Evm account ready:', address);
    else logger.debug('Evm account not yet ready:', address);
  }, [address, isEvmAccountReady]);

  // Solana
  const { publicKey, connected, wallet } = useWalletSolana();
  const isSolAccountReady = !!(publicKey && wallet && connected);
  const solAddress = publicKey?.toBase58();

  const solAccountInfo = {
    env: ChainEnvironment.Solana,
    address: solAddress,
    connectorName: wallet?.adapter?.name,
    isReady: isSolAccountReady,
  };

  useEffect(() => {
    if (isSolAccountReady) logger.debug('Solana account ready:', solAddress);
    else logger.debug('Sol account not yet ready:', solAddress);
  }, [solAddress, isSolAccountReady]);

  return {
    accounts: {
      [ChainEnvironment.Evm]: evmAccountInfo,
      [ChainEnvironment.Solana]: solAccountInfo,
    },
    readyAccounts: [evmAccountInfo, solAccountInfo].filter((a) => a.isReady),
  };
}

export function useDisconnects(): Record<ChainEnvironment, () => Promise<void>> {
  // Evm
  const { disconnectAsync: disconnectEvm } = useDisconnectWagmi();

  // Solana
  const { disconnect: disconnectSol } = useWalletSolana();

  const onClickDisconnect =
    (env: ChainEnvironment, disconnectFn?: () => Promise<void> | void) => async () => {
      try {
        if (!disconnectFn) throw new Error('Disconnect function is null');
        await disconnectFn();
      } catch (error) {
        logger.error(`Error disconnecting from ${env} wallet`, error);
        toast.error('Could not disconnect wallet');
      }
    };

  return {
    [ChainEnvironment.Evm]: onClickDisconnect(ChainEnvironment.Evm, disconnectEvm),
    [ChainEnvironment.Solana]: onClickDisconnect(ChainEnvironment.Solana, disconnectSol),
  };
}

interface ChainInfo {
  chainName?: string;
  chainId?: number;
}

export function useChains(): {
  chains: Record<ChainEnvironment, ChainInfo>;
  readyChains: Array<ChainInfo>;
} {
  // Evm
  const { chain } = useNetworkWagmi();
  const evmChain = { chainName: chain?.name, chainId: chain?.id };

  // Solana
  const { connection } = useConnection();
  const solChain = { chainName: getSolanaChainName(connection?.rpcEndpoint) };

  return {
    chains: {
      [ChainEnvironment.Evm]: evmChain,
      [ChainEnvironment.Solana]: solChain,
    },
    readyChains: [evmChain, solChain].filter((c) => !!c.chainName),
  };
}

function getSolanaChainName(rpcEndpoint: string) {
  if (rpcEndpoint?.includes('devnet')) return 'Sol Devnet';
  if (rpcEndpoint?.includes('testnet')) return 'Sol Testnet';
  return 'Solana';
}
