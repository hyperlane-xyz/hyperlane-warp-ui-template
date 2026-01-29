import { TokenStandard, WarpCoreConfig } from '@hyperlane-xyz/sdk';
import { describe, expect, test } from 'vitest';
import { BLOCKED_RECIPIENT_ADDRESSES } from '../consts/blacklist';
import { getBlockedAddressesByChain } from './store';

describe('getBlockedAddressesByChain', () => {
  // Use valid EVM hex addresses for testing
  const WARP_ROUTE_ETH = '0x1111111111111111111111111111111111111111';
  const USDC_ETH = '0x2222222222222222222222222222222222222222';
  const WARP_ROUTE_BASE = '0x3333333333333333333333333333333333333333';

  const mockTokens: WarpCoreConfig['tokens'] = [
    {
      chainName: 'ethereum',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: WARP_ROUTE_ETH,
      collateralAddressOrDenom: USDC_ETH,
      decimals: 6,
      symbol: 'USDC',
      name: 'USD Coin',
    },
    {
      chainName: 'base',
      standard: TokenStandard.EvmHypSynthetic,
      addressOrDenom: WARP_ROUTE_BASE,
      decimals: 6,
      symbol: 'USDC',
      name: 'USD Coin',
    },
  ];

  test('should block warp route addresses on their respective chains', () => {
    const result = getBlockedAddressesByChain(mockTokens);

    expect(result['ethereum']?.get(WARP_ROUTE_ETH.toLowerCase())).toBe(
      'This is a Warp Route contract address, not a wallet address',
    );
    expect(result['base']?.get(WARP_ROUTE_BASE.toLowerCase())).toBe(
      'This is a Warp Route contract address, not a wallet address',
    );
  });

  test('should block collateral token addresses on their respective chains', () => {
    const result = getBlockedAddressesByChain(mockTokens);

    expect(result['ethereum']?.get(USDC_ETH.toLowerCase())).toBe(
      'This is the USDC token contract address, not a wallet address',
    );
    // Base token is synthetic, so it should not have a collateral address blocked
    expect(result['base']?.has(USDC_ETH.toLowerCase())).toBe(false);
  });

  test('should not block collateral addresses on other chains', () => {
    const result = getBlockedAddressesByChain(mockTokens);

    // Ethereum USDC should NOT be blocked on Base
    expect(result['base']?.has(USDC_ETH.toLowerCase())).toBe(false);
  });

  test('should block well-known addresses on all chains', () => {
    const result = getBlockedAddressesByChain(mockTokens);

    // Check that well-known addresses are blocked on all chains
    for (const [address, reason] of Object.entries(BLOCKED_RECIPIENT_ADDRESSES)) {
      expect(result['ethereum']?.get(address.toLowerCase())).toBe(reason);
      expect(result['base']?.get(address.toLowerCase())).toBe(reason);
    }
  });

  test('should normalize EVM hex addresses to lowercase for case-insensitive matching', () => {
    const mixedCaseAddress = '0xAaBbCcDdEeFf00112233445566778899AaBbCcDd';
    const tokensWithMixedCase: WarpCoreConfig['tokens'] = [
      {
        chainName: 'ethereum',
        standard: TokenStandard.EvmHypCollateral,
        addressOrDenom: mixedCaseAddress,
        decimals: 6,
        symbol: 'TEST',
        name: 'Test Token',
      },
    ];

    const result = getBlockedAddressesByChain(tokensWithMixedCase);

    // Should match regardless of case for EVM addresses
    expect(result['ethereum']?.get(mixedCaseAddress.toLowerCase())).toBe(
      'This is a Warp Route contract address, not a wallet address',
    );
    expect(
      result['ethereum']?.get(mixedCaseAddress.toUpperCase().replace('X', 'x')),
    ).toBeUndefined();
  });

  test('should preserve case for non-EVM addresses (e.g., base58)', () => {
    const solanaTokens: WarpCoreConfig['tokens'] = [
      {
        chainName: 'solana',
        standard: TokenStandard.SealevelHypCollateral,
        addressOrDenom: 'SoLaNaAdDrEsS123ABC', // Not a hex address
        collateralAddressOrDenom: 'CoLLaTeRaL456XYZ',
        decimals: 9,
        symbol: 'SOL',
        name: 'Solana',
      },
    ];

    const result = getBlockedAddressesByChain(solanaTokens);

    // Non-EVM addresses should preserve case
    expect(result['solana']?.get('SoLaNaAdDrEsS123ABC')).toBe(
      'This is a Warp Route contract address, not a wallet address',
    );
    // Lowercase version should NOT match
    expect(result['solana']?.get('solanaaddress123abc')).toBeUndefined();
  });

  test('should return empty map for empty tokens array', () => {
    const result = getBlockedAddressesByChain([]);

    expect(Object.keys(result).length).toBe(0);
  });

  test('should handle tokens without collateralAddressOrDenom', () => {
    const nativeWarpRoute = '0x4444444444444444444444444444444444444444';
    const tokensWithoutCollateral: WarpCoreConfig['tokens'] = [
      {
        chainName: 'ethereum',
        standard: TokenStandard.EvmHypNative,
        addressOrDenom: nativeWarpRoute,
        decimals: 18,
        symbol: 'ETH',
        name: 'Ether',
      },
    ];

    const result = getBlockedAddressesByChain(tokensWithoutCollateral);

    expect(result['ethereum']?.get(nativeWarpRoute.toLowerCase())).toBe(
      'This is a Warp Route contract address, not a wallet address',
    );
    // Should only have warp route + well-known addresses, not any collateral
    expect(result['ethereum']?.size).toBe(1 + Object.keys(BLOCKED_RECIPIENT_ADDRESSES).length);
  });

  test('should not overwrite existing entries (first reason wins)', () => {
    const sameAddress = '0x5555555555555555555555555555555555555555';
    const collateral = '0x6666666666666666666666666666666666666666';
    const anotherRoute = '0x7777777777777777777777777777777777777777';

    // Create tokens where the same address appears as both warp route and collateral
    const tokensWithDuplicate: WarpCoreConfig['tokens'] = [
      {
        chainName: 'ethereum',
        standard: TokenStandard.EvmHypCollateral,
        addressOrDenom: sameAddress,
        collateralAddressOrDenom: collateral,
        decimals: 6,
        symbol: 'TOKEN',
        name: 'Token',
      },
      {
        chainName: 'ethereum',
        standard: TokenStandard.EvmHypCollateral,
        addressOrDenom: anotherRoute,
        collateralAddressOrDenom: sameAddress, // Same as warp route above
        decimals: 6,
        symbol: 'OTHER',
        name: 'Other Token',
      },
    ];

    const result = getBlockedAddressesByChain(tokensWithDuplicate);

    // First entry (warp route) should win
    expect(result['ethereum']?.get(sameAddress.toLowerCase())).toBe(
      'This is a Warp Route contract address, not a wallet address',
    );
  });
});
