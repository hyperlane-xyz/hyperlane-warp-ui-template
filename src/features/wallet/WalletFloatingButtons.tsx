import Link from 'next/link';

import { IconButton } from '../../components/buttons/IconButton';
import { DocsIcon } from '../../components/icons/Docs';
import { WalletIcon } from '../../components/icons/Wallet';
import { links } from '../../consts/links';
import HistoryIcon from '../../images/icons/history.svg';
import { Color } from '../../styles/Color';
import { useIsMobile } from '../../styles/mediaQueries';
import { useStore } from '../store';

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
    <div className="flex items-center justify-end gap-4">
      <Link href={links.warpDocs} target="_blank" className={linkStyles}>
        <DocsIcon />
      </Link>
      {numReady === 0 && (
        <IconButton title="Connect Wallet" onClick={() => setShowEnvSelectModal(true)}>
          <WalletIcon color={Color.white} height={17} width={20} />
        </IconButton>
      )}
      {numReady >= 1 && (
        <IconButton
          imgSrc={HistoryIcon}
          title="History"
          onClick={() => setIsSideBarOpen(!isSideBarOpen)}
        />
      )}
    </div>
  );
}

const linkStyles = 'hover:opacity-70 active:opacity-60';
