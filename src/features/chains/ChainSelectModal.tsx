import { ChainMap, ChainMetadata } from '@hyperlane-xyz/sdk';
import { ChainSearchMenu, Modal } from '@hyperlane-xyz/widgets';
import { useStore } from '../store';

export function ChainSelectListModal({
  isOpen,
  close,
  chains,
  onSelect,
  customListItemField,
}: {
  isOpen: boolean;
  close: () => void;
  chains: ChainMap<ChainMetadata>;
  onSelect: (chain: ChainName) => void;
  customListItemField: ChainMap<{
    display: string;
    sortValue: number;
  }>;
}) {
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
        chainMetadata={chains}
        onClickChain={onSelectChain}
        overrideChainMetadata={chainMetadataOverrides}
        onChangeOverrideMetadata={setChainMetadataOverrides}
        customListItemField={{
          header: 'Warp Routes',
          data: customListItemField,
        }}
        defaultSortField="custom"
      />
    </Modal>
  );
}
