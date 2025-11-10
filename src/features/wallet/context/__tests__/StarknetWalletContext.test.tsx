import * as widgetsModule from '@hyperlane-xyz/widgets';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as chainsHooks from '../../../chains/hooks';
import { StarknetWalletContext } from './../StarknetWalletContext';

// Mock dependencies
vi.mock('@hyperlane-xyz/registry', () => ({
  starknetsepolia: {
    id: 'starknetsepolia',
    name: 'Starknet Sepolia',
    chainId: 123,
  },
}));

vi.mock('@hyperlane-xyz/sdk', () => ({
  chainMetadataToStarknetChain: vi.fn((metadata) => ({
    id: BigInt(metadata.chainId || 123),
    name: metadata.name,
    network: 'sepolia',
    testnet: true,
  })),
}));

vi.mock('@hyperlane-xyz/widgets', () => ({
  getStarknetChains: vi.fn(() => []),
}));

vi.mock('../../../chains/hooks', () => ({
  useMultiProvider: vi.fn(() => ({
    getChains: vi.fn(() => []),
  })),
}));

vi.mock('@starknet-react/core', () => ({
  StarknetConfig: ({ children, chains, connectors, _provider, _explorer, autoConnect }: any) => (
    <div data-testid="starknet-config">
      <div data-testid="chains-count">{chains?.length || 0}</div>
      <div data-testid="connectors-count">{connectors?.length || 0}</div>
      <div data-testid="auto-connect">{String(autoConnect)}</div>
      {children}
    </div>
  ),
  publicProvider: vi.fn(() => 'mock-public-provider'),
  voyager: 'mock-voyager-explorer',
}));

vi.mock('starknetkit/injected', () => ({
  InjectedConnector: vi.fn((config) => ({
    id: config.options.id,
    name: config.options.name,
    icon: config.options.icon,
  })),
}));

describe('StarknetWalletContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render children', () => {
    render(
      <StarknetWalletContext>
        <div data-testid="test-child">Test Child</div>
      </StarknetWalletContext>,
    );

    expect(screen.getByTestId('test-child')).toBeInTheDocument();
  });

  it('should render StarknetConfig wrapper', () => {
    render(
      <StarknetWalletContext>
        <div>Test</div>
      </StarknetWalletContext>,
    );

    expect(screen.getByTestId('starknet-config')).toBeInTheDocument();
  });

  it('should enable autoConnect', () => {
    render(
      <StarknetWalletContext>
        <div>Test</div>
      </StarknetWalletContext>,
    );

    expect(screen.getByTestId('auto-connect')).toHaveTextContent('true');
  });

  it('should initialize with 5 connectors', () => {
    render(
      <StarknetWalletContext>
        <div>Test</div>
      </StarknetWalletContext>,
    );

    expect(screen.getByTestId('connectors-count')).toHaveTextContent('5');
  });

  it('should include initial chain when no chains from registry', () => {
    vi.mocked(widgetsModule.getStarknetChains).mockReturnValue([]);

    render(
      <StarknetWalletContext>
        <div>Test</div>
      </StarknetWalletContext>,
    );

    expect(screen.getByTestId('chains-count')).toHaveTextContent('1');
  });

  it('should call useMultiProvider hook', () => {
    const mockMultiProvider = { getChains: vi.fn() };
    vi.mocked(chainsHooks.useMultiProvider).mockReturnValue(mockMultiProvider as any);

    render(
      <StarknetWalletContext>
        <div>Test</div>
      </StarknetWalletContext>,
    );

    expect(chainsHooks.useMultiProvider).toHaveBeenCalledTimes(1);
  });

  it('should call getStarknetChains with multiProvider', () => {
    const mockMultiProvider = { getChains: vi.fn() };
    vi.mocked(chainsHooks.useMultiProvider).mockReturnValue(mockMultiProvider as any);

    render(
      <StarknetWalletContext>
        <div>Test</div>
      </StarknetWalletContext>,
    );

    expect(widgetsModule.getStarknetChains).toHaveBeenCalledWith(mockMultiProvider);
  });
});
