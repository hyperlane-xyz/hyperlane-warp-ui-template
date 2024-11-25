import { ConnectWalletButton as ConnectWalletButtonInner } from '@hyperlane-xyz/widgets';
import { useMultiProvider } from '../chains/hooks';
import { useStore } from '../store';

export function ConnectWalletButton() {
  const multiProvider = useMultiProvider();

  const { setShowEnvSelectModal, setIsSideBarOpen } = useStore((s) => ({
    setShowEnvSelectModal: s.setShowEnvSelectModal,
    setIsSideBarOpen: s.setIsSideBarOpen,
  }));

  return (
    <ConnectWalletButtonInner
      multiProvider={multiProvider}
      onClickWhenUnconnected={() => setShowEnvSelectModal(true)}
      onClickWhenConnected={() => setIsSideBarOpen(true)}
      className="rounded-lg bg-white"
      countClassName="bg-accent-500"
    />
  );
}
