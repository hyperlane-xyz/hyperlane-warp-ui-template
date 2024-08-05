import { useMemo } from 'react';
import { toast } from 'react-toastify';

import { HexString, ProtocolType } from '@hyperlane-xyz/utils';

import { config } from '../../../consts/config';
import { logger } from '../../../utils/logger';
import { getChainProtocol, tryGetChainProtocol } from '../../chains/utils';

import {
  useCosmosAccount,
  useCosmosActiveChain,
  useCosmosConnectFn,
  useCosmosDisconnectFn,
  useCosmosTransactionFns,
  useCosmosWalletDetails,
} from './cosmos';
import {
  useEvmAccount,
  useEvmActiveChain,
  useEvmConnectFn,
  useEvmDisconnectFn,
  useEvmTransactionFns,
  useEvmWalletDetails,
} from './evm';
import {
  useSolAccount,
  useSolActiveChain,
  useSolConnectFn,
  useSolDisconnectFn,
  useSolTransactionFns,
  useSolWalletDetails,
} from './solana';
import { AccountInfo, ActiveChainInfo, ChainTransactionFns, WalletDetails } from './types';

export function useAccounts(): {
  accounts: Record<ProtocolType, AccountInfo>;
  readyAccounts: Array<AccountInfo>;
} {
  const evmAccountInfo = useEvmAccount();
  const solAccountInfo = useSolAccount();
  const cosmAccountInfo = useCosmosAccount();

  // Filtered ready accounts
  const readyAccounts = useMemo(
    () => [evmAccountInfo, solAccountInfo, cosmAccountInfo].filter((a) => a.isReady),
    [evmAccountInfo, solAccountInfo, cosmAccountInfo],
  );

  // Check if any of the ready accounts are blacklisted
  const readyAddresses = readyAccounts
    .map((a) => a.addresses)
    .flat()
    .map((a) => a.address.toLowerCase());
  if (readyAddresses.some((a) => config.addressBlacklist.includes(a))) {
    throw new Error('Wallet address is blacklisted');
  }

  return useMemo(
    () => ({
      accounts: {
        [ProtocolType.Ethereum]: evmAccountInfo,
        [ProtocolType.Sealevel]: solAccountInfo,
        [ProtocolType.Cosmos]: cosmAccountInfo,
      },
      readyAccounts,
    }),
    [evmAccountInfo, solAccountInfo, cosmAccountInfo, readyAccounts],
  );
}

export function useAccountForChain(chainName?: ChainName): AccountInfo | undefined {
  const { accounts } = useAccounts();
  if (!chainName) return undefined;
  const protocol = tryGetChainProtocol(chainName);
  if (!protocol) return undefined;
  return accounts?.[protocol];
}

export function useAccountAddressForChain(chainName?: ChainName): Address | undefined {
  return getAccountAddressForChain(chainName, useAccounts().accounts);
}

export function getAccountAddressForChain(
  chainName?: ChainName,
  accounts?: Record<ProtocolType, AccountInfo>,
): Address | undefined {
  if (!chainName || !accounts) return undefined;
  const protocol = getChainProtocol(chainName);
  const account = accounts[protocol];
  if (protocol === ProtocolType.Cosmos) {
    return account?.addresses.find((a) => a.chainName === chainName)?.address;
  } else {
    // Use first because only cosmos has the notion of per-chain addresses
    return account?.addresses[0]?.address;
  }
}

export function getAccountAddressAndPubKey(
  chainName?: ChainName,
  accounts?: Record<ProtocolType, AccountInfo>,
): { address?: Address; publicKey?: Promise<HexString> } {
  const address = getAccountAddressForChain(chainName, accounts);
  if (!accounts || !chainName || !address) return {};
  const protocol = getChainProtocol(chainName);
  const publicKey = accounts[protocol]?.publicKey;
  return { address, publicKey };
}

export function useWalletDetails(): Record<ProtocolType, WalletDetails> {
  const evmWallet = useEvmWalletDetails();
  const solWallet = useSolWalletDetails();
  const cosmosWallet = useCosmosWalletDetails();

  return useMemo(
    () => ({
      [ProtocolType.Ethereum]: evmWallet,
      [ProtocolType.Sealevel]: solWallet,
      [ProtocolType.Cosmos]: cosmosWallet,
    }),
    [evmWallet, solWallet, cosmosWallet],
  );
}

export function useConnectFns(): Record<ProtocolType, () => void> {
  const onConnectEthereum = useEvmConnectFn();
  const onConnectSolana = useSolConnectFn();
  const onConnectCosmos = useCosmosConnectFn();

  return useMemo(
    () => ({
      [ProtocolType.Ethereum]: onConnectEthereum,
      [ProtocolType.Sealevel]: onConnectSolana,
      [ProtocolType.Cosmos]: onConnectCosmos,
    }),
    [onConnectEthereum, onConnectSolana, onConnectCosmos],
  );
}

export function useDisconnectFns(): Record<ProtocolType, () => Promise<void>> {
  const disconnectEvm = useEvmDisconnectFn();
  const disconnectSol = useSolDisconnectFn();
  const disconnectCosmos = useCosmosDisconnectFn();

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
      [ProtocolType.Cosmos]: onClickDisconnect(ProtocolType.Cosmos, disconnectCosmos),
    }),
    [disconnectEvm, disconnectSol, disconnectCosmos],
  );
}

export function useActiveChains(): {
  chains: Record<ProtocolType, ActiveChainInfo>;
  readyChains: Array<ActiveChainInfo>;
} {
  const evmChain = useEvmActiveChain();
  const solChain = useSolActiveChain();
  const cosmChain = useCosmosActiveChain();

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
      },
      readyChains,
    }),
    [evmChain, solChain, cosmChain, readyChains],
  );
}

export function useTransactionFns(): Record<ProtocolType, ChainTransactionFns> {
  const { switchNetwork: onSwitchEvmNetwork, sendTransaction: onSendEvmTx } =
    useEvmTransactionFns();
  const { switchNetwork: onSwitchSolNetwork, sendTransaction: onSendSolTx } =
    useSolTransactionFns();
  const { switchNetwork: onSwitchCosmNetwork, sendTransaction: onSendCosmTx } =
    useCosmosTransactionFns();

  return useMemo(
    () => ({
      [ProtocolType.Ethereum]: { sendTransaction: onSendEvmTx, switchNetwork: onSwitchEvmNetwork },
      [ProtocolType.Sealevel]: { sendTransaction: onSendSolTx, switchNetwork: onSwitchSolNetwork },
      [ProtocolType.Cosmos]: { sendTransaction: onSendCosmTx, switchNetwork: onSwitchCosmNetwork },
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
