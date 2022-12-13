import dynamic from 'next/dynamic';
import { Suspense, useState } from 'react';

import { TextInput } from '../../components/input/TextField';
import { Modal } from '../../components/layout/Modal';

import { ListedToken } from './types';

const DynamicTokenList = dynamic(() => import('./TokenList'), {
  suspense: true,
});

export function TokenSelectModal({
  isOpen,
  close,
  onSelect,
  sourceChainId,
}: {
  isOpen: boolean;
  close: () => void;
  onSelect: (token: ListedToken) => void;
  sourceChainId: number;
}) {
  const [search, setSearch] = useState('');

  const onSelectAndClose = (token: ListedToken) => {
    onSelect(token);
    close();
  };

  return (
    <Modal isOpen={isOpen} title="Select Token" close={close} width="max-w-lg min-h-[24rem]">
      <TextInput
        value={search}
        onChange={setSearch}
        placeholder="Name, symbol, or address"
        name="token-search"
        classes="mt-3 mb-4 sm:py-2.5 w-full"
        autoComplete="off"
      />

      <Suspense fallback={<Loading />}>
        <DynamicTokenList
          sourceChainId={sourceChainId}
          searchQuery={search}
          onSelect={onSelectAndClose}
        />
      </Suspense>
    </Modal>
  );
}

function Loading() {
  return <div className="mt-3 text-gray-500 animate-pulse">Loading...</div>;
}
