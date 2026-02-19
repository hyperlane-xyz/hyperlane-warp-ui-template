import { ChainMetadata } from '@hyperlane-xyz/sdk';
import { ChainSearchMenu, ChainSearchMenuProps, Modal } from '@hyperlane-xyz/widgets';
import { useEffect, useRef } from 'react';
import { config } from '../../consts/config';
import { observeDarkLogosInContainer } from '../../utils/imageBrightness';
import { useStore } from '../store';

export function ChainSelectListModal({
  isOpen,
  close,
  onSelect,
  customListItemField,
  showChainDetails,
}: {
  isOpen: boolean;
  close: () => void;
  onSelect: (chain: ChainName) => void;
  customListItemField?: ChainSearchMenuProps['customListItemField'];
  showChainDetails?: ChainSearchMenuProps['showChainDetails'];
}) {
  const { chainMetadata, chainMetadataOverrides, setChainMetadataOverrides } = useStore((s) => ({
    chainMetadata: s.chainMetadata,
    chainMetadataOverrides: s.chainMetadataOverrides,
    setChainMetadataOverrides: s.setChainMetadataOverrides,
  }));
  const contentRef = useRef<HTMLDivElement>(null);

  const onSelectChain = (chain: ChainMetadata) => {
    onSelect(chain.name);
    close();
  };

  // Detect chain logos rendered by the widget and process only newly added images.
  useEffect(() => {
    if (!isOpen) return;
    if (typeof window === 'undefined') return;

    let frame = 0;
    let attempts = 0;
    let logoObserver: MutationObserver | null = null;

    const attachObserver = () => {
      const el = contentRef.current || document.querySelector('.chain-picker-modal');
      if (!el) {
        attempts += 1;
        if (attempts < 12) frame = window.requestAnimationFrame(attachObserver);
        return;
      }

      logoObserver = observeDarkLogosInContainer(el);
    };

    frame = window.requestAnimationFrame(attachObserver);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      logoObserver?.disconnect();
    };
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      close={close}
      panelClassname="chain-picker-modal p-4 sm:p-5 max-w-lg min-h-[40vh]"
    >
      <div ref={contentRef}>
        <ChainSearchMenu
          chainMetadata={chainMetadata}
          onClickChain={onSelectChain}
          overrideChainMetadata={chainMetadataOverrides}
          onChangeOverrideMetadata={setChainMetadataOverrides}
          customListItemField={customListItemField}
          defaultSortField="custom"
          showChainDetails={showChainDetails}
          shouldDisableChains={config.shouldDisableChains}
          showAddChainButton={config.showAddChainButton}
        />
      </div>
    </Modal>
  );
}
