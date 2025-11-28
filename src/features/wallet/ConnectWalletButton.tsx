import { ConnectWalletButton as ConnectWalletButtonInner } from '@hyperlane-xyz/widgets';
import { useMultiProvider } from '../chains/hooks';
import { useStore } from '../store';

export function ConnectWalletButton() {
  const multiProvider = useMultiProvider();
  const { originChainName } = useStore((s) => ({
    originChainName: s.originChainName,
  }));

  const { setShowEnvSelectModal, setIsSideBarOpen } = useStore((s) => ({
    setShowEnvSelectModal: s.setShowEnvSelectModal,
    setIsSideBarOpen: s.setIsSideBarOpen,
  }));

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
