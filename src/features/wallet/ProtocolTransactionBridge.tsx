import type { ConfiguredMultiProtocolProvider as MultiProtocolProvider } from '@hyperlane-xyz/sdk/providers/ConfiguredMultiProtocolProvider';
import type { ChainName } from '@hyperlane-xyz/sdk/types';
import { ProtocolType } from '@hyperlane-xyz/utils';
import {
  useAleoActiveChain,
  useAleoTransactionFns,
} from '@hyperlane-xyz/widgets/walletIntegrations/aleo';
import {
  useCosmosActiveChain,
  useCosmosTransactionFns,
} from '@hyperlane-xyz/widgets/walletIntegrations/cosmos';
import {
  useEthereumActiveChain,
  useEthereumTransactionFns,
} from '@hyperlane-xyz/widgets/walletIntegrations/ethereum';
import {
  useRadixActiveChain,
  useRadixTransactionFns,
} from '@hyperlane-xyz/widgets/walletIntegrations/radix';
import {
  useSolanaActiveChain,
  useSolanaTransactionFns,
} from '@hyperlane-xyz/widgets/walletIntegrations/solana';
import {
  useStarknetActiveChain,
  useStarknetTransactionFns,
} from '@hyperlane-xyz/widgets/walletIntegrations/starknet';
import {
  useTronActiveChain,
  useTronTransactionFns,
} from '@hyperlane-xyz/widgets/walletIntegrations/tron';
import type {
  ActiveChainInfo,
  ChainTransactionFns,
} from '@hyperlane-xyz/widgets/walletIntegrations/types';
import type { ReactNode } from 'react';

type ProtocolTransactionBridgeProps = {
  protocol?: ProtocolType | null;
  multiProvider: MultiProtocolProvider;
  chainName?: ChainName;
  children: (state: {
    activeChain?: ActiveChainInfo;
    transactionFns?: ChainTransactionFns;
  }) => ReactNode;
};

export function ProtocolTransactionBridge({
  protocol,
  multiProvider,
  chainName,
  children,
}: ProtocolTransactionBridgeProps) {
  switch (protocol) {
    case ProtocolType.Ethereum:
      return (
        <EthereumTransactionBridge multiProvider={multiProvider} chainName={chainName}>
          {children}
        </EthereumTransactionBridge>
      );
    case ProtocolType.Sealevel:
      return (
        <SolanaTransactionBridge multiProvider={multiProvider} chainName={chainName}>
          {children}
        </SolanaTransactionBridge>
      );
    case ProtocolType.Cosmos:
    case ProtocolType.CosmosNative:
      return (
        <CosmosTransactionBridge multiProvider={multiProvider} chainName={chainName}>
          {children}
        </CosmosTransactionBridge>
      );
    case ProtocolType.Starknet:
      return (
        <StarknetTransactionBridge multiProvider={multiProvider} chainName={chainName}>
          {children}
        </StarknetTransactionBridge>
      );
    case ProtocolType.Radix:
      return (
        <RadixTransactionBridge multiProvider={multiProvider} chainName={chainName}>
          {children}
        </RadixTransactionBridge>
      );
    case ProtocolType.Aleo:
      return (
        <AleoTransactionBridge multiProvider={multiProvider} chainName={chainName}>
          {children}
        </AleoTransactionBridge>
      );
    case ProtocolType.Tron:
      return (
        <TronTransactionBridge multiProvider={multiProvider} chainName={chainName}>
          {children}
        </TronTransactionBridge>
      );
    default:
      return children({});
  }
}

type BridgeProps = {
  multiProvider: MultiProtocolProvider;
  chainName?: ChainName;
  children: (state: {
    activeChain?: ActiveChainInfo;
    transactionFns?: ChainTransactionFns;
  }) => ReactNode;
};

function EthereumTransactionBridge({ multiProvider, children }: BridgeProps) {
  return children({
    activeChain: useEthereumActiveChain(multiProvider),
    transactionFns: useEthereumTransactionFns(multiProvider),
  });
}

function SolanaTransactionBridge({ multiProvider, children }: BridgeProps) {
  return children({
    activeChain: useSolanaActiveChain(multiProvider),
    transactionFns: useSolanaTransactionFns(multiProvider),
  });
}

function CosmosTransactionBridge({ multiProvider, children }: BridgeProps) {
  return children({
    activeChain: useCosmosActiveChain(multiProvider),
    transactionFns: useCosmosTransactionFns(multiProvider),
  });
}

function StarknetTransactionBridge({ multiProvider, children }: BridgeProps) {
  return children({
    activeChain: useStarknetActiveChain(multiProvider),
    transactionFns: useStarknetTransactionFns(multiProvider),
  });
}

function RadixTransactionBridge({ multiProvider, children }: BridgeProps) {
  return children({
    activeChain: useRadixActiveChain(multiProvider),
    transactionFns: useRadixTransactionFns(multiProvider),
  });
}

function AleoTransactionBridge({ multiProvider, children }: BridgeProps) {
  return children({
    activeChain: useAleoActiveChain(multiProvider),
    transactionFns: useAleoTransactionFns(multiProvider),
  });
}

function TronTransactionBridge({ multiProvider, children }: BridgeProps) {
  return children({
    activeChain: useTronActiveChain(multiProvider),
    transactionFns: useTronTransactionFns(multiProvider),
  });
}
