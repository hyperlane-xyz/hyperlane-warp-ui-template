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
  // Mobile-only state: whether to show the full chain list
  const [showMobileChainList, setShowMobileChainList] = useState(false);

  const onClose = () => {
    close();
    setChainSearch('');
    setTokenSearch('');
    setSelectedChain(null);
    setShowMobileChainList(false);
  };

  const onSelectAndClose = (token: Token) => {
    onSelect(token);
    onClose();
  };

  // Mobile: when selecting a chain from the full list, go back to tokens
  const onMobileSelectChain = (chain: ChainName | null) => {
    setSelectedChain(chain);
    setShowMobileChainList(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      close={onClose}
      panelClassname="p-0 max-w-sm md:max-w-[800px] overflow-hidden"
    >
      {/* Purple gradient header */}
      <div className="flex items-center gap-2 bg-accent-gradient px-4 py-1">
        <div className="h-2 w-2 rounded-full bg-white" />
        <span className="font-secondary text-xs text-white">Select Token</span>
      </div>
      <div className="flex max-h-[80vh] min-h-[24rem] gap-4 p-4 sm:max-h-[582px]">
        {/* Chain filter panel: always visible on desktop, conditionally visible on mobile */}
        <div className={`${showMobileChainList ? 'flex flex-1' : 'hidden'} md:flex md:flex-none`}>
          <ChainFilterPanel
            searchQuery={chainSearch}
            onSearchChange={setChainSearch}
            selectedChain={selectedChain}
            onSelectChain={onMobileSelectChain}
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
            chainFilter={selectedChain}
            onSelect={onSelectAndClose}
            counterpartToken={counterpartToken}
            selectedChain={selectedChain}
            onSelectChain={setSelectedChain}
            onMoreChainsClick={() => setShowMobileChainList(true)}
          />
        </div>
      </div>
    </Modal>
  );
}
