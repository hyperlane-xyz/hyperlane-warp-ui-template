import { ChainMetadata, isRpcHealthy } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { checkRpcHealth } from './ChainConnectionWarning';

vi.mock('@hyperlane-xyz/sdk', async (importOriginal) => {
  const actual = (await importOriginal()) as { MultiProtocolProvider: any };
  return {
    ...actual,
    MultiProtocolProvider: vi.fn().mockImplementation(() => ({
      getProvider: vi.fn(),
    })),
    isRpcHealthy: vi.fn(),
  };
});

const mockRpcUrl = 'http://mock.test.rpc.com';

const mockEvmChainMetadata: ChainMetadata = {
  name: 'TestChain',
  protocol: ProtocolType.Ethereum,
  rpcUrls: [{ http: mockRpcUrl }, { http: mockRpcUrl }],
  chainId: 10000000,
  domainId: 10000000,
};
const mockSvmChainMetadata = {
  name: 'TestChain',
  protocol: ProtocolType.Sealevel,
  rpcUrls: [{ http: mockRpcUrl }, { http: mockRpcUrl }],
  chainId: 10000000,
  domainId: 10000000,
};

describe('checkRpcHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should call isRpcHealthy as many times as rpcUrls length when chain protocol is Ethereum', async () => {
    (isRpcHealthy as ReturnType<typeof vi.fn>).mockImplementation(() => Promise.resolve(true));
    await checkRpcHealth(mockEvmChainMetadata);
    expect(isRpcHealthy).toHaveBeenCalledTimes(mockEvmChainMetadata.rpcUrls.length);
  });

  test('should call isRpcHealthy only once for non Ethereum chains', async () => {
    (isRpcHealthy as ReturnType<typeof vi.fn>).mockImplementation(() => Promise.resolve(true));
    await checkRpcHealth(mockSvmChainMetadata);
    expect(isRpcHealthy).toHaveBeenCalledTimes(1);
  });

  test('should return true if at least one Ethereum RPC is healthy', async () => {
    (isRpcHealthy as ReturnType<typeof vi.fn>).mockImplementation((_, i) =>
      i === 1 ? Promise.resolve(true) : Promise.reject(),
    );
    const result = await checkRpcHealth(mockEvmChainMetadata);
    expect(result).toBe(true);
  });

  test('should return false if no RPCs are healthy', async () => {
    (isRpcHealthy as ReturnType<typeof vi.fn>).mockImplementation(() => Promise.resolve(false));
    const result = await checkRpcHealth(mockEvmChainMetadata as any);
    expect(result).toBe(false);
  });
});
