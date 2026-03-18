import { MultiProtocolProvider, TokenStandard } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { describe, expect, test, vi } from 'vitest';
import { createMockToken } from '../../utils/test';
import { resolveWrappedCollateralTokens } from './wrappedTokenResolver';

const ADDR_1 = '0x1111111111111111111111111111111111111111';
const ADDR_2 = '0x2222222222222222222222222222222222222222';
const UNDERLYING = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

const mockMultiProvider = {} as MultiProtocolProvider;

const createMockAdapter = (wrappedAddress?: string, shouldThrow?: boolean) => ({
  ...(wrappedAddress !== undefined && {
    getWrappedTokenAddress: shouldThrow
      ? vi.fn().mockRejectedValue(new Error('RPC error'))
      : vi.fn().mockResolvedValue(wrappedAddress),
  }),
});

describe('resolveWrappedCollateralTokens', () => {
  test('should return empty map for no eligible tokens', async () => {
    const syntheticToken = createMockToken({
      standard: TokenStandard.EvmHypSynthetic,
      addressOrDenom: ADDR_1,
    });
    // Override protocol to Ethereum (createMockToken uses test chain defaults)
    vi.spyOn(syntheticToken, 'protocol', 'get').mockReturnValue(ProtocolType.Ethereum);

    const result = await resolveWrappedCollateralTokens([syntheticToken], mockMultiProvider);
    expect(result.size).toBe(0);
  });

  test('should resolve lockbox token underlying address', async () => {
    const lockboxToken = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDT',
      standard: TokenStandard.EvmHypXERC20Lockbox,
      addressOrDenom: ADDR_1,
      collateralAddressOrDenom: '0xWRAPPER',
    });
    vi.spyOn(lockboxToken, 'protocol', 'get').mockReturnValue(ProtocolType.Ethereum);
    vi.spyOn(lockboxToken, 'getHypAdapter').mockReturnValue(
      createMockAdapter(UNDERLYING) as ReturnType<typeof lockboxToken.getHypAdapter>,
    );

    const result = await resolveWrappedCollateralTokens([lockboxToken], mockMultiProvider);

    expect(result.size).toBe(1);
    const resolved = Array.from(result.values())[0];
    // normalizeAddress produces checksum-cased EVM addresses
    expect(resolved).toBe(UNDERLYING);
  });

  test('should skip adapter without getWrappedTokenAddress', async () => {
    const lockboxToken = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDT',
      standard: TokenStandard.EvmHypXERC20Lockbox,
      addressOrDenom: ADDR_1,
    });
    vi.spyOn(lockboxToken, 'protocol', 'get').mockReturnValue(ProtocolType.Ethereum);
    // Adapter without getWrappedTokenAddress
    vi.spyOn(lockboxToken, 'getHypAdapter').mockReturnValue(
      createMockAdapter() as ReturnType<typeof lockboxToken.getHypAdapter>,
    );

    const result = await resolveWrappedCollateralTokens([lockboxToken], mockMultiProvider);
    expect(result.size).toBe(0);
  });

  test('should handle RPC error gracefully and resolve other tokens', async () => {
    const failingToken = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDT',
      standard: TokenStandard.EvmHypXERC20Lockbox,
      addressOrDenom: ADDR_1,
    });
    const succeedingToken = createMockToken({
      chainName: 'ethereum',
      symbol: 'WETH',
      standard: TokenStandard.EvmHypOwnerCollateral,
      addressOrDenom: ADDR_2,
      collateralAddressOrDenom: '0xVAULT',
    });

    vi.spyOn(failingToken, 'protocol', 'get').mockReturnValue(ProtocolType.Ethereum);
    vi.spyOn(succeedingToken, 'protocol', 'get').mockReturnValue(ProtocolType.Ethereum);
    vi.spyOn(failingToken, 'getHypAdapter').mockReturnValue(
      createMockAdapter(UNDERLYING, true) as ReturnType<typeof failingToken.getHypAdapter>,
    );
    vi.spyOn(succeedingToken, 'getHypAdapter').mockReturnValue(
      createMockAdapter(UNDERLYING) as ReturnType<typeof succeedingToken.getHypAdapter>,
    );

    const result = await resolveWrappedCollateralTokens(
      [failingToken, succeedingToken],
      mockMultiProvider,
    );

    // Only the succeeding token should be in the map
    expect(result.size).toBe(1);
  });

  test('should filter out non-Ethereum tokens', async () => {
    const solanaToken = createMockToken({
      chainName: 'solana',
      symbol: 'USDT',
      standard: TokenStandard.EvmHypXERC20Lockbox,
      addressOrDenom: ADDR_1,
    });
    vi.spyOn(solanaToken, 'protocol', 'get').mockReturnValue(ProtocolType.Sealevel);

    const result = await resolveWrappedCollateralTokens([solanaToken], mockMultiProvider);
    expect(result.size).toBe(0);
  });
});
