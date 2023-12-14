import { useConnectModal } from '@rainbow-me/rainbowkit';
import {
  SendTransactionArgs,
  sendTransaction,
  switchNetwork,
  waitForTransaction,
} from '@wagmi/core';
import { useCallback, useMemo } from 'react';
import { useAccount, useDisconnect, useNetwork } from 'wagmi';

import { ProtocolType, sleep } from '@hyperlane-xyz/utils';

import { logger } from '../../../utils/logger';
import { getCaip2Id, getEthereumChainId } from '../../caip/chains';

import { AccountInfo, ActiveChainInfo, ChainTransactionFns } from './types';

export function useEvmAccount(): AccountInfo {
  const { address, isConnected, connector } = useAccount();
  const isReady = !!(address && isConnected && connector);
  const connectorName = connector?.name;

  return useMemo<AccountInfo>(
    () => ({
      protocol: ProtocolType.Ethereum,
      addresses: address ? [{ address: `${address}` }] : [],
      connectorName: connectorName,
      isReady: isReady,
    }),
    [address, connectorName, isReady],
  );
}

export function useEvmConnectFn(): () => void {
  const { openConnectModal } = useConnectModal();
  return useCallback(() => openConnectModal?.(), [openConnectModal]);
}

export function useEvmDisconnectFn(): () => Promise<void> {
  const { disconnectAsync } = useDisconnect();
  return disconnectAsync;
}

export function useEvmActiveChain(): ActiveChainInfo {
  const { chain } = useNetwork();
  return useMemo<ActiveChainInfo>(
    () => ({
      chainDisplayName: chain?.name,
      chainCaip2Id: chain ? getCaip2Id(ProtocolType.Ethereum, chain.id) : undefined,
    }),
    [chain],
  );
}

export function useEvmTransactionFns(): ChainTransactionFns {
  const onSwitchNetwork = useCallback(async (chainCaip2Id: ChainCaip2Id) => {
    const chainId = getEthereumChainId(chainCaip2Id);
    await switchNetwork({ chainId });
    // Some wallets seem to require a brief pause after switch
    await sleep(2000);
  }, []);
  // Note, this doesn't use wagmi's prepare + send pattern because we're potentially sending two transactions
  // The prepare hooks are recommended to use pre-click downtime to run async calls, but since the flow
  // may require two serial txs, the prepare hooks aren't useful and complicate hook architecture considerably.
  // See https://github.com/hyperlane-xyz/hyperlane-warp-ui-template/issues/19
  // See https://github.com/wagmi-dev/wagmi/discussions/1564
  const onSendTx = useCallback(
    async ({
      tx,
      chainCaip2Id,
      activeCap2Id,
    }: {
      tx: SendTransactionArgs;
      chainCaip2Id: ChainCaip2Id;
      activeCap2Id?: ChainCaip2Id;
    }) => {
      if (activeCap2Id && activeCap2Id !== chainCaip2Id) await onSwitchNetwork(chainCaip2Id);
      const chainId = getEthereumChainId(chainCaip2Id);
      logger.debug(`Sending tx on chain ${chainCaip2Id}`);
      const { hash } = await sendTransaction({
        chainId,
        ...tx,
      });
      const confirm = () => waitForTransaction({ chainId, hash, confirmations: 1 });
      return { hash, confirm };
    },
    [onSwitchNetwork],
  );

  return { sendTransaction: onSendTx, switchNetwork: onSwitchNetwork };
}
