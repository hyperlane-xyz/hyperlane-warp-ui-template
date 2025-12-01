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
      <div className="absolute top-2 -right-[52px] hidden flex-col items-center justify-end gap-3 sm:flex">
        <IconButton
          className={`${styles.button}`}
          title="History"
          onClick={() => setIsSideBarOpen(!isSideBarOpen)}
        >
          <HistoryIcon color={Color.gray['600']} height={24} width={24} />
        </IconButton>
        {config.showAddRouteButton && (
          <IconButton className={styles.button} title="Add route" onClick={openAddWarpConfig}>
            <PlusIcon color={Color.gray['600']} height={24} width={24} />
          </IconButton>
        )}
        <Link href={links.warpDocs} target="_blank" className={`${styles.button} ${styles.link}`}>
          <DocsIcon color={Color.gray['600']} height={24} width={24} />
        </Link>
      </div>
      <AddWarpConfigModal isOpen={isAddWarpConfigOpen} close={closeAddWarpConfig} />
    </>
  );
}

const styles = {
  link: 'hover:opacity-70 active:opacity-60',
  button: 'flex size-10 items-center justify-center rounded-2xl bg-[#f8f8ff] p-2',
};
