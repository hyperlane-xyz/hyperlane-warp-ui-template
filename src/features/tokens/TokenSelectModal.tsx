import dynamic from 'next/dynamic';
import { Suspense } from 'react';

import { Modal } from '../../components/layout/Modal';

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
  onSelect: (tokenAddress: Address) => void;
  sourceChainId: number;
}) {
  const onSelectAndClose = (tokenAddress: Address) => {
    onSelect(tokenAddress);
    close();
  };

  return (
    <Modal isOpen={isOpen} title="Select Token" close={close} width="max-w-lg">
      <Suspense fallback={<Loading />}>
        <DynamicTokenList sourceChainId={sourceChainId} onSelect={onSelectAndClose} />
      </Suspense>
    </Modal>
  );
}

function Loading() {
  return <div className="mt-3 text-gray-500 animate-pulse">Loading...</div>;
}
