import Link from 'next/link';

import { IconButton } from '../../components/buttons/IconButton';
import { DocsIcon } from '../../components/icons/Docs';
import { WalletIcon } from '../../components/icons/Wallet';
import { links } from '../../consts/links';
import { Color } from '../../styles/Color';
import { useIsMobile } from '../../styles/mediaQueries';
import { useStore } from '../store';

import { HistoryIcon } from '../../components/icons/History';
import { useAccounts } from './hooks/multiProtocol';

export function WalletFloatingButtons() {
  const { readyAccounts } = useAccounts();
  const isMobile = useIsMobile();
  const { setShowEnvSelectModal, setIsSideBarOpen, isSideBarOpen } = useStore((s) => ({
    setShowEnvSelectModal: s.setShowEnvSelectModal,
    setIsSideBarOpen: s.setIsSideBarOpen,
    isSideBarOpen: s.isSideBarOpen,
  }));

  const numReady = readyAccounts.length;

  if (isMobile) return null;

  return (
    <div className="absolute -right-8 top-2 flex flex-col items-center justify-end gap-4">
      {numReady === 0 && (
        <IconButton
          classes={`p-1 ${styles.roundedCircle} `}
          title="Connect Wallet"
          onClick={() => setShowEnvSelectModal(true)}
        >
          <WalletIcon color={Color.blue} height={16} width={16} />
        </IconButton>
      )}
      {numReady >= 1 && (
        <IconButton
          classes={`p-0.5 ${styles.roundedCircle} `}
          title="History"
          onClick={() => setIsSideBarOpen(!isSideBarOpen)}
        >
          <HistoryIcon color={Color.blue} height={20} width={20} />
        </IconButton>
      )}
      <Link
        href={links.warpDocs}
        target="_blank"
        className={`p-0.5 ${styles.roundedCircle} ${styles.link}`}
      >
        <DocsIcon color={Color.blue} height={20} width={20} />
      </Link>
    </div>
  );
}

const styles = {
  link: 'hover:opacity-70 active:opacity-60',
  roundedCircle: 'rounded-full bg-white ',
};
