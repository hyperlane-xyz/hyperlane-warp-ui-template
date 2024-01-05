import { useMemo } from 'react';
import { toast } from 'react-toastify';

import { ProtocolType } from '@hyperlane-xyz/utils';

import { config } from '../../../consts/config';
import { logger } from '../../../utils/logger';
import { tryGetProtocolType } from '../../caip/chains';

import {
  useCosmosAccount,
  useCosmosActiveChain,
  useCosmosConnectFn,
  useCosmosDisconnectFn,
  useCosmosTransactionFns,
} from './cosmos';
import {
  useEvmAccount,
  useEvmActiveChain,
  useEvmConnectFn,
  useEvmDisconnectFn,
  useEvmTransactionFns,
} from './evm';
import {
  useSolAccount,
  useSolActiveChain,
  useSolConnectFn,
  useSolDisconnectFn,
  useSolTransactionFns,
} from './solana';
import { AccountInfo, ActiveChainInfo, ChainTransactionFns } from './types';

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
  if (account.protocol === ProtocolType.Cosmos) {
    return account.addresses.find((a) => a.chainCaip2Id === chainCaip2Id)?.address;
  } else {
    // Use first because only cosmos has the notion of per-chain addresses
    return account.addresses[0].address;
  }
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
      [ProtocolType.Fuel]: () => alert('TODO'),
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
      [ProtocolType.Fuel]: onClickDisconnect(ProtocolType.Fuel, () => {
        'TODO';
      }),
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
        [ProtocolType.Fuel]: {},
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
