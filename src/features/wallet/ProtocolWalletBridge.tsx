import type { MultiProviderAdapter as MultiProtocolProvider } from '@hyperlane-xyz/sdk/providers/MultiProviderAdapter';
import type { ChainName } from '@hyperlane-xyz/sdk/types';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { getAddressFromAccountAndChain } from '@hyperlane-xyz/widgets/walletIntegrations/accountUtils';
import { useAleoAccount, useAleoConnectFn, useAleoDisconnectFn, useAleoWalletDetails } from '@hyperlane-xyz/widgets/walletIntegrations/aleoWallet';
import {
  useCosmosAccount,
  useCosmosConnectFn,
  useCosmosDisconnectFn,
  useCosmosWalletDetails,
} from '@hyperlane-xyz/widgets/walletIntegrations/cosmosWallet';
import {
  useEthereumAccount,
  useEthereumConnectFn,
  useEthereumDisconnectFn,
  useEthereumWalletDetails,
} from '@hyperlane-xyz/widgets/walletIntegrations/ethereumWallet';
import {
  useRadixAccount,
  useRadixConnectFn,
  useRadixDisconnectFn,
  useRadixWalletDetails,
} from '@hyperlane-xyz/widgets/walletIntegrations/radixWallet';
import {
  useSolanaAccount,
  useSolanaConnectFn,
  useSolanaDisconnectFn,
  useSolanaWalletDetails,
} from '@hyperlane-xyz/widgets/walletIntegrations/solanaWallet';
import {
  useStarknetAccount,
  useStarknetConnectFn,
  useStarknetDisconnectFn,
  useStarknetWalletDetails,
} from '@hyperlane-xyz/widgets/walletIntegrations/starknetWallet';
import {
  useTronAccount,
  useTronConnectFn,
  useTronDisconnectFn,
  useTronWalletDetails,
} from '@hyperlane-xyz/widgets/walletIntegrations/tronWallet';
import type {
  AccountInfo,
  WalletDetails,
} from '@hyperlane-xyz/widgets/walletIntegrations/types';
import type { ReactNode } from 'react';

type ProtocolWalletState = {
  account?: AccountInfo;
  address?: string;
  connectFn?: () => void;
  disconnectFn?: () => Promise<void>;
  walletDetails?: WalletDetails;
};

type ProtocolAccountBridgeProps = {
  protocol?: ProtocolType | null;
  multiProvider: MultiProtocolProvider;
  chainName?: ChainName;
  children: (state: Pick<ProtocolWalletState, 'account' | 'address'>) => ReactNode;
};

type ProtocolWalletBridgeProps = {
  protocol?: ProtocolType | null;
  multiProvider: MultiProtocolProvider;
  chainName?: ChainName;
  children: (state: ProtocolWalletState) => ReactNode;
};

export function ProtocolAccountBridge({
  protocol,
  multiProvider,
  chainName,
  children,
}: ProtocolAccountBridgeProps) {
  switch (protocol) {
    case ProtocolType.Ethereum:
      return (
        <EthereumAccountBridge multiProvider={multiProvider} chainName={chainName}>
          {children}
        </EthereumAccountBridge>
      );
    case ProtocolType.Sealevel:
      return (
        <SolanaAccountBridge multiProvider={multiProvider} chainName={chainName}>
          {children}
        </SolanaAccountBridge>
      );
    case ProtocolType.Cosmos:
    case ProtocolType.CosmosNative:
      return (
        <CosmosAccountBridge multiProvider={multiProvider} chainName={chainName}>
          {children}
        </CosmosAccountBridge>
      );
    case ProtocolType.Starknet:
      return (
        <StarknetAccountBridge multiProvider={multiProvider} chainName={chainName}>
          {children}
        </StarknetAccountBridge>
      );
    case ProtocolType.Radix:
      return (
        <RadixAccountBridge multiProvider={multiProvider} chainName={chainName}>
          {children}
        </RadixAccountBridge>
      );
    case ProtocolType.Aleo:
      return (
        <AleoAccountBridge multiProvider={multiProvider} chainName={chainName}>
          {children}
        </AleoAccountBridge>
      );
    case ProtocolType.Tron:
      return (
        <TronAccountBridge multiProvider={multiProvider} chainName={chainName}>
          {children}
        </TronAccountBridge>
      );
    default:
      return children({});
  }
}

export function ProtocolWalletBridge({
  protocol,
  multiProvider,
  chainName,
  children,
}: ProtocolWalletBridgeProps) {
  switch (protocol) {
    case ProtocolType.Ethereum:
      return (
        <EthereumWalletBridge multiProvider={multiProvider} chainName={chainName}>
          {children}
        </EthereumWalletBridge>
      );
    case ProtocolType.Sealevel:
      return (
        <SolanaWalletBridge multiProvider={multiProvider} chainName={chainName}>
          {children}
        </SolanaWalletBridge>
      );
    case ProtocolType.Cosmos:
    case ProtocolType.CosmosNative:
      return (
        <CosmosWalletBridge multiProvider={multiProvider} chainName={chainName}>
          {children}
        </CosmosWalletBridge>
      );
    case ProtocolType.Starknet:
      return (
        <StarknetWalletBridge multiProvider={multiProvider} chainName={chainName}>
          {children}
        </StarknetWalletBridge>
      );
    case ProtocolType.Radix:
      return (
        <RadixWalletBridge multiProvider={multiProvider} chainName={chainName}>
          {children}
        </RadixWalletBridge>
      );
    case ProtocolType.Aleo:
      return (
        <AleoWalletBridge multiProvider={multiProvider} chainName={chainName}>
          {children}
        </AleoWalletBridge>
      );
    case ProtocolType.Tron:
      return (
        <TronWalletBridge multiProvider={multiProvider} chainName={chainName}>
          {children}
        </TronWalletBridge>
      );
    default:
      return children({});
  }
}

type BridgeProps = {
  multiProvider: MultiProtocolProvider;
  chainName?: ChainName;
  children: (state: ProtocolWalletState) => ReactNode;
};

type AccountBridgeProps = {
  multiProvider: MultiProtocolProvider;
  chainName?: ChainName;
  children: (state: Pick<ProtocolWalletState, 'account' | 'address'>) => ReactNode;
};

function EthereumAccountBridge({ multiProvider, chainName, children }: AccountBridgeProps) {
  const account = useEthereumAccount(multiProvider);
  return children({ account, address: getAddressFromAccountAndChain(account, chainName) });
}

function EthereumWalletBridge({ multiProvider, chainName, children }: BridgeProps) {
  const account = useEthereumAccount(multiProvider);
  const connectFn = useEthereumConnectFn();
  const disconnectFn = useEthereumDisconnectFn();
  const walletDetails = useEthereumWalletDetails();
  return children({
    account,
    address: getAddressFromAccountAndChain(account, chainName),
    connectFn,
    disconnectFn,
    walletDetails,
  });
}

function SolanaAccountBridge({ multiProvider, chainName, children }: AccountBridgeProps) {
  const account = useSolanaAccount(multiProvider);
  return children({ account, address: getAddressFromAccountAndChain(account, chainName) });
}

function SolanaWalletBridge({ multiProvider, chainName, children }: BridgeProps) {
  const account = useSolanaAccount(multiProvider);
  const connectFn = useSolanaConnectFn();
  const disconnectFn = useSolanaDisconnectFn();
  const walletDetails = useSolanaWalletDetails();
  return children({
    account,
    address: getAddressFromAccountAndChain(account, chainName),
    connectFn,
    disconnectFn,
    walletDetails,
  });
}

function CosmosAccountBridge({ multiProvider, chainName, children }: AccountBridgeProps) {
  const account = useCosmosAccount(multiProvider);
  return children({ account, address: getAddressFromAccountAndChain(account, chainName) });
}

function CosmosWalletBridge({ multiProvider, chainName, children }: BridgeProps) {
  const account = useCosmosAccount(multiProvider);
  const connectFn = useCosmosConnectFn();
  const disconnectFn = useCosmosDisconnectFn();
  const walletDetails = useCosmosWalletDetails();
  return children({
    account,
    address: getAddressFromAccountAndChain(account, chainName),
    connectFn,
    disconnectFn,
    walletDetails,
  });
}

function StarknetAccountBridge({ multiProvider, chainName, children }: AccountBridgeProps) {
  const account = useStarknetAccount(multiProvider);
  return children({ account, address: getAddressFromAccountAndChain(account, chainName) });
}

function StarknetWalletBridge({ multiProvider, chainName, children }: BridgeProps) {
  const account = useStarknetAccount(multiProvider);
  const connectFn = useStarknetConnectFn();
  const disconnectFn = useStarknetDisconnectFn();
  const walletDetails = useStarknetWalletDetails();
  return children({
    account,
    address: getAddressFromAccountAndChain(account, chainName),
    connectFn,
    disconnectFn,
    walletDetails,
  });
}

function RadixAccountBridge({ multiProvider, chainName, children }: AccountBridgeProps) {
  const account = useRadixAccount(multiProvider);
  return children({ account, address: getAddressFromAccountAndChain(account, chainName) });
}

function RadixWalletBridge({ multiProvider, chainName, children }: BridgeProps) {
  const account = useRadixAccount(multiProvider);
  const connectFn = useRadixConnectFn();
  const disconnectFn = useRadixDisconnectFn();
  const walletDetails = useRadixWalletDetails();
  return children({
    account,
    address: getAddressFromAccountAndChain(account, chainName),
    connectFn,
    disconnectFn,
    walletDetails,
  });
}

function AleoAccountBridge({ multiProvider, chainName, children }: AccountBridgeProps) {
  const account = useAleoAccount(multiProvider);
  return children({ account, address: getAddressFromAccountAndChain(account, chainName) });
}

function AleoWalletBridge({ multiProvider, chainName, children }: BridgeProps) {
  const account = useAleoAccount(multiProvider);
  const connectFn = useAleoConnectFn();
  const disconnectFn = useAleoDisconnectFn();
  const walletDetails = useAleoWalletDetails();
  return children({
    account,
    address: getAddressFromAccountAndChain(account, chainName),
    connectFn,
    disconnectFn,
    walletDetails,
  });
}

function TronAccountBridge({ multiProvider, chainName, children }: AccountBridgeProps) {
  const account = useTronAccount(multiProvider);
  return children({ account, address: getAddressFromAccountAndChain(account, chainName) });
}

function TronWalletBridge({ multiProvider, chainName, children }: BridgeProps) {
  const account = useTronAccount(multiProvider);
  const connectFn = useTronConnectFn();
  const disconnectFn = useTronDisconnectFn();
  const walletDetails = useTronWalletDetails();
  return children({
    account,
    address: getAddressFromAccountAndChain(account, chainName),
    connectFn,
    disconnectFn,
    walletDetails,
  });
}
