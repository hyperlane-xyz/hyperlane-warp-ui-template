import { ProtocolType, shortenAddress } from '@hyperlane-xyz/utils';
import {
  ChevronIcon,
  DropdownMenu,
  useAccountAddressForChain,
  useAccountForChain,
  useConnectFns,
  useDisconnectFns,
  useModal,
  XIcon,
} from '@hyperlane-xyz/widgets';
import React, { useCallback, useMemo } from 'react';
import { Color } from '../../styles/Color';
import { useChainProtocol, useMultiProvider } from '../chains/hooks';
import { useStore } from '../store';
import { ReceiveAddressModal } from './ReceiveAddressModal';

interface WalletDropdownProps {
  chainName: string | undefined;
  selectionMode: 'origin' | 'destination';
  recipient?: string;
  onRecipientChange?: (address: string) => void;
  disabled?: boolean;
}

export function WalletDropdown({
  chainName,
  selectionMode,
  recipient,
  onRecipientChange,
  disabled,
}: WalletDropdownProps) {
  const multiProvider = useMultiProvider();
  const protocol = useChainProtocol(chainName || '') || ProtocolType.Ethereum;

  const account = useAccountForChain(multiProvider, chainName);
  const isConnected = account?.isReady;
  const connectedAddress = useAccountAddressForChain(multiProvider, chainName);

  const disconnectFns = useDisconnectFns();
  const disconnectFn = disconnectFns[protocol];

  const { setShowEnvSelectModal } = useStore((s) => ({
    setShowEnvSelectModal: s.setShowEnvSelectModal,
  }));

  const { isOpen: isModalOpen, open: openModal, close: closeModal } = useModal();

  const onDisconnect = useCallback(async () => {
    await disconnectFn?.();
  }, [disconnectFn]);

  const onConnectNewWallet = useCallback(() => {
    setShowEnvSelectModal(true);
  }, [setShowEnvSelectModal]);

  const onSaveRecipient = useCallback(
    (address: string) => {
      onRecipientChange?.(address);
    },
    [onRecipientChange],
  );

  const onUseConnectedWallet = useCallback(() => {
    onRecipientChange?.('');
  }, [onRecipientChange]);

  const isDestination = selectionMode === 'destination';
  const hasCustomRecipient = isDestination && !!recipient && recipient !== connectedAddress;
  const displayAddress = hasCustomRecipient ? recipient : connectedAddress;
  const truncatedAddress = displayAddress ? shortenAddress(displayAddress) : '';

  // Build menu items based on state
  const menuItems = useMemo(() => {
    const items: React.ReactNode[] = [];

    // when there is not a wallet connected, show the current chain wallet connect modal
    // if a wallet is connected then show the multi-vm select modal instead
    if (!isConnected) {
      items.push(<ConnectMenuItem key="connect" protocol={protocol} />);
    } else {
      items.push(
        <MenuItemButton key="connect-new" onClick={onConnectNewWallet}>
          Connect new wallet
        </MenuItemButton>,
      );
    }

    if (isDestination) {
      items.push(<MenuSeparator key="sep-1" />);
      items.push(
        <MenuItemButton key="paste" onClick={openModal}>
          Paste wallet address
        </MenuItemButton>,
      );
    }

    if (hasCustomRecipient && isConnected) {
      items.push(<MenuSeparator key="sep-2" />);
      items.push(
        <MenuItemButton key="use-connected" onClick={onUseConnectedWallet}>
          Use connected wallet
        </MenuItemButton>,
      );
    }

    // Only show disconnect if actually connected
    if (isConnected) {
      items.push(<MenuSeparator key="sep-3" />);
      items.push(
        <MenuItemButton key="disconnect" onClick={onDisconnect}>
          Disconnect wallet
        </MenuItemButton>,
      );
    }

    return items;
  }, [
    isDestination,
    hasCustomRecipient,
    isConnected,
    protocol,
    onConnectNewWallet,
    onDisconnect,
    onUseConnectedWallet,
    openModal,
  ]);

  // Origin mode, not connected - simple button without dropdown
  if (!isConnected && !isDestination) {
    return <ConnectWalletButton chainName={chainName} />;
  }

  // All other cases - use dropdown
  return (
    <>
      <DropdownMenu
        button={<DropdownWalletButton address={truncatedAddress} />}
        buttonClassname="flex items-center"
        menuClassname="mt-2 min-w-[200px] rounded-lg border border-gray-200 bg-white py-1 shadow-md"
        menuItems={menuItems}
        buttonProps={{ disabled }}
      />
      <ReceiveAddressModal
        isOpen={isModalOpen}
        close={closeModal}
        onSave={onSaveRecipient}
        initialValue={recipient}
        protocol={protocol}
      />
    </>
  );
}

// Self-contained connect button with its own hooks
function ConnectWalletButton({ chainName }: { chainName?: string }) {
  const protocol = useChainProtocol(chainName || '') || ProtocolType.Ethereum;
  const connectFns = useConnectFns();
  const connectFn = connectFns[protocol];

  const onConnect = useCallback(() => {
    connectFn?.();
  }, [connectFn]);

  return (
    <button
      type="button"
      onClick={onConnect}
      className="flex items-center gap-1.5 text-sm text-primary-500 transition-colors hover:text-primary-600"
    >
      <XIcon width={8} height={8} color={Color.red[500]} />
      <span>Connect Wallet</span>
      <ChevronIcon width={10} height={8} direction="s" color={Color.primary[500]} />
    </button>
  );
}

// Self-contained connect menu item with its own hooks
function ConnectMenuItem({ protocol }: { protocol: ProtocolType }) {
  const connectFns = useConnectFns();
  const connectFn = connectFns[protocol];

  const onConnect = useCallback(() => {
    connectFn?.();
  }, [connectFn]);

  return (
    <button
      type="button"
      onClick={onConnect}
      className="w-full px-4 py-2.5 text-left text-sm text-gray-900 hover:bg-gray-100"
    >
      Connect wallet
    </button>
  );
}

function DropdownWalletButton({ address }: { address: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-primary-500 transition-colors hover:text-primary-600">
      {address ? (
        <div className="h-2 w-2 rounded-full bg-green-50" />
      ) : (
        <XIcon width={8} height={8} color={Color.red[500]} />
      )}
      <span className="text-primary-500">{address || 'Connect Wallet'}</span>
      <ChevronIcon width={10} height={6} direction="s" color={Color.primary[500]} />
    </div>
  );
}

function MenuItemButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full px-4 py-2.5 text-left text-sm text-gray-900 hover:bg-gray-100"
    >
      {children}
    </button>
  );
}

function MenuSeparator() {
  return <div className="mx-2 my-1 h-px bg-primary-50" />;
}
