import { useField } from 'formik';
import Image from 'next/image';
import { useState } from 'react';

import { Spinner } from '../../components/animation/Spinner';
import { Modal } from '../../components/layout/Modal';
import ChevronIcon from '../../images/icons/chevron-down.svg';

import { useOriginTokenIdBalance } from './balances';

type Props = {
  name: string;
  tokenCaip19Id: TokenCaip19Id;
  disabled?: boolean;
};

export function SelectTokenIdField({ name, tokenCaip19Id, disabled }: Props) {
  const [, , helpers] = useField<number>(name);
  const [tokenId, setTokenId] = useState<string | undefined>(undefined);
  const handleChange = (newTokenId: string) => {
    helpers.setValue(parseInt(newTokenId));
    setTokenId(newTokenId);
  };

  const { isLoading, tokenIds } = useOriginTokenIdBalance(tokenCaip19Id);

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
        <Image src={ChevronIcon} width={12} height={8} alt="" />
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
    <Modal isOpen={isOpen} title="Select Token Id" close={close}>
      <div className="mt-2 flex flex-col space-y-1">
        {isLoading ? (
          <div className="my-24 flex flex-col items-center">
            <Spinner />
            <h3 className="mt-5 text-sm text-gray-500">Finding token IDs</h3>
          </div>
        ) : tokenIds && tokenIds.length !== 0 ? (
          tokenIds.map((id) => (
            <button
              key={id}
              className="py-1.5 px-2 text-sm flex items-center rounded hover:bg-gray-100 active:bg-gray-200 transition-all duration-200"
              onClick={onSelectTokenId(id)}
            >
              <span className="ml-2">{id}</span>
            </button>
          ))
        ) : (
          <div className="py-1.5 px-2 text-sm text-gray-500 transition-all duration-200">
            No token ids found
          </div>
        )}
      </div>
    </Modal>
  );
}

const styles = {
  base: 'mt-1.5 w-full px-2.5 py-2 flex items-center justify-between text-sm bg-white rounded border border-gray-400 outline-none transition-colors duration-500',
  enabled: 'hover:bg-gray-50 active:bg-gray-100 focus:border-blue-500',
  disabled: 'bg-gray-150 cursor-default',
};
