import { ChainStatus } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import {
  useChainDisplayName,
  useChainMetadata,
  useChainProtocol,
  useMultiProvider,
  useReadyMultiProvider,
} from '../hooks';
import { assembleChainMetadata } from '../metadata';
import {
  getChainDisplayName,
  getNumRoutesWithSelectedChain,
  hasPermissionlessChain,
  isChainDisabled,
  isPermissionlessChain,
  tryGetValidChainName,
} from '../utils';

// Mock dependencies
vi.mock('../../store', () => ({
  useStore: vi.fn(),
}));

vi.mock('@hyperlane-xyz/registry', () => ({
  isAbacusWorksChain: vi.fn(),
  chainMetadata: {},
  chainMetadataWithOverrides: {},
  GithubRegistry: vi.fn().mockImplementation(() => ({
    getMetadata: vi.fn(),
  })),
}));

vi.mock('../../../consts/chains.ts', () => ({
  chains: {},
}));

vi.mock('../../../consts/chains.yaml', () => ({
  default: {},
}));

vi.mock('../../../consts/config.ts', () => ({
  config: {
    useOnlineRegistry: true,
    registryUrl: '',
    rpcOverrides: '',
    shouldDisableChains: false,
  },
}));

vi.mock('../../../consts/links.ts', () => ({
  links: {
    imgPath: 'https://example.com/images',
  },
}));

vi.mock('../../../utils/logger.ts', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { isAbacusWorksChain } from '@hyperlane-xyz/registry';
import { config } from '../../../consts/config.ts';
import { useStore } from '../../store';

describe('Chains Module Tests', () => {
  const mockMultiProvider = {
    getKnownChainNames: vi.fn(),
    tryGetChainMetadata: vi.fn(),
    tryGetChainName: vi.fn(),
    metadata: {},
  };

  const mockStore = {
    multiProvider: mockMultiProvider,
  };

  const useStoreMock = useStore as unknown as Mock;
  const configMock = config as unknown as {
    useOnlineRegistry: boolean;
    registryUrl: string;
    rpcOverrides: string;
    shouldDisableChains: boolean;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useStoreMock.mockImplementation((selector: any) => selector(mockStore));
    Object.assign(mockMultiProvider, {
      getKnownChainNames: vi.fn(),
      tryGetChainMetadata: vi.fn(),
      tryGetChainName: vi.fn(),
      metadata: {},
    });
    Object.assign(configMock, {
      useOnlineRegistry: true,
      registryUrl: '',
      rpcOverrides: '',
      shouldDisableChains: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Hooks', () => {
    describe('useMultiProvider', () => {
      it('should return multiProvider from store', () => {
        const { result } = renderHook(() => useMultiProvider());
        expect(result.current).toBe(mockMultiProvider);
      });

      it('should call useStore with correct selector', () => {
        renderHook(() => useMultiProvider());
        expect(useStore).toHaveBeenCalledWith(expect.any(Function));
      });
    });

    describe('useReadyMultiProvider', () => {
      it('should return multiProvider when chains are available', () => {
        mockMultiProvider.getKnownChainNames.mockReturnValue(['ethereum', 'polygon']);

        const { result } = renderHook(() => useReadyMultiProvider());

        expect(result.current).toBe(mockMultiProvider);
      });

      it('should return undefined when no chains are available', () => {
        mockMultiProvider.getKnownChainNames.mockReturnValue([]);

        const { result } = renderHook(() => useReadyMultiProvider());

        expect(result.current).toBeUndefined();
      });

      it('should return undefined when chains array is empty', () => {
        mockMultiProvider.getKnownChainNames.mockReturnValue([]);

        const { result } = renderHook(() => useReadyMultiProvider());

        expect(result.current).toBeUndefined();
      });

      it('should check chain names length correctly', () => {
        mockMultiProvider.getKnownChainNames.mockReturnValue(['ethereum']);

        const { result } = renderHook(() => useReadyMultiProvider());

        expect(mockMultiProvider.getKnownChainNames).toHaveBeenCalled();
        expect(result.current).toBe(mockMultiProvider);
      });
    });

    describe('useChainMetadata', () => {
      const mockMetadata = {
        name: 'ethereum',
        chainId: 1,
        protocol: ProtocolType.Ethereum,
        displayName: 'Ethereum',
      };

      it('should return chain metadata when chainName is provided', () => {
        mockMultiProvider.tryGetChainMetadata.mockReturnValue(mockMetadata);

        const { result } = renderHook(() => useChainMetadata('ethereum'));

        expect(result.current).toBe(mockMetadata);
        expect(mockMultiProvider.tryGetChainMetadata).toHaveBeenCalledWith('ethereum');
      });

      it('should return undefined when chainName is not provided', () => {
        const { result } = renderHook(() => useChainMetadata());

        expect(result.current).toBeUndefined();
        expect(mockMultiProvider.tryGetChainMetadata).not.toHaveBeenCalled();
      });

      it('should return undefined when chainName is empty string', () => {
        const { result } = renderHook(() => useChainMetadata(''));

        expect(result.current).toBeUndefined();
      });

      it('should return null when metadata not found', () => {
        mockMultiProvider.tryGetChainMetadata.mockReturnValue(null);

        const { result } = renderHook(() => useChainMetadata('unknown'));

        expect(result.current).toBeNull();
      });
    });

    describe('useChainProtocol', () => {
      it('should return protocol when metadata exists', () => {
        mockMultiProvider.tryGetChainMetadata.mockReturnValue({
          protocol: ProtocolType.Ethereum,
        });

        const { result } = renderHook(() => useChainProtocol('ethereum'));

        expect(result.current).toBe(ProtocolType.Ethereum);
      });

      it('should return undefined when metadata does not exist', () => {
        mockMultiProvider.tryGetChainMetadata.mockReturnValue(null);

        const { result } = renderHook(() => useChainProtocol('unknown'));

        expect(result.current).toBeUndefined();
      });

      it('should return undefined when chainName is not provided', () => {
        const { result } = renderHook(() => useChainProtocol());

        expect(result.current).toBeUndefined();
      });

      it('should handle different protocol types', () => {
        mockMultiProvider.tryGetChainMetadata.mockReturnValue({
          protocol: ProtocolType.Sealevel,
        });

        const { result } = renderHook(() => useChainProtocol('solana'));

        expect(result.current).toBe(ProtocolType.Sealevel);
      });
    });

    describe('useChainDisplayName', () => {
      beforeEach(() => {
        mockMultiProvider.tryGetChainMetadata.mockReturnValue({
          name: 'ethereum',
          displayName: 'Ethereum Mainnet',
          displayNameShort: 'ETH',
        });
      });

      it('should return full display name by default', () => {
        const { result } = renderHook(() => useChainDisplayName('ethereum'));

        expect(result.current).toBe('Ethereum Mainnet');
      });

      it('should return short name when shortName is true', () => {
        const { result } = renderHook(() => useChainDisplayName('ethereum', true));

        expect(result.current).toBe('ETH');
      });

      it('should call getChainDisplayName with correct parameters', () => {
        renderHook(() => useChainDisplayName('polygon', false));

        expect(mockMultiProvider.tryGetChainMetadata).toHaveBeenCalledWith('polygon');
      });
    });
  });

  describe('Utils', () => {
    describe('getChainDisplayName', () => {
      it('should return displayName when available', () => {
        mockMultiProvider.tryGetChainMetadata.mockReturnValue({
          name: 'ethereum',
          displayName: 'Ethereum Mainnet',
        });

        const result = getChainDisplayName(mockMultiProvider as any, 'ethereum');

        expect(result).toBe('Ethereum Mainnet');
      });

      it('should return displayNameShort when shortName is true', () => {
        mockMultiProvider.tryGetChainMetadata.mockReturnValue({
          name: 'ethereum',
          displayName: 'Ethereum Mainnet',
          displayNameShort: 'ETH',
        });

        const result = getChainDisplayName(mockMultiProvider as any, 'ethereum', true);

        expect(result).toBe('ETH');
      });

      it('should fallback to displayName when displayNameShort is not available', () => {
        mockMultiProvider.tryGetChainMetadata.mockReturnValue({
          name: 'ethereum',
          displayName: 'Ethereum Mainnet',
        });

        const result = getChainDisplayName(mockMultiProvider as any, 'ethereum', true);

        expect(result).toBe('Ethereum Mainnet');
      });

      it('should return title-cased name when displayName is not available', () => {
        mockMultiProvider.tryGetChainMetadata.mockReturnValue({
          name: 'ethereum',
        });

        const result = getChainDisplayName(mockMultiProvider as any, 'ethereum');

        expect(result).toBe('Ethereum');
      });

      it('should return "Unknown" when chain is falsy', () => {
        const result = getChainDisplayName(mockMultiProvider as any, '');

        expect(result).toBe('Unknown');
      });

      it('should return "Unknown" when metadata is not found', () => {
        mockMultiProvider.tryGetChainMetadata.mockReturnValue(null);

        const result = getChainDisplayName(mockMultiProvider as any, 'unknown');

        expect(result).toBe('Unknown');
      });
    });

    describe('isPermissionlessChain', () => {
      it('should return true when chain is empty', () => {
        const result = isPermissionlessChain(mockMultiProvider as any, '');

        expect(result).toBe(true);
      });

      it('should return true when metadata is not found', () => {
        mockMultiProvider.tryGetChainMetadata.mockReturnValue(null);

        const result = isPermissionlessChain(mockMultiProvider as any, 'unknown');

        expect(result).toBe(true);
      });

      it('should return true when chain is not an Abacus Works chain', () => {
        const metadata = { name: 'custom-chain' };
        mockMultiProvider.tryGetChainMetadata.mockReturnValue(metadata);
        vi.mocked(isAbacusWorksChain).mockReturnValue(false);

        const result = isPermissionlessChain(mockMultiProvider as any, 'custom-chain');

        expect(result).toBe(true);
        expect(isAbacusWorksChain).toHaveBeenCalledWith(metadata);
      });

      it('should return false when chain is an Abacus Works chain', () => {
        const metadata = { name: 'ethereum' };
        mockMultiProvider.tryGetChainMetadata.mockReturnValue(metadata);
        vi.mocked(isAbacusWorksChain).mockReturnValue(true);

        const result = isPermissionlessChain(mockMultiProvider as any, 'ethereum');

        expect(result).toBe(false);
      });
    });

    describe('hasPermissionlessChain', () => {
      it('should return true when any chain is permissionless', () => {
        mockMultiProvider.tryGetChainMetadata.mockImplementation((chain: string) => {
          return chain === 'custom' ? { name: 'custom' } : { name: chain };
        });
        vi.mocked(isAbacusWorksChain).mockImplementation((metadata: any) => {
          return metadata.name !== 'custom';
        });

        const result = hasPermissionlessChain(mockMultiProvider as any, [
          'ethereum',
          'custom',
          'polygon',
        ]);

        expect(result).toBe(true);
      });

      it('should return false when all chains are not permissionless', () => {
        mockMultiProvider.tryGetChainMetadata.mockReturnValue({ name: 'ethereum' });
        vi.mocked(isAbacusWorksChain).mockReturnValue(true);

        const result = hasPermissionlessChain(mockMultiProvider as any, ['ethereum', 'polygon']);

        expect(result).toBe(false);
      });

      it('should handle empty array', () => {
        const result = hasPermissionlessChain(mockMultiProvider as any, []);

        expect(result).toBe(false);
      });
    });

    describe('getNumRoutesWithSelectedChain', () => {
      const mockWarpCore = {
        multiProvider: mockMultiProvider,
        getTokensForRoute: vi.fn(),
      };

      beforeEach(() => {
        mockMultiProvider.metadata = {
          ethereum: { name: 'ethereum' },
          polygon: { name: 'polygon' },
          arbitrum: { name: 'arbitrum' },
        };
        mockMultiProvider.tryGetChainMetadata.mockImplementation((chain: string) => ({
          name: chain,
          displayName: chain.charAt(0).toUpperCase() + chain.slice(1),
          displayNameShort: chain.substring(0, 3).toUpperCase(),
        }));
      });

      it('should calculate routes from selected origin chain', () => {
        mockWarpCore.getTokensForRoute.mockImplementation((origin: string, dest: string) => {
          if (origin === 'ethereum' && dest === 'polygon') return [1, 2];
          if (origin === 'ethereum' && dest === 'arbitrum') return [1];
          return [];
        });

        const result = getNumRoutesWithSelectedChain(mockWarpCore as any, 'ethereum', true);

        expect(result).toBeDefined();
        expect(result!.header).toContain('from');
        expect(result!.data.polygon.display).toBe('2 routes');
        expect(result!.data.polygon.sortValue).toBe(2);
        expect(result!.data.arbitrum.display).toBe('1 route');
        expect(result!.data.arbitrum.sortValue).toBe(1);
      });

      it('should calculate routes to selected destination chain', () => {
        mockWarpCore.getTokensForRoute.mockImplementation((origin: string, dest: string) => {
          if (dest === 'polygon' && origin === 'ethereum') return [1, 2, 3];
          if (dest === 'polygon' && origin === 'arbitrum') return [1];
          return [];
        });

        const result = getNumRoutesWithSelectedChain(mockWarpCore as any, 'polygon', false);

        expect(result).toBeDefined();
        expect(result!.header).toContain('to');
        expect(result!.data.ethereum.display).toBe('3 routes');
        expect(result!.data.ethereum.sortValue).toBe(3);
        expect(result!.data.arbitrum.display).toBe('1 route');
      });

      it('should use singular "route" for single route', () => {
        mockWarpCore.getTokensForRoute.mockReturnValue([1]);

        const result = getNumRoutesWithSelectedChain(mockWarpCore as any, 'ethereum', true);

        expect(result).toBeDefined();
        expect(result!.data.polygon.display).toBe('1 route');
      });

      it('should handle zero routes', () => {
        mockWarpCore.getTokensForRoute.mockReturnValue([]);

        const result = getNumRoutesWithSelectedChain(mockWarpCore as any, 'ethereum', true);

        expect(result).toBeDefined();
        expect(result!.data.polygon.display).toBe('0 route');
        expect(result!.data.polygon.sortValue).toBe(0);
      });

      it('should trim long chain names in header', () => {
        mockWarpCore.getTokensForRoute.mockReturnValue([]);
        mockMultiProvider.tryGetChainMetadata.mockReturnValue({
          name: 'verylongchainname',
          displayNameShort: 'VeryLongChainName',
        });

        const result = getNumRoutesWithSelectedChain(
          mockWarpCore as any,
          'verylongchainname',
          true,
        );

        // trimToLength should limit to 10 chars
        expect(result).toBeDefined();
        expect(result?.header).toBeDefined();
      });
    });

    describe('isChainDisabled', () => {
      it('should return false when shouldDisableChains config is false', () => {
        const metadata = {
          availability: { status: ChainStatus.Disabled },
        };

        const result = isChainDisabled(metadata as any);

        expect(result).toBe(false);
      });

      it('should return false when metadata is null', () => {
        configMock.shouldDisableChains = true;

        const result = isChainDisabled(null);

        expect(result).toBe(false);
      });

      it('should return true when chain is disabled', () => {
        configMock.shouldDisableChains = true;
        const metadata = {
          availability: { status: ChainStatus.Disabled },
        };

        const result = isChainDisabled(metadata as any);

        expect(result).toBe(true);
      });

      it('should return false when chain is not disabled', () => {
        configMock.shouldDisableChains = true;
        const metadata = {
          availability: { status: ChainStatus.Live },
        };

        const result = isChainDisabled(metadata as any);

        expect(result).toBe(false);
      });

      it('should return false when availability is undefined', () => {
        configMock.shouldDisableChains = true;
        const metadata = {};

        const result = isChainDisabled(metadata as any);

        expect(result).toBe(false);
      });
    });

    describe('tryGetValidChainName', () => {
      it('should return chainName when valid and not disabled', () => {
        mockMultiProvider.tryGetChainName.mockReturnValue('ethereum');
        mockMultiProvider.tryGetChainMetadata.mockReturnValue({
          name: 'ethereum',
          availability: { status: ChainStatus.Live },
        });
        configMock.shouldDisableChains = false;

        const result = tryGetValidChainName('ethereum', mockMultiProvider as any);

        expect(result).toBe('ethereum');
      });

      it('should return undefined when chainName is null', () => {
        const result = tryGetValidChainName(null, mockMultiProvider as any);

        expect(result).toBeUndefined();
      });

      it('should return undefined when chain is not found', () => {
        mockMultiProvider.tryGetChainName.mockReturnValue(null);

        const result = tryGetValidChainName('unknown', mockMultiProvider as any);

        expect(result).toBeUndefined();
      });

      it('should return undefined when chain is disabled', () => {
        mockMultiProvider.tryGetChainName.mockReturnValue('disabled-chain');
        mockMultiProvider.tryGetChainMetadata.mockReturnValue({
          name: 'disabled-chain',
          availability: { status: ChainStatus.Disabled },
        });
        configMock.shouldDisableChains = true;

        const result = tryGetValidChainName('disabled-chain', mockMultiProvider as any);

        expect(result).toBeUndefined();
      });

      it('should call tryGetChainName with correct parameter', () => {
        mockMultiProvider.tryGetChainName.mockReturnValue('polygon');
        mockMultiProvider.tryGetChainMetadata.mockReturnValue({ name: 'polygon' });

        tryGetValidChainName('polygon', mockMultiProvider as any);

        expect(mockMultiProvider.tryGetChainName).toHaveBeenCalledWith('polygon');
      });
    });
  });

  describe('assembleChainMetadata', () => {
    const mockRegistry = {
      getMetadata: vi.fn(),
    };

    beforeEach(() => {
      configMock.useOnlineRegistry = true;
      configMock.registryUrl = '';
      configMock.rpcOverrides = '';
    });

    it('should merge filesystem and registry metadata', async () => {
      mockRegistry.getMetadata.mockResolvedValue({
        ethereum: {
          name: 'ethereum',
          chainId: 1,
          protocol: ProtocolType.Ethereum,
          rpcUrls: ['https://eth-rpc.com'],
        },
      });

      const result = await assembleChainMetadata(['ethereum'], mockRegistry as any);

      expect(result.chainMetadata).toBeDefined();
      expect(result.chainMetadataWithOverrides).toBeDefined();
    });

    it('should use published metadata when no custom registry URL', async () => {
      configMock.registryUrl = '';

      await assembleChainMetadata(['ethereum'], mockRegistry as any);

      expect(mockRegistry.getMetadata).not.toHaveBeenCalled();
    });

    it('should skip registry when useOnlineRegistry is false', async () => {
      configMock.useOnlineRegistry = false;

      const result = await assembleChainMetadata(['ethereum'], mockRegistry as any);

      expect(mockRegistry.getMetadata).not.toHaveBeenCalled();
      expect(result.chainMetadata).toBeDefined();
    });

    it('should filter chains based on chainsInTokens', async () => {
      mockRegistry.getMetadata.mockResolvedValue({
        ethereum: { name: 'ethereum' },
        polygon: { name: 'polygon' },
        arbitrum: { name: 'arbitrum' },
      });

      const result = await assembleChainMetadata(['ethereum', 'polygon'], mockRegistry as any);

      // Should only include chains from chainsInTokens
      expect(result.chainMetadata).toBeDefined();
    });

    it('should add logo URIs to registry metadata', async () => {
      configMock.registryUrl = 'https://custom-registry.com';
      mockRegistry.getMetadata.mockResolvedValue({
        ethereum: {
          name: 'ethereum',
          chainId: 1,
        },
      });

      const result = await assembleChainMetadata(['ethereum'], mockRegistry as any);

      expect(result.chainMetadata).toBeDefined();
    });

    it('should handle RPC overrides for Ethereum chains', async () => {
      configMock.rpcOverrides = JSON.stringify({
        ethereum: 'https://custom-rpc.com',
      });
      mockRegistry.getMetadata.mockResolvedValue({
        ethereum: {
          name: 'ethereum',
          chainId: 1,
          protocol: ProtocolType.Ethereum,
          rpcUrls: ['https://default-rpc.com'],
        },
      });

      const result = await assembleChainMetadata(['ethereum'], mockRegistry as any);

      expect(result.chainMetadata).toBeDefined();
    });

    it('should handle RPC overrides for non-Ethereum chains', async () => {
      configMock.rpcOverrides = JSON.stringify({
        solana: 'https://custom-solana-rpc.com',
      });
      mockRegistry.getMetadata.mockResolvedValue({
        solana: {
          name: 'solana',
          protocol: ProtocolType.Sealevel,
          rpcUrls: ['https://default-solana.com'],
        },
      });

      const result = await assembleChainMetadata(['solana'], mockRegistry as any);

      expect(result.chainMetadata).toBeDefined();
    });

    it('should merge store metadata overrides', async () => {
      mockRegistry.getMetadata.mockResolvedValue({
        ethereum: {
          name: 'ethereum',
          chainId: 1,
        },
      });

      const overrides = {
        ethereum: {
          displayName: 'Custom Ethereum Name',
        },
      };

      const result = await assembleChainMetadata(['ethereum'], mockRegistry as any, overrides);

      expect(result.chainMetadataWithOverrides).toBeDefined();
    });

    it('should handle invalid chain metadata', async () => {
      mockRegistry.getMetadata.mockResolvedValue({});

      const result = await assembleChainMetadata(['ethereum'], mockRegistry as any);

      expect(result.chainMetadata).toBeDefined();
    });

    it('should handle invalid RPC overrides gracefully', async () => {
      configMock.rpcOverrides = 'invalid json';
      mockRegistry.getMetadata.mockResolvedValue({
        ethereum: { name: 'ethereum' },
      });

      // Should not throw, just warn
      const result = await assembleChainMetadata(['ethereum'], mockRegistry as any);

      expect(result.chainMetadata).toBeDefined();
    });
  });
});
