import { describe, expect, test } from 'vitest';

import {
  isTrustedWrappedNativeAddress,
  trustedWrappedNativeAddressForToken,
  validateWrappedNativeMetadata,
  WRAPPED_NATIVE_TOKEN_BY_CHAIN_ID,
} from './wrappedNative';

describe('trustedWrappedNativeAddressForToken', () => {
  test('uses local trusted wrapped native addresses for swap-capable native assets', () => {
    expect(WRAPPED_NATIVE_TOKEN_BY_CHAIN_ID[8453]).toBe(
      '0x4200000000000000000000000000000000000006',
    );
    expect(WRAPPED_NATIVE_TOKEN_BY_CHAIN_ID[56]).toBe('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c');
    expect(WRAPPED_NATIVE_TOKEN_BY_CHAIN_ID[1399811149]).toBe(
      'So11111111111111111111111111111111111111112',
    );
  });

  test('does not trust engine wrappedAddress on non-native tokens', () => {
    expect(
      trustedWrappedNativeAddressForToken({
        chainId: 8453,
        address: '0x1111111111111111111111111111111111111111',
        isNative: false,
      }),
    ).toBeUndefined();
  });

  test('matches only the configured wrapped native address for a chain', () => {
    expect(isTrustedWrappedNativeAddress(56, '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c')).toBe(
      true,
    );
    expect(isTrustedWrappedNativeAddress(8453, WRAPPED_NATIVE_TOKEN_BY_CHAIN_ID[56])).toBe(false);
    expect(isTrustedWrappedNativeAddress(8453, '0x0000000000000000000000000000000000000000')).toBe(
      false,
    );
  });

  test('rejects native metadata when engine wrappedAddress differs from the local trusted address', () => {
    expect(
      validateWrappedNativeMetadata({
        chainId: 8453,
        address: '0x0000000000000000000000000000000000000000',
        isNative: true,
        wrappedAddress: '0x1111111111111111111111111111111111111111',
      }),
    ).toMatchObject({
      valid: false,
      reason: 'Native token wrappedAddress does not match trusted local wrapped native',
      trustedWrappedAddress: '0x4200000000000000000000000000000000000006',
      engineWrappedAddress: '0x1111111111111111111111111111111111111111',
    });
  });

  test('accepts missing engine wrappedAddress while still returning the local trusted address', () => {
    expect(
      validateWrappedNativeMetadata({
        chainId: 8453,
        address: '0x0000000000000000000000000000000000000000',
        isNative: true,
      }),
    ).toEqual({
      valid: true,
      trustedWrappedAddress: '0x4200000000000000000000000000000000000006',
    });
  });

  test('rejects rows whose isNative flag does not match the native sentinel address', () => {
    expect(
      validateWrappedNativeMetadata({
        chainId: 8453,
        address: '0x1111111111111111111111111111111111111111',
        isNative: true,
        wrappedAddress: '0x4200000000000000000000000000000000000006',
      }),
    ).toMatchObject({
      valid: false,
      reason: 'Native token metadata does not match native sentinel address',
      chainId: 8453,
    });
  });
});
