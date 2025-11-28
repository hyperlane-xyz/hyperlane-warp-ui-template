import { useAccounts, useBalance } from '@midl-xyz/midl-js-react';
import { ConnectButton } from '@midl-xyz/satoshi-kit';
import { useStore } from '../store';

// Helper to shorten Bitcoin address
const shortenAddress = (address: string, chars = 4): string => {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};

export function BitcoinConnectButton() {
  const { isConnected, accounts } = useAccounts();
  const { balance: btcBalance } = useBalance({
    query: {
      enabled: isConnected,
    },
  });
  const { setIsSideBarOpen } = useStore((s) => ({
    setIsSideBarOpen: s.setIsSideBarOpen,
  }));

  return (
    <ConnectButton>
      {({ openConnectDialog, isConnected, isConnecting }) => {
        const getButtonText = () => {
          if (isConnecting) {
            return 'Connecting...';
          }
          if (isConnected && accounts?.[0]?.address) {
            const balanceInBTC = btcBalance ? (btcBalance / 100000000).toFixed(6) : '0.000000';
            return (
              <span className="flex items-center gap-2">
                <span className="font-medium">{balanceInBTC} BTC</span>
                <span className="text-gray-600">{shortenAddress(accounts[0].address)}</span>
              </span>
            );
          }
          return 'Connect Bitcoin Wallet';
        };

        const handleClick = () => {
          if (isConnected) {
            setIsSideBarOpen(true);
          } else {
            openConnectDialog();
          }
        };

        return (
          <button
            onClick={handleClick}
            disabled={isConnecting}
            className="h-10 rounded-xl bg-white px-3 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {getButtonText()}
          </button>
        );
      }}
    </ConnectButton>
  );
}
