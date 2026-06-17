import type { ChainName } from '@hyperlane-xyz/sdk';
import { Modal } from '@hyperlane-xyz/widgets';
import { useCallback, useMemo, useState } from 'react';

import { ModalHeader } from '../../../components/layout/ModalHeader';
import { ChainFilterPanel } from '../../chains/ChainFilterPanel';
import type { ChainInfo } from '../../chains/hooks';
import { useMultiProvider } from '../../chains/hooks';
import { TokenListPanel } from './TokenListPanel';
import type { UnifiedToken } from './types';

interface Props {
  isOpen: boolean;
  close: () => void;
  onSelect: (token: UnifiedToken) => void;
  selectionMode: 'origin' | 'destination';
  counterpartToken?: UnifiedToken;
  recipient?: string;
  engineEnabled: boolean;
}

export function UnifiedTokenChainModal({
  isOpen,
  close,
  onSelect,
  selectionMode,
  counterpartToken,
  recipient,
  engineEnabled,
}: Props) {
  const multiProvider = useMultiProvider();
  const [chainSearch, setChainSearch] = useState('');
  const [tokenSearch, setTokenSearch] = useState('');
  const [selectedChain, setSelectedChain] = useState<ChainInfo | null>(null);
  const [showMobileChainList, setShowMobileChainList] = useState(false);

  const selectedChainId = useMemo(() => {
    if (!selectedChain) return undefined;
    return multiProvider.tryGetChainMetadata(selectedChain.name)?.chainId as number | undefined;
  }, [multiProvider, selectedChain]);

  const onClose = useCallback(() => {
    close();
    setChainSearch('');
    setTokenSearch('');
    setSelectedChain(null);
    setShowMobileChainList(false);
  }, [close]);

  const handleSelectToken = useCallback(
    (token: UnifiedToken) => {
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
          />
        </div>

        <div className={`min-w-0 flex-1 ${showMobileChainList ? 'hidden md:flex' : 'flex'}`}>
          <TokenListPanel
            selectionMode={selectionMode}
            searchQuery={tokenSearch}
            onSearchChange={setTokenSearch}
            chainFilter={(selectedChain?.name as ChainName | undefined) ?? null}
            chainIdFilter={selectedChainId}
            onSelect={handleSelectToken}
            counterpartToken={counterpartToken}
            recipient={recipient}
            selectedChain={selectedChain?.name ?? null}
            onSelectChain={handleSelectChain}
            onMoreChainsClick={() => setShowMobileChainList(true)}
            engineEnabled={engineEnabled}
          />
        </div>
      </div>
    </Modal>
  );
}
