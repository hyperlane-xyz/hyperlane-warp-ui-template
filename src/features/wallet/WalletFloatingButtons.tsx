import Link from 'next/link';

import { DocsIcon, HistoryIcon, IconButton } from '@hyperlane-xyz/widgets';
import { links } from '../../consts/links';
import { Color } from '../../styles/Color';
import { useStore } from '../store';

export function WalletFloatingButtons() {
  const { setIsSideBarOpen, isSideBarOpen } = useStore((s) => ({
    setIsSideBarOpen: s.setIsSideBarOpen,
    isSideBarOpen: s.isSideBarOpen,
  }));

  return (
    <div className="absolute -right-8 top-2 hidden flex-col items-center justify-end gap-4 sm:flex">
      <IconButton
        className={`p-0.5 ${styles.roundedCircle} `}
        title="History"
        onClick={() => setIsSideBarOpen(!isSideBarOpen)}
      >
        <HistoryIcon color={Color.primary['500']} height={20} width={20} />
      </IconButton>
      <Link
        href={links.warpDocs}
        target="_blank"
        className={`p-0.5 ${styles.roundedCircle} ${styles.link}`}
      >
        <DocsIcon color={Color.primary['500']} height={19} width={19} className="p-px" />
      </Link>
    </div>
  );
}

const styles = {
  link: 'hover:opacity-70 active:opacity-60',
  roundedCircle: 'rounded-full bg-white',
};
