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
      className="rounded-lg bg-accent-gradient font-secondary shadow-accent-glow [&_*]:text-white [&_path]:fill-white"
      countClassName="bg-white/20"
      chainName={originChainName}
    />
  );
}
