import { describe, expect, test } from 'vitest';

import {
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
        isNative: false,
      }),
    ).toBeUndefined();
  });

  test('rejects native metadata when engine wrappedAddress differs from the local trusted address', () => {
    expect(
      validateWrappedNativeMetadata({
        chainId: 8453,
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
});
