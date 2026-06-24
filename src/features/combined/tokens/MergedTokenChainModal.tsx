import { Modal } from '@hyperlane-xyz/widgets';
import { useCallback, useState } from 'react';

import { ModalHeader } from '../../../components/layout/ModalHeader';
import { ChainFilterPanel } from '../../chains/ChainFilterPanel';
import type { ChainInfo } from '../../chains/hooks';
import type { TokenSelectionMode } from '../../swap/tokens/types';
import type { CombinedToken } from '../types';
import { useMergedChainInfos } from '../hooks';
import { MergedTokenListPanel } from './MergedTokenListPanel';

interface Props {
  isOpen: boolean;
  close: () => void;
  onSelect: (token: CombinedToken) => void;
  selectionMode: TokenSelectionMode;
  counterpartToken?: CombinedToken;
  // WarpCore destination tokens injected for the destination picker.
  extraTokens?: CombinedToken[];
  recipient?: string;
}

export function MergedTokenChainModal({
  isOpen,
  close,
  onSelect,
  selectionMode,
  counterpartToken,
  extraTokens,
  recipient,
}: Props) {
  const [chainSearch, setChainSearch] = useState('');
  const [tokenSearch, setTokenSearch] = useState('');
  const [selectedChain, setSelectedChain] = useState<ChainInfo | null>(null);
  const [showMobileChainList, setShowMobileChainList] = useState(false);
  const swapChainInfos = useMergedChainInfos();

  const onClose = useCallback(() => {
    close();
    setChainSearch('');
    setTokenSearch('');
    setSelectedChain(null);
    setShowMobileChainList(false);
  }, [close]);

  const handleSelectToken = useCallback(
    (token: CombinedToken) => {
      onSelect(token);
      onClose();
    },
    [onSelect, onClose],
  );

  const handleSelectChain = (chain: ChainInfo | null) => {
    if (selectedChain?.name === chain?.name) return;
    setSelectedChain(chain);
  };

  const handleSelectChainMobile = (chain: ChainInfo | null) => {
    handleSelectChain(chain);
    setShowMobileChainList(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      close={onClose}
      panelClassname="token-picker-modal p-0 max-w-sm md:max-w-[800px] overflow-hidden"
    >
      <ModalHeader>Select Token</ModalHeader>
      <div className="flex h-[80vh] gap-4 p-4 md:h-[582px]">
        <div className={`${showMobileChainList ? 'flex flex-1' : 'hidden'} md:flex md:flex-none`}>
          <ChainFilterPanel
            searchQuery={chainSearch}
            onSearchChange={setChainSearch}
            selectedChain={selectedChain?.name ?? null}
            onSelectChain={handleSelectChainMobile}
            showBackButton={showMobileChainList}
            onBack={() => setShowMobileChainList(false)}
            chainInfos={swapChainInfos}
          />
        </div>
        <div className={`min-w-0 flex-1 ${showMobileChainList ? 'hidden md:flex' : 'flex'}`}>
          <MergedTokenListPanel
            selectionMode={selectionMode}
            searchQuery={tokenSearch}
            onSearchChange={setTokenSearch}
            chainFilter={selectedChain?.name ?? null}
            onSelect={handleSelectToken}
            counterpartToken={counterpartToken}
            extraTokens={extraTokens}
            recipient={recipient}
            selectedChain={selectedChain?.name ?? null}
            onSelectChain={handleSelectChain}
            onMoreChainsClick={() => setShowMobileChainList(true)}
          />
        </div>
      </div>
    </Modal>
  );
}
