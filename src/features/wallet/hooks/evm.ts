import { useConnectModal } from '@rainbow-me/rainbowkit';
import { getNetwork, sendTransaction, switchNetwork, waitForTransaction } from '@wagmi/core';
import { useCallback, useMemo } from 'react';
import { useAccount, useDisconnect, useNetwork } from 'wagmi';
import { InjectedConnector } from 'wagmi/connectors/injected';

import { ProviderType, TypedTransactionReceipt, WarpTypedTransaction } from '@hyperlane-xyz/sdk';
import { ProtocolType, assert, sleep } from '@hyperlane-xyz/utils';

import { logger } from '../../../utils/logger';
import { getChainMetadata, tryGetChainMetadata } from '../../chains/utils';
import { ethers5TxToWagmiTx } from '../utils';

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
      chainName: chain ? tryGetChainMetadata(chain.id)?.name : undefined,
    }),
    [chain],
  );
}

export function useEvmTransactionFns(): ChainTransactionFns {
  const onSwitchNetwork = useCallback(async (chainName: ChainName) => {
    const chainId = getChainMetadata(chainName).chainId as number;
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
      chainName,
      activeChainName,
    }: {
      tx: WarpTypedTransaction;
      chainName: ChainName;
      activeChainName?: ChainName;
    }) => {
      if (tx.type !== ProviderType.EthersV5) throw new Error(`Unsupported tx type: ${tx.type}`);

      // If the active chain is different from tx origin chain, try to switch network first
      if (activeChainName && activeChainName !== chainName) await onSwitchNetwork(chainName);

      // Since the network switching is not foolproof, we also force a network check here
      const chainId = getChainMetadata(chainName).chainId as number;
      logger.debug('Checking wallet current chain');
      const latestNetwork = await getNetwork();
      assert(
        latestNetwork.chain?.id === chainId,
        `Wallet not on chain ${chainName} (ChainMismatchError)`,
      );

      logger.debug(`Sending tx on chain ${chainName}`);
      const wagmiTx = ethers5TxToWagmiTx(tx.transaction);
      const { hash } = await sendTransaction({
        chainId,
        ...wagmiTx,
      });
      const confirm = (): Promise<TypedTransactionReceipt> =>
        waitForTransaction({ chainId, hash, confirmations: 1 }).then((r) => ({
          type: ProviderType.Viem,
          receipt: r,
        }));
      return { hash, confirm };
    },
    [onSwitchNetwork],
  );

  return { sendTransaction: onSendTx, switchNetwork: onSwitchNetwork };
}

export function useEvmConnectorName() {
  const { connector } = useAccount();
  const account = useEvmAccount();

  if (connector instanceof InjectedConnector && account?.connectorName === connector.name) {
    if (window.ethereum?.isOkxWallet || window.ethereum?.isOKExWallet) return 'OKX';
    if (window.ethereum?.isBackpack) return 'Backpack';
    if (window.ethereum?.isFrame) return 'Frame';
    if (window.ethereum?.isPhantom) return 'Phantom';

    const keys = Object.keys({ ...window.ethereum });
    if (keys.includes('isOkxWallet') || keys.includes('isOKExWallet')) {
      return 'OKX';
    }
  }

  return connector?.name;
}
