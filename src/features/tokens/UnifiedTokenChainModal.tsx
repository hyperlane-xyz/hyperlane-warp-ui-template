import { Token } from '@hyperlane-xyz/sdk';
import { Modal } from '@hyperlane-xyz/widgets';
import { useState } from 'react';
import { ModalHeader } from '../../components/layout/ModalHeader';
import { trackChainSelectionEvent } from '../analytics/utils';
import { ChainFilterPanel } from '../chains/ChainFilterPanel';
import { ChainInfo } from '../chains/hooks';
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
  const [selectedChain, setSelectedChain] = useState<ChainInfo | null>(null);
  // Mobile-only state: whether to show the full chain list
  const [showMobileChainList, setShowMobileChainList] = useState(false);

  const onClose = () => {
    close();
    setChainSearch('');
    setTokenSearch('');
    setSelectedChain(null);
    setShowMobileChainList(false);
  };

  const handleSelectToken = (token: Token) => {
    onSelect(token);
    onClose();
  };

  const handleSelectChain = (chain: ChainInfo | null) => {
    setSelectedChain((prev) => {
      if (prev?.name === chain?.name) return prev;
      trackChainSelectionEvent(selectionMode, chain, prev);
      return chain;
    });
  };

  // Mobile: when selecting a chain from the full list, go back to tokens
  const handleSelectChainMobile = (chain: ChainInfo | null) => {
    handleSelectChain(chain);
    setShowMobileChainList(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      close={onClose}
      panelClassname="p-0 max-w-sm md:max-w-[800px] overflow-hidden"
    >
      <ModalHeader>Select Token</ModalHeader>
      <div className="flex h-[80vh] gap-4 p-4 md:h-[582px]">
        {/* Chain filter panel: always visible on desktop, conditionally visible on mobile */}
        <div className={`${showMobileChainList ? 'flex flex-1' : 'hidden'} md:flex md:flex-none`}>
          <ChainFilterPanel
            searchQuery={chainSearch}
            onSearchChange={setChainSearch}
            selectedChain={selectedChain?.name ?? null}
            onSelectChain={handleSelectChainMobile}
            showBackButton={showMobileChainList}
            onBack={() => setShowMobileChainList(false)}
          />
        </div>

        {/* Token list panel: hidden on mobile when showing chain list */}
        <div className={`min-w-0 flex-1 ${showMobileChainList ? 'hidden md:flex' : 'flex'}`}>
          <TokenListPanel
            selectionMode={selectionMode}
            searchQuery={tokenSearch}
            onSearchChange={setTokenSearch}
            chainFilter={selectedChain?.name ?? null}
            onSelect={handleSelectToken}
            counterpartToken={counterpartToken}
            selectedChain={selectedChain?.name ?? null}
            onSelectChain={handleSelectChain}
            onMoreChainsClick={() => setShowMobileChainList(true)}
          />
        </div>
      </div>
    </Modal>
  );
}
