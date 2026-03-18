import { ChainMetadata } from '@hyperlane-xyz/sdk';
import { ChainDetailsMenu, Modal } from '@hyperlane-xyz/widgets';
import { useCallback } from 'react';
import { ModalHeader } from '../../components/layout/ModalHeader';
import { useStore } from '../store';

interface Props {
  isOpen: boolean;
  close: () => void;
  chainName: ChainName;
  /** Called when user clicks the Back button inside ChainDetailsMenu */
  onClickBack?: () => void;
}

export function ChainEditModal({ isOpen, close, chainName, onClickBack }: Props) {
  const chainMetadata = useStore((s) => s.chainMetadata);
  const overrides = useStore((s) => s.chainMetadataOverrides[chainName]);
  const setChainMetadataOverrides = useStore((s) => s.setChainMetadataOverrides);

  const metadata = chainMetadata[chainName];

  const onChangeOverrideMetadata = useCallback(
    (chainOverrides?: Partial<ChainMetadata>) => {
      const current = useStore.getState().chainMetadataOverrides;
      setChainMetadataOverrides({
        ...current,
        [chainName]: chainOverrides,
      });
    },
    [chainName, setChainMetadataOverrides],
  );

  const displayName = metadata?.displayName ?? metadata?.name ?? chainName;

  if (!metadata) return null;

  return (
    <Modal isOpen={isOpen} close={close} panelClassname="p-0 max-w-lg overflow-hidden">
      <ModalHeader>{`Edit ${displayName}`}</ModalHeader>
      <div className="chain-edit-container max-h-[80vh] overflow-auto p-4">
        <ChainDetailsMenu
          chainMetadata={metadata}
          overrideChainMetadata={overrides}
          onChangeOverrideMetadata={onChangeOverrideMetadata}
          onClickBack={onClickBack ?? close}
        />
      </div>
    </Modal>
  );
}
