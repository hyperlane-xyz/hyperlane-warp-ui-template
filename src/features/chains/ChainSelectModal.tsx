import { ChainLogo } from '../../components/icons/ChainLogo';
import { Modal } from '../../components/layout/Modal';

import { getChainDisplayName } from './utils';

export function ChainSelectListModal({
  isOpen,
  close,
  chains,
  onSelect,
}: {
  isOpen: boolean;
  close: () => void;
  chains: ChainName[];
  onSelect: (chain: ChainName) => void;
}) {
  const onSelectChain = (chain: ChainName) => {
    return () => {
      onSelect(chain);
      close();
    };
  };

  return (
    <Modal isOpen={isOpen} title="Select Chain" close={close}>
      <div className="mt-2 flex flex-col space-y-1">
        {chains.map((c) => (
          <button
            key={c}
            className="py-1.5 px-2 text-sm flex items-center rounded hover:bg-gray-100 active:bg-gray-200 transition-all duration-200"
            onClick={onSelectChain(c)}
          >
            <ChainLogo chainName={c} size={16} background={false} />
            <span className="ml-2">{getChainDisplayName(c, true)}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
