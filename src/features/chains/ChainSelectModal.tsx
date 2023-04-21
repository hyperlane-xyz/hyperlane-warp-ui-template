import { ChainLogo } from '@hyperlane-xyz/widgets';

import { Modal } from '../../components/layout/Modal';
import { getMultiProvider } from '../multiProvider';

import { getChainDisplayName } from './utils';

export function ChainSelectListModal({
  isOpen,
  close,
  chainIds,
  onSelect,
}: {
  isOpen: boolean;
  close: () => void;
  chainIds: ChainId[];
  onSelect: (chainId: ChainId) => void;
}) {
  const onSelectChain = (chainId: ChainId) => {
    return () => {
      onSelect(chainId);
      close();
    };
  };

  const multiProvider = getMultiProvider();
  const chainMetadata = chainIds.map((c) => multiProvider.getChainMetadata(c));

  return (
    <Modal isOpen={isOpen} title="Select Chain" close={close}>
      <div className="mt-2 flex flex-col space-y-1">
        {chainMetadata.map((c) => (
          <button
            key={c.name}
            className="py-1.5 px-2 text-sm flex items-center rounded hover:bg-gray-100 active:bg-gray-200 transition-all duration-200"
            onClick={onSelectChain(c.chainId)}
          >
            <ChainLogo chainId={c.chainId} size={16} background={false} />
            <span className="ml-2">{getChainDisplayName(c.chainId, true)}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
