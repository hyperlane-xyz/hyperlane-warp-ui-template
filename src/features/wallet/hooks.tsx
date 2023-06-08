import { useConnection, useWallet as useWalletSolana } from '@solana/wallet-adapter-react';
import { useEffect } from 'react';
import { toast } from 'react-toastify';
import {
  useAccount as useAccountWagmi,
  useDisconnect as useDisconnectWagmi,
  useNetwork as useNetworkWagmi,
} from 'wagmi';

import { getSolanaChainName } from '../../consts/solanaChains';
import { logger } from '../../utils/logger';
import { getCaip2Id } from '../chains/caip2';
import { ProtocolType } from '../chains/types';

interface AccountInfo {
  env: ProtocolType;
  address?: Address;
  connectorName?: string;
  isReady: boolean;
}

export function useAccounts(): {
  accounts: Record<ProtocolType, AccountInfo>;
  readyAccounts: Array<AccountInfo>;
} {
  // Evm
  const { address, isConnected, connector } = useAccountWagmi();
  const isEvmAccountReady = !!(address && isConnected && connector);

  const evmAccountInfo: AccountInfo = {
    env: ProtocolType.Ethereum,
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

  const solAccountInfo: AccountInfo = {
    env: ProtocolType.Sealevel,
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
      [ProtocolType.Ethereum]: evmAccountInfo,
      [ProtocolType.Sealevel]: solAccountInfo,
    },
    readyAccounts: [evmAccountInfo, solAccountInfo].filter((a) => a.isReady),
  };
}

export function useDisconnects(): Record<ProtocolType, () => Promise<void>> {
  // Evm
  const { disconnectAsync: disconnectEvm } = useDisconnectWagmi();

  // Solana
  const { disconnect: disconnectSol } = useWalletSolana();

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

  return {
    [ProtocolType.Ethereum]: onClickDisconnect(ProtocolType.Ethereum, disconnectEvm),
    [ProtocolType.Sealevel]: onClickDisconnect(ProtocolType.Sealevel, disconnectSol),
  };
}

export interface ActiveChainInfo {
  chainDisplayName?: string;
  caip2Id?: Caip2Id;
}

export function useActiveChains(): {
  chains: Record<ProtocolType, ActiveChainInfo>;
  readyChains: Array<ActiveChainInfo>;
} {
  // Evm
  const { chain } = useNetworkWagmi();
  const evmChain: ActiveChainInfo = {
    chainDisplayName: chain?.name,
    caip2Id: chain ? getCaip2Id(ProtocolType.Ethereum, chain.id) : undefined,
  };

  // Solana
  const { connection } = useConnection();
  const { name: solName, displayName: solDisplayName } = getSolanaChainName(
    connection?.rpcEndpoint,
  );
  const solChain: ActiveChainInfo = {
    chainDisplayName: solDisplayName,
    caip2Id: solName ? getCaip2Id(ProtocolType.Sealevel, solName) : undefined,
  };

  return {
    chains: {
      [ProtocolType.Ethereum]: evmChain,
      [ProtocolType.Sealevel]: solChain,
    },
    readyChains: [evmChain, solChain].filter((c) => !!c.chainDisplayName),
  };
}
