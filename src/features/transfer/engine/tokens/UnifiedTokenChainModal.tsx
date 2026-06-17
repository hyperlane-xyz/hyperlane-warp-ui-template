import { Modal } from '@hyperlane-xyz/widgets';
import { useCallback, useState } from 'react';

import { ModalHeader } from '../../../../components/layout/ModalHeader';
import { ChainFilterPanel } from '../../../chains/ChainFilterPanel';
import type { ChainInfo } from '../../../chains/hooks';
import { useSwapChainInfos } from '../chains/hooks';
import { TokenListPanel } from './TokenListPanel';
import type { TokenSelectionMode, UiToken } from './types';

interface Props {
  isOpen: boolean;
  close: () => void;
  onSelect: (token: UiToken) => void;
  selectionMode: TokenSelectionMode;
  /** Counterpart side's currently selected token, used for route hinting. */
  counterpartToken?: UiToken;
  /** Recipient address for destination balance lookups */
  recipient?: string;
  /** Reserved for future ChainEditModal hook-up. */
  onEditChain?: (chainName: string) => void;
}

export function UnifiedTokenChainModal({
  isOpen,
  close,
  onSelect,
  selectionMode,
  counterpartToken,
  recipient,
  onEditChain,
}: Props) {
  const [chainSearch, setChainSearch] = useState('');
  const [tokenSearch, setTokenSearch] = useState('');
  const [selectedChain, setSelectedChain] = useState<ChainInfo | null>(null);
  const [showMobileChainList, setShowMobileChainList] = useState(false);
  const swapChainInfos = useSwapChainInfos();

  const onClose = useCallback(() => {
    close();
    setChainSearch('');
    setTokenSearch('');
    setSelectedChain(null);
    setShowMobileChainList(false);
  }, [close]);

  const handleSelectToken = useCallback(
    (token: UiToken) => {
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

  const handleEditChain = (chainName: string) => {
    close();
    onEditChain?.(chainName);
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
            onEditChain={handleEditChain}
            showBackButton={showMobileChainList}
            onBack={() => setShowMobileChainList(false)}
            chainInfos={swapChainInfos}
          />
        </div>

        <div className={`min-w-0 flex-1 ${showMobileChainList ? 'hidden md:flex' : 'flex'}`}>
          <TokenListPanel
            selectionMode={selectionMode}
            searchQuery={tokenSearch}
            onSearchChange={setTokenSearch}
            chainFilter={selectedChain?.name ?? null}
            onSelect={handleSelectToken}
            counterpartToken={counterpartToken}
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
