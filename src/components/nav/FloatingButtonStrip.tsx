import Link from 'next/link';

import { DocsIcon, HistoryIcon, IconButton, PlusIcon, useModal } from '@hyperlane-xyz/widgets';
import { config } from '../../consts/config';
import { links } from '../../consts/links';
import { useStore } from '../../features/store';
import { AddWarpConfigModal } from '../../features/warpCore/AddWarpConfigModal';
import { Color } from '../../styles/Color';

export function FloatingButtonStrip() {
  const { setIsSideBarOpen, isSideBarOpen } = useStore((s) => ({
    setIsSideBarOpen: s.setIsSideBarOpen,
    isSideBarOpen: s.isSideBarOpen,
  }));

  const {
    isOpen: isAddWarpConfigOpen,
    open: openAddWarpConfig,
    close: closeAddWarpConfig,
  } = useModal();

  return (
    <>
      <div className="absolute -right-8 top-2 hidden flex-col items-center justify-end gap-3 sm:flex">
        <IconButton
          className={`p-0.5 ${styles.roundedCircle}`}
          title="History"
          onClick={() => setIsSideBarOpen(!isSideBarOpen)}
        >
          <HistoryIcon color={Color.primary['500']} height={22} width={22} />
        </IconButton>
        {config.showAddRouteButton && (
          <IconButton
            className={styles.roundedCircle}
            title="Add route"
            onClick={openAddWarpConfig}
          >
            <PlusIcon color={Color.primary['500']} height={26} width={26} />
          </IconButton>
        )}
        <Link
          href={links.warpDocs}
          target="_blank"
          className={`p-0.5 ${styles.roundedCircle} ${styles.link}`}
        >
          <DocsIcon color={Color.primary['500']} height={21} width={21} className="p-px" />
        </Link>
      </div>
      <AddWarpConfigModal isOpen={isAddWarpConfigOpen} close={closeAddWarpConfig} />
    </>
  );
}

const styles = {
  link: 'hover:opacity-70 active:opacity-60',
  roundedCircle: 'rounded-full bg-white',
};
