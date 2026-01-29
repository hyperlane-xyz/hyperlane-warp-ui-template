import { TokenStandard, WarpCoreConfig } from '@hyperlane-xyz/sdk';
import { describe, expect, test } from 'vitest';
import { BLOCKED_RECIPIENT_ADDRESSES } from '../consts/blacklist';
import { getBlockedAddressesByChain } from './store';

describe('getBlockedAddressesByChain', () => {
  const mockTokens: WarpCoreConfig['tokens'] = [
    {
      chainName: 'ethereum',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: '0xWarpRouteEthereum',
      collateralAddressOrDenom: '0xUSDCEthereum',
      decimals: 6,
      symbol: 'USDC',
      name: 'USD Coin',
    },
    {
      chainName: 'base',
      standard: TokenStandard.EvmHypSynthetic,
      addressOrDenom: '0xWarpRouteBase',
      decimals: 6,
      symbol: 'USDC',
      name: 'USD Coin',
    },
  ];

  test('should block warp route addresses on their respective chains', () => {
    const result = getBlockedAddressesByChain(mockTokens);

    expect(result['ethereum']?.get('0xwarprouteethereum')).toBe(
      'This is a Warp Route contract address, not a wallet address',
    );
    expect(result['base']?.get('0xwarproutebase')).toBe(
      'This is a Warp Route contract address, not a wallet address',
    );
  });

  test('should block collateral token addresses on their respective chains', () => {
    const result = getBlockedAddressesByChain(mockTokens);

    expect(result['ethereum']?.get('0xusdcethereum')).toBe(
      'This is the USDC token contract address, not a wallet address',
    );
    // Base token is synthetic, so it should not have a collateral address blocked
    expect(result['base']?.has('0xusdcethereum')).toBe(false);
  });

  test('should not block collateral addresses on other chains', () => {
    const result = getBlockedAddressesByChain(mockTokens);

    // Ethereum USDC should NOT be blocked on Base
    expect(result['base']?.has('0xusdcethereum')).toBe(false);
  });

  test('should block well-known addresses on all chains', () => {
    const result = getBlockedAddressesByChain(mockTokens);

    // Check that well-known addresses are blocked on all chains
    for (const [address, reason] of Object.entries(BLOCKED_RECIPIENT_ADDRESSES)) {
      expect(result['ethereum']?.get(address.toLowerCase())).toBe(reason);
      expect(result['base']?.get(address.toLowerCase())).toBe(reason);
    }
  });

  test('should normalize addresses to lowercase for case-insensitive matching', () => {
    const result = getBlockedAddressesByChain(mockTokens);

    // Should match regardless of case
    expect(result['ethereum']?.get('0xWARPROUTEETHEREUM'.toLowerCase())).toBe(
      'This is a Warp Route contract address, not a wallet address',
    );
    expect(result['ethereum']?.get('0xwarprouteethereum')).toBe(
      'This is a Warp Route contract address, not a wallet address',
    );
  });

  test('should return empty map for empty tokens array', () => {
    const result = getBlockedAddressesByChain([]);

    expect(Object.keys(result).length).toBe(0);
  });

  test('should handle tokens without collateralAddressOrDenom', () => {
    const tokensWithoutCollateral: WarpCoreConfig['tokens'] = [
      {
        chainName: 'ethereum',
        standard: TokenStandard.EvmHypNative,
        addressOrDenom: '0xWarpRouteNative',
        decimals: 18,
        symbol: 'ETH',
        name: 'Ether',
      },
    ];

    const result = getBlockedAddressesByChain(tokensWithoutCollateral);

    expect(result['ethereum']?.get('0xwarproutenative')).toBe(
      'This is a Warp Route contract address, not a wallet address',
    );
    // Should only have warp route + well-known addresses, not any collateral
    expect(result['ethereum']?.size).toBe(1 + Object.keys(BLOCKED_RECIPIENT_ADDRESSES).length);
  });

  test('should not overwrite existing entries (first reason wins)', () => {
    // Create tokens where the same address appears as both warp route and collateral
    const tokensWithDuplicate: WarpCoreConfig['tokens'] = [
      {
        chainName: 'ethereum',
        standard: TokenStandard.EvmHypCollateral,
        addressOrDenom: '0xSameAddress',
        collateralAddressOrDenom: '0xCollateral',
        decimals: 6,
        symbol: 'TOKEN',
        name: 'Token',
      },
      {
        chainName: 'ethereum',
        standard: TokenStandard.EvmHypCollateral,
        addressOrDenom: '0xAnotherRoute',
        collateralAddressOrDenom: '0xSameAddress', // Same as warp route above
        decimals: 6,
        symbol: 'OTHER',
        name: 'Other Token',
      },
    ];

    const result = getBlockedAddressesByChain(tokensWithDuplicate);

    // First entry (warp route) should win
    expect(result['ethereum']?.get('0xsameaddress')).toBe(
      'This is a Warp Route contract address, not a wallet address',
    );
  });
});
