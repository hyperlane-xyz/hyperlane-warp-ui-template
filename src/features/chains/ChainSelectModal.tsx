import { ChainMetadata } from '@hyperlane-xyz/sdk';
import { ChainSearchMenu, ChainSearchMenuProps, Modal } from '@hyperlane-xyz/widgets';
import { useStore } from '../store';
import { useMultiProvider } from './hooks';

export function ChainSelectListModal({
  isOpen,
  close,
  onSelect,
  customListItemField,
}: {
  isOpen: boolean;
  close: () => void;
  onSelect: (chain: ChainName) => void;
  customListItemField: ChainSearchMenuProps['customListItemField'];
}) {
  const multiProvider = useMultiProvider();

  const { chainMetadataOverrides, setChainMetadataOverrides } = useStore((s) => ({
    chainMetadataOverrides: s.chainMetadataOverrides,
    setChainMetadataOverrides: s.setChainMetadataOverrides,
  }));

  const onSelectChain = (chain: ChainMetadata) => {
    onSelect(chain.name);
    close();
  };

  return (
    <Modal isOpen={isOpen} close={close} panelClassname="p-4 sm:p-5 max-w-lg min-h-[40vh]">
      <ChainSearchMenu
        chainMetadata={multiProvider.metadata}
        onClickChain={onSelectChain}
        overrideChainMetadata={chainMetadataOverrides}
        onChangeOverrideMetadata={setChainMetadataOverrides}
        customListItemField={customListItemField}
        defaultSortField="custom"
      />
    </Modal>
  );
}
