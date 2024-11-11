import Link from 'next/link';

import { DocsIcon, HistoryIcon, IconButton, WalletIcon } from '@hyperlane-xyz/widgets';
import { links } from '../../consts/links';
import { Color } from '../../styles/Color';
import { useStore } from '../store';
import { useAccounts } from './hooks/multiProtocol';

export function WalletFloatingButtons() {
  const { readyAccounts } = useAccounts();
  const { setShowEnvSelectModal, setIsSideBarOpen, isSideBarOpen } = useStore((s) => ({
    setShowEnvSelectModal: s.setShowEnvSelectModal,
    setIsSideBarOpen: s.setIsSideBarOpen,
    isSideBarOpen: s.isSideBarOpen,
  }));

  const numReady = readyAccounts.length;

  return (
    <div className="absolute -right-8 top-2 hidden flex-col items-center justify-end gap-4 sm:flex">
      {numReady === 0 && (
        <IconButton
          className={`p-1 ${styles.roundedCircle}`}
          title="Connect Wallet"
          onClick={() => setShowEnvSelectModal(true)}
        >
          <WalletIcon color={Color.primary} height={16} width={16} />
        </IconButton>
      )}
      {numReady >= 1 && (
        <IconButton
          className={`p-0.5 ${styles.roundedCircle} `}
          title="History"
          onClick={() => setIsSideBarOpen(!isSideBarOpen)}
        >
          <HistoryIcon color={Color.primary} height={20} width={20} />
        </IconButton>
      )}
      <Link
        href={links.warpDocs}
        target="_blank"
        className={`p-0.5 ${styles.roundedCircle} ${styles.link}`}
      >
        <DocsIcon color={Color.primary} height={20} width={20} />
      </Link>
    </div>
  );
}

const styles = {
  link: 'hover:opacity-70 active:opacity-60',
  roundedCircle: 'rounded-full bg-white',
};
