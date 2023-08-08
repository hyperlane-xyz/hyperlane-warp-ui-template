import { useMemo } from 'react';

import { ChainLogo } from '../../components/icons/ChainLogo';
import { Modal } from '../../components/layout/Modal';
import { getAllTokens } from '../tokens/metadata';
import { RoutesMap } from '../tokens/routes/types';
import { hasTokenRoute } from '../tokens/routes/utils';

import { getChainDisplayName } from './utils';

export function ChainSelectListModal({
  isOpen,
  close,
  caip2Ids,
  onSelect,
  selectedCaip2Id,
  tokenRoutes,
}: {
  isOpen: boolean;
  close: () => void;
  caip2Ids: Caip2Id[];
  onSelect: (caip2Id: Caip2Id) => void;
  selectedCaip2Id: Caip2Id;
  tokenRoutes: RoutesMap;
}) {
  const onSelectChain = (caip2Id: Caip2Id) => {
    return () => {
      onSelect(caip2Id);
      close();
    };
  };

  const tokens = useMemo(() => getAllTokens(), []);

  const chains = useMemo(() => {
    return caip2Ids.map((caip2Id) => {
      const hasRoute = tokens.some((t) =>
        hasTokenRoute(selectedCaip2Id, caip2Id, t.caip19Id, tokenRoutes),
      );
      return { caip2Id, disabled: !hasRoute };
    });
  }, [selectedCaip2Id, tokenRoutes, tokens, caip2Ids]);

  return (
    <Modal isOpen={isOpen} title="Select Chain" close={close}>
      <div className="mt-2 flex flex-col space-y-1">
        {chains.map((c) => (
          <button
            key={c.caip2Id}
            disabled={c.disabled}
            className={`py-1.5 px-2 text-sm flex items-center rounded transition-all duration-200 ${
              c.disabled ? 'opacity-50' : 'hover:bg-gray-100 active:bg-gray-200'
            }`}
            onClick={onSelectChain(c.caip2Id)}
          >
            <ChainLogo caip2Id={c.caip2Id} size={16} background={false} />
            <span className="ml-2">{getChainDisplayName(c.caip2Id, true)}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
