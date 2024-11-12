import { ChevronIcon, Modal, SpinnerIcon } from '@hyperlane-xyz/widgets';
import { useField } from 'formik';
import { useState } from 'react';

type Props = {
  name: string;
  tokenIndex?: number;
  disabled?: boolean;
};

export function SelectTokenIdField({ name, disabled }: Props) {
  const [, , helpers] = useField<number>(name);
  const [tokenId, setTokenId] = useState<string | undefined>(undefined);
  const handleChange = (newTokenId: string) => {
    helpers.setValue(parseInt(newTokenId));
    setTokenId(newTokenId);
  };

  const isLoading = false;
  const tokenIds = [];

  const [isModalOpen, setIsModalOpen] = useState(false);

  const onClick = () => {
    if (!disabled) setIsModalOpen(true);
  };

  return (
    <div className="flex flex-col items-center">
      <button type="button" className={styles.base} onClick={onClick}>
        <div className="flex items-center">
          <span className={`ml-2 ${!tokenId && 'text-slate-400'}`}>
            {tokenId ? tokenId : 'Select Token Id'}
          </span>
        </div>
        <ChevronIcon width={12} height={8} direction="s" />
      </button>
      <SelectTokenIdModal
        isOpen={isModalOpen}
        tokenIds={tokenIds}
        isLoading={isLoading}
        close={() => setIsModalOpen(false)}
        onSelect={handleChange}
      />
    </div>
  );
}

export function SelectTokenIdModal({
  isOpen,
  tokenIds,
  isLoading,
  close,
  onSelect,
}: {
  isOpen: boolean;
  tokenIds: string[] | null | undefined;
  isLoading: boolean;
  close: () => void;
  onSelect: (tokenId: string) => void;
}) {
  const onSelectTokenId = (tokenId: string) => {
    return () => {
      onSelect(tokenId);
      close();
    };
  };

  return (
    <Modal
      isOpen={isOpen}
      title="Select Token Id"
      close={close}
      showCloseButton
      panelClassname="p-4"
    >
      <div className="mt-2 flex flex-col space-y-1">
        {isLoading ? (
          <div className="my-24 flex flex-col items-center">
            <SpinnerIcon width={80} height={80} />
            <h3 className="mt-5 text-sm text-gray-500">Finding token IDs</h3>
          </div>
        ) : tokenIds && tokenIds.length !== 0 ? (
          tokenIds.map((id) => (
            <button
              key={id}
              className="flex items-center rounded px-2 py-1.5 text-sm transition-all duration-200 hover:bg-gray-100 active:bg-gray-200"
              onClick={onSelectTokenId(id)}
            >
              <span className="ml-2">{id}</span>
            </button>
          ))
        ) : (
          <div className="px-2 py-1.5 text-sm text-gray-500 transition-all duration-200">
            No token ids found
          </div>
        )}
      </div>
    </Modal>
  );
}

const styles = {
  base: 'mt-1.5 w-full px-2.5 py-2 flex items-center justify-between text-sm bg-white rounded border border-gray-400 outline-none transition-colors duration-500',
  enabled: 'hover:bg-gray-50 active:bg-gray-100 focus:border-primary-500',
  disabled: 'bg-gray-150 cursor-default',
};
