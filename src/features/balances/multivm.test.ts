import { TokenStandard } from '@hyperlane-xyz/sdk';
import { describe, expect, test } from 'vitest';

import { directAleoBalanceDenom, resolveAleoBalanceStandard } from './aleo';
import { cosmosBankDenomForToken, resolveCosmosBalanceStandard } from './cosmos';
import { resolveRadixBalanceStandard } from './radix';
import { isSealevelNativeBalance } from './sealevel';

describe('cosmos balance routing', () => {
  test('uses engine collateral denoms directly', () => {
    expect(
      cosmosBankDenomForToken({
        address: 'ibc/D79E7D83AB399BFFF93433E54FAA480C191248FC556924A2A8351AE2638B3877',
        standard: TokenStandard.CwHypCollateral,
      }),
    ).toBe('ibc/D79E7D83AB399BFFF93433E54FAA480C191248FC556924A2A8351AE2638B3877');
  });

  test('keeps CwHypNative on the SDK adapter because engine address is the router', () => {
    expect(
      cosmosBankDenomForToken({
        address: 'inj1mv9tjvkaw7x8w8y9vds8pkfq46g2vcfkjehc6k',
        standard: TokenStandard.CwHypNative,
      }),
    ).toBeNull();
    expect(resolveCosmosBalanceStandard(TokenStandard.CwHypNative)).toBe(TokenStandard.CwHypNative);
  });

  test('maps Cosmos native synthetic modules to their bank denom', () => {
    expect(
      cosmosBankDenomForToken({
        address: '0x1234',
        standard: TokenStandard.CosmNativeHypSynthetic,
      }),
    ).toBe('hyperlane/0x1234');
  });

  test.each(['utia', 'ukyve', 'uosmo'])(
    'maps native zero-address aliases to the chain native denom %s',
    (nativeDenom) => {
      expect(
        cosmosBankDenomForToken(
          {
            address: '0x0000000000000000000000000000000000000000',
            isNative: true,
            standard: TokenStandard.CosmNativeHypCollateral,
          },
          nativeDenom,
        ),
      ).toBe(nativeDenom);
    },
  );

  test('does not remap non-native zero-address module token ids', () => {
    expect(
      cosmosBankDenomForToken({
        address: '0x0000000000000000000000000000000000000000',
        standard: TokenStandard.CosmNativeHypCollateral,
      }),
    ).toBeNull();
  });

  test('keeps Cosmos native collateral module token ids on the SDK adapter', () => {
    expect(
      cosmosBankDenomForToken({
        address: '0x726f757465725f61707000000000000000000000000000010000000000000000',
        standard: TokenStandard.CosmNativeHypCollateral,
      }),
    ).toBeNull();
    expect(resolveCosmosBalanceStandard(TokenStandard.CosmNativeHypCollateral)).toBe(
      TokenStandard.CosmNativeHypCollateral,
    );
  });
});

describe('radix balance routing', () => {
  test('uses resource addresses directly even when the route standard is collateral', () => {
    expect(
      resolveRadixBalanceStandard({
        tokenAddress: 'resource_rdx1tk0fd',
        isNative: false,
        standard: TokenStandard.RadixHypCollateral,
      }),
    ).toBe(TokenStandard.RadixNative);
  });

  test('uses the Hyp adapter for component token addresses', () => {
    expect(
      resolveRadixBalanceStandard({
        tokenAddress: 'component_rdx1cp0fd',
        isNative: false,
        standard: TokenStandard.RadixHypSynthetic,
      }),
    ).toBe(TokenStandard.RadixHypSynthetic);
  });
});

describe('sealevel balance routing', () => {
  test('reads HypNative routes as native lamports even when API token is not marked native', () => {
    expect(
      isSealevelNativeBalance({
        address: '4CMbJtieJ7EboZZGSbXTQjW5i2sL638jFvE3dWTYG3SK',
        isNative: false,
        standard: TokenStandard.SealevelHypNative,
      }),
    ).toBe(true);
  });

  test('reads collateral and synthetic mint addresses as SPL balances', () => {
    expect(
      isSealevelNativeBalance({
        address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        isNative: false,
        standard: TokenStandard.SealevelHypCollateral,
      }),
    ).toBe(false);
    expect(
      isSealevelNativeBalance({
        address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        isNative: false,
        standard: TokenStandard.SealevelHypCrossCollateral,
      }),
    ).toBe(false);
  });
});

describe('aleo balance routing', () => {
  test('uses Hyp adapters for token programs', () => {
    expect(
      resolveAleoBalanceStandard({
        tokenAddress: 'hyp_warp_token_usdc.aleo/aleo1token',
        isNative: false,
        standard: TokenStandard.AleoHypSynthetic,
      }),
    ).toBe(TokenStandard.AleoHypSynthetic);
  });

  test('reads raw collateral denoms directly if the engine returns one', () => {
    expect(
      directAleoBalanceDenom({
        tokenAddress: 'usdc.microcredits',
        isNative: false,
        standard: TokenStandard.AleoHypCollateral,
      }),
    ).toBe('usdc.microcredits');
  });

  test('uses the SDK native adapter for native balances', () => {
    expect(
      resolveAleoBalanceStandard({
        tokenAddress: 'credits',
        isNative: true,
      }),
    ).toBe(TokenStandard.AleoNative);
  });
});
