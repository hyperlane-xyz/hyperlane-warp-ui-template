import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getHypExplorerLink } from '../links';

type MockedMultiProvider = {
  tryGetChainMetadata: ReturnType<typeof vi.fn>;
};

const { configMock, linksMock, isPermissionlessChainMock, toBase64Mock } = vi.hoisted(() => ({
  configMock: { enableExplorerLink: true },
  linksMock: { explorer: 'https://explorer.hyperlane.xyz' },
  isPermissionlessChainMock: vi.fn(),
  toBase64Mock: vi.fn(),
}));

vi.mock('../../consts/config', () => ({
  config: configMock,
}));

vi.mock('../../consts/links', () => ({
  links: linksMock,
}));

vi.mock('../../features/chains/utils', () => ({
  isPermissionlessChain: isPermissionlessChainMock,
}));

vi.mock('@hyperlane-xyz/utils', () => ({
  toBase64: toBase64Mock,
}));

describe('getHypExplorerLink', () => {
  const multiProvider: MockedMultiProvider = {
    tryGetChainMetadata: vi.fn(),
  };

  const chain = 'test-chain' as any;
  const msgId = '0x1234';

  beforeEach(() => {
    configMock.enableExplorerLink = true;
    linksMock.explorer = 'https://explorer.hyperlane.xyz'; // Reset to default
    multiProvider.tryGetChainMetadata = vi.fn();
    isPermissionlessChainMock.mockReset();
    toBase64Mock.mockReset();
  });

  it('returns null when explorer links are disabled', () => {
    configMock.enableExplorerLink = false;

    const result = getHypExplorerLink(multiProvider as any, chain, msgId);

    expect(result).toBeNull();
    expect(isPermissionlessChainMock).not.toHaveBeenCalled(); // No further processing
  });

  it('returns null when chain or message id is missing', () => {
    const withMissingMsgId = getHypExplorerLink(multiProvider as any, chain, undefined);
    const withMissingChain = getHypExplorerLink(multiProvider as any, '' as any, msgId); // Empty chain

    expect(withMissingMsgId).toBeNull(); // Missing msgId
    expect(withMissingChain).toBeNull(); // Missing chain
  });

  it('returns the base explorer link when chain is not permissionless', () => {
    isPermissionlessChainMock.mockReturnValue(false);

    const result = getHypExplorerLink(multiProvider as any, chain, msgId); // Non-permissionless chain

    expect(result).toBe(`${linksMock.explorer}/message/${msgId}`); // Base link only
    expect(multiProvider.tryGetChainMetadata).not.toHaveBeenCalled(); // No metadata fetch
  });

  it('falls back to base link if metadata serialization fails', () => {
    isPermissionlessChainMock.mockReturnValue(true);
    multiProvider.tryGetChainMetadata.mockReturnValue(undefined);

    const withoutMetadata = getHypExplorerLink(multiProvider as any, chain, msgId);

    expect(withoutMetadata).toBe(`${linksMock.explorer}/message/${msgId}`); // Base link only

    // Now test with metadata but serialization fails (empty result)

    multiProvider.tryGetChainMetadata.mockReturnValue({ id: 'meta' });
    toBase64Mock.mockReturnValue('');

    const withoutSerializedConfig = getHypExplorerLink(multiProvider as any, chain, msgId); // Serialization fails

    expect(withoutSerializedConfig).toBe(`${linksMock.explorer}/message/${msgId}`); // Base link only
  });

  it('appends serialized chain metadata for permissionless chains', () => {
    isPermissionlessChainMock.mockReturnValue(true);
    const metadata = { id: 'meta' } as any;
    multiProvider.tryGetChainMetadata.mockReturnValue(metadata); // Valid metadata
    toBase64Mock.mockReturnValue('encoded');

    const result = getHypExplorerLink(multiProvider as any, chain, msgId); // Full link with metadata

    expect(multiProvider.tryGetChainMetadata).toHaveBeenCalledWith(chain); // Metadata fetch
    expect(toBase64Mock).toHaveBeenCalledWith([metadata]);
    expect(result).toBe(`${linksMock.explorer}/message/${msgId}?chains=encoded`); // Full link
  });
});
