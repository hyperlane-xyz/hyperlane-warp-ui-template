import { ChainName, Token } from '@hyperlane-xyz/sdk';
import { Modal } from '@hyperlane-xyz/widgets';
import { useState } from 'react';
import { ChainFilterPanel } from '../chains/ChainFilterPanel';
import { TokenListPanel } from './TokenListPanel';
import { TokenSelectionMode } from './types';

interface Props {
  isOpen: boolean;
  close: () => void;
  onSelect: (token: Token) => void;
  selectionMode: TokenSelectionMode;
  /** The currently selected token on the counterpart side (destination when selecting origin, origin when selecting destination) */
  counterpartToken?: Token;
}

export function UnifiedTokenChainModal({
  isOpen,
  close,
  onSelect,
  selectionMode,
  counterpartToken,
}: Props) {
  const [chainSearch, setChainSearch] = useState('');
  const [tokenSearch, setTokenSearch] = useState('');
  const [selectedChain, setSelectedChain] = useState<ChainName | null>(null);

  const onClose = () => {
    close();
    setChainSearch('');
    setTokenSearch('');
    setSelectedChain(null);
  };

  const onSelectAndClose = (token: Token) => {
    onSelect(token);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} close={onClose} panelClassname="p-0 max-w-[56rem] overflow-hidden">
      <div className="flex h-[600px]">
        <ChainFilterPanel
          searchQuery={chainSearch}
          onSearchChange={setChainSearch}
          selectedChain={selectedChain}
          onSelectChain={setSelectedChain}
        />

        <TokenListPanel
          selectionMode={selectionMode}
          searchQuery={tokenSearch}
          onSearchChange={setTokenSearch}
          chainFilter={selectedChain}
          onSelect={onSelectAndClose}
          counterpartToken={counterpartToken}
        />
      </div>
    </Modal>
  );
}
