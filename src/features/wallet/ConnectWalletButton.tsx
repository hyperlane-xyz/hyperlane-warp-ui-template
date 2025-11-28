import { ConnectWalletButton as ConnectWalletButtonInner } from '@hyperlane-xyz/widgets';
import { useAccounts as useBtcAccounts, useBalance } from '@midl-xyz/midl-js-react';
import { useMultiProvider } from '../chains/hooks';
import { useStore } from '../store';

// Helper to shorten Bitcoin address
const shortenAddress = (address: string, chars = 4): string => {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};

export function ConnectWalletButton() {
  const multiProvider = useMultiProvider();
  const { originChainName } = useStore((s) => ({
    originChainName: s.originChainName,
  }));

  const { setShowEnvSelectModal, setIsSideBarOpen } = useStore((s) => ({
    setShowEnvSelectModal: s.setShowEnvSelectModal,
    setIsSideBarOpen: s.setIsSideBarOpen,
  }));

  // Check Bitcoin wallet status
  const { isConnected: isBtcConnected, accounts: btcAccounts } = useBtcAccounts();
  const { balance: btcBalance } = useBalance({
    query: {
      enabled: isBtcConnected,
    },
  });

  // If Bitcoin wallet is connected, show Bitcoin button
  if (isBtcConnected && btcAccounts?.[0]?.address) {
    const balanceInBTC = btcBalance ? (btcBalance / 100000000).toFixed(6) : '0.000000';

    return (
      <button
        onClick={() => setIsSideBarOpen(true)}
        className="h-10 rounded-xl bg-white px-3 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
      >
        <span className="flex items-center gap-2">
          <span className="font-medium">{balanceInBTC} BTC</span>
          <span className="text-gray-600">{shortenAddress(btcAccounts[0].address)}</span>
        </span>
      </button>
    );
  }

  // Otherwise show EVM wallet button
  return (
    <ConnectWalletButtonInner
      multiProvider={multiProvider}
      onClickWhenUnconnected={() => setShowEnvSelectModal(true)}
      onClickWhenConnected={() => setIsSideBarOpen(true)}
      className="h-10 rounded-xl bg-white px-3"
      countClassName="bg-accent-500"
      chainName={originChainName}
    />
  );
}
