import { type PropsWithChildren, useMemo } from 'react';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { useStore } from '../store';
import { AleoWalletContext } from './context/AleoWalletContext';
import { CosmosWalletContext } from './context/CosmosWalletContext';
import { EvmWalletContext } from './context/EvmWalletContext';
import { RadixWalletContext } from './context/RadixWalletContext';
import { SolanaWalletContext } from './context/SolanaWalletContext';
import { StarknetWalletContext } from './context/StarknetWalletContext';
import { TronWalletContext } from './context/TronWalletContext';

const ALL_PROTOCOLS = new Set<ProtocolType>([
  ProtocolType.Ethereum,
  ProtocolType.Sealevel,
  ProtocolType.Cosmos,
  ProtocolType.Starknet,
  ProtocolType.Radix,
  ProtocolType.Aleo,
  ProtocolType.Tron,
]);

export function WalletProviders({ children }: PropsWithChildren<unknown>) {
  const {
    chainMetadata,
    destinationChainName,
    isSideBarOpen,
    originChainName,
    showEnvSelectModal,
    showTokenSelectionModal,
  } = useStore((s) => ({
    chainMetadata: s.chainMetadata,
    destinationChainName: s.destinationChainName,
    isSideBarOpen: s.isSideBarOpen,
    originChainName: s.originChainName,
    showEnvSelectModal: s.showEnvSelectModal,
    showTokenSelectionModal: s.showTokenSelectionModal,
  }));

  const enabledProtocols = useMemo(() => {
    if (showEnvSelectModal || isSideBarOpen || showTokenSelectionModal) return ALL_PROTOCOLS;

    const selectedProtocols = new Set<ProtocolType>();
    if (originChainName) {
      const protocol = chainMetadata[originChainName]?.protocol;
      if (protocol) selectedProtocols.add(protocol);
    }
    if (destinationChainName) {
      const protocol = chainMetadata[destinationChainName]?.protocol;
      if (protocol) selectedProtocols.add(protocol);
    }

    return selectedProtocols.size ? selectedProtocols : ALL_PROTOCOLS;
  }, [
    chainMetadata,
    destinationChainName,
    isSideBarOpen,
    originChainName,
    showEnvSelectModal,
    showTokenSelectionModal,
  ]);

  return (
    <EvmWalletContext>
      <SolanaWalletContext enabled={enabledProtocols.has(ProtocolType.Sealevel)}>
        <CosmosWalletContext
          enabled={
            enabledProtocols.has(ProtocolType.Cosmos) ||
            enabledProtocols.has(ProtocolType.CosmosNative)
          }
        >
          <StarknetWalletContext enabled={enabledProtocols.has(ProtocolType.Starknet)}>
            <RadixWalletContext enabled={enabledProtocols.has(ProtocolType.Radix)}>
              <AleoWalletContext enabled={enabledProtocols.has(ProtocolType.Aleo)}>
                <TronWalletContext enabled={enabledProtocols.has(ProtocolType.Tron)}>
                  {children}
                </TronWalletContext>
              </AleoWalletContext>
            </RadixWalletContext>
          </StarknetWalletContext>
        </CosmosWalletContext>
      </SolanaWalletContext>
    </EvmWalletContext>
  );
}
