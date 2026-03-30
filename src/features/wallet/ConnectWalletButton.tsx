import { shortenAddress } from '@hyperlane-xyz/utils';
import { ChevronIcon } from '@hyperlane-xyz/widgets/icons/Chevron';
import { WalletIcon } from '@hyperlane-xyz/widgets/icons/Wallet';
import { getAddressFromAccountAndChain } from '@hyperlane-xyz/widgets/walletIntegrations/accountUtils';
import { WalletLogo } from '@hyperlane-xyz/widgets/walletIntegrations/WalletLogo';

import { useMultiProvider } from '../chains/hooks';
import { useStore } from '../store';
import { ProtocolWalletBridge } from './ProtocolWalletBridge';

export function ConnectWalletButton() {
  const multiProvider = useMultiProvider();
  const { originChainName, setShowEnvSelectModal, setIsSideBarOpen } = useStore((s) => ({
    originChainName: s.originChainName,
    setShowEnvSelectModal: s.setShowEnvSelectModal,
    setIsSideBarOpen: s.setIsSideBarOpen,
  }));

  const protocol = originChainName ? multiProvider.tryGetProtocol(originChainName) : undefined;

  return (
    <ProtocolWalletBridge protocol={protocol} multiProvider={multiProvider} chainName={originChainName}>
      {({ account, walletDetails }) => {
        const address = getAddressFromAccountAndChain(account, originChainName);
        const isReady = !!account?.isReady && !!address && address !== 'Unknown';
        const shownAddress = isReady ? shortenAddress(address, true) : '';

        if (!isReady) {
          return (
            <button
              type="button"
              onClick={() => setShowEnvSelectModal(true)}
              className="flex items-center gap-2 rounded-lg bg-accent-gradient px-3 py-2 text-white shadow-accent-glow"
              title="Choose wallet"
            >
              <WalletIcon width={16} height={16} />
              <span className="text-xs sm:text-sm">Connect wallet</span>
            </button>
          );
        }

        return (
          <button
            type="button"
            onClick={() => setIsSideBarOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-accent-gradient px-2.5 py-1 text-white shadow-accent-glow"
          >
            <WalletLogo walletDetails={walletDetails || {}} size={26} />
            <div className="mx-1 hidden flex-col items-start sm:flex">
              <div className="text-xs text-white/80">{walletDetails?.name || 'Wallet'}</div>
              <div className="text-xs">{shownAddress}</div>
            </div>
            <ChevronIcon direction="s" width={10} height={6} />
          </button>
        );
      }}
    </ProtocolWalletBridge>
  );
}
