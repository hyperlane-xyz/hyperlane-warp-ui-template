import type { IToken, Token, TokenAmount, WarpCore, WarpCoreFeeEstimate } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { findConnectedDestinationToken } from '../tokens/utils';
import { fetchPredicateAttestation } from './predicate';
import { fetchFeeQuotes } from './useFeeQuotes';

vi.mock('../tokens/utils', () => ({
  findConnectedDestinationToken: vi.fn(),
}));

vi.mock('./predicate', () => ({
  fetchPredicateAttestation: vi.fn(),
}));

const mockFindConnectedDestinationToken = vi.mocked(findConnectedDestinationToken);
const mockFetchPredicateAttestation = vi.mocked(fetchPredicateAttestation);

function mockOriginToken(protocol: ProtocolType): Token {
  return {
    protocol,
    decimals: 6,
    amount: vi.fn((amount) => ({ amount: BigInt(amount), token: {} }) as unknown as TokenAmount),
  } as unknown as Token;
}

function mockDestinationToken(protocol: ProtocolType): IToken {
  return {
    protocol,
    chainName: 'base',
  } as unknown as IToken;
}

describe('fetchFeeQuotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retries with fallback sender when connected sender quote fails on evm->evm', async () => {
    const originToken = mockOriginToken(ProtocolType.Ethereum);
    const destinationToken = mockDestinationToken(ProtocolType.Ethereum);
    mockFindConnectedDestinationToken.mockReturnValue(destinationToken as unknown as Token);

    const expectedFees = { localQuote: { amount: 1n } } as unknown as WarpCoreFeeEstimate;
    const estimateTransferRemoteFees = vi
      .fn()
      .mockRejectedValueOnce(new Error('insufficient funds for gas * price + value'))
      .mockResolvedValueOnce(expectedFees);
    const warpCore = {
      estimateTransferRemoteFees,
      isPredicateSupported: vi.fn().mockResolvedValue(false),
    } as unknown as WarpCore;

    const result = await fetchFeeQuotes(
      warpCore,
      originToken,
      destinationToken,
      'base',
      '0x1111111111111111111111111111111111111111',
      undefined,
      '0.01',
      '0x2222222222222222222222222222222222222222',
      false,
    );

    expect(result).toBe(expectedFees);
    expect(estimateTransferRemoteFees).toHaveBeenCalledTimes(2);
    expect(estimateTransferRemoteFees.mock.calls[0][0].sender).toBe(
      '0x1111111111111111111111111111111111111111',
    );
    expect(estimateTransferRemoteFees.mock.calls[1][0].sender).toBe(
      '0x000000000000000000000000000000000000dEaD',
    );
  });

  it('does not retry for non-evm routes', async () => {
    const originToken = mockOriginToken(ProtocolType.Sealevel);
    const destinationToken = mockDestinationToken(ProtocolType.Ethereum);
    mockFindConnectedDestinationToken.mockReturnValue(destinationToken as unknown as Token);

    const estimateTransferRemoteFees = vi.fn().mockRejectedValueOnce(new Error('quote failed'));
    const warpCore = {
      estimateTransferRemoteFees,
      isPredicateSupported: vi.fn().mockResolvedValue(false),
    } as unknown as WarpCore;

    await expect(
      fetchFeeQuotes(
        warpCore,
        originToken,
        destinationToken,
        'base',
        '0x1111111111111111111111111111111111111111',
        undefined,
        '0.01',
        '0x2222222222222222222222222222222222222222',
        false,
      ),
    ).rejects.toThrow('quote failed');

    expect(estimateTransferRemoteFees).toHaveBeenCalledTimes(1);
  });

  it('does not retry when already using fallback sender', async () => {
    const originToken = mockOriginToken(ProtocolType.Ethereum);
    const destinationToken = mockDestinationToken(ProtocolType.Ethereum);
    mockFindConnectedDestinationToken.mockReturnValue(destinationToken as unknown as Token);

    const estimateTransferRemoteFees = vi.fn().mockRejectedValueOnce(new Error('quote failed'));
    const warpCore = {
      estimateTransferRemoteFees,
      isPredicateSupported: vi.fn().mockResolvedValue(false),
    } as unknown as WarpCore;

    await expect(
      fetchFeeQuotes(
        warpCore,
        originToken,
        destinationToken,
        'base',
        '0x000000000000000000000000000000000000dEaD',
        undefined,
        '0.01',
        '0x2222222222222222222222222222222222222222',
        false,
      ),
    ).rejects.toThrow('quote failed');

    expect(estimateTransferRemoteFees).toHaveBeenCalledTimes(1);
  });

  it('returns null for Predicate route when only fallback sender is available', async () => {
    const originToken = mockOriginToken(ProtocolType.Ethereum);
    const destinationToken = mockDestinationToken(ProtocolType.Ethereum);
    mockFindConnectedDestinationToken.mockReturnValue(destinationToken as unknown as Token);

    const estimateTransferRemoteFees = vi.fn();
    const warpCore = {
      estimateTransferRemoteFees,
      isPredicateSupported: vi.fn().mockResolvedValue(true),
    } as unknown as WarpCore;

    const result = await fetchFeeQuotes(
      warpCore,
      originToken,
      destinationToken,
      'base',
      '0x000000000000000000000000000000000000dEaD',
      undefined,
      '0.01',
      '0x2222222222222222222222222222222222222222',
      false,
    );

    expect(result).toBeNull();
    expect(mockFetchPredicateAttestation).not.toHaveBeenCalled();
    expect(estimateTransferRemoteFees).not.toHaveBeenCalled();
  });

  it('returns null when Predicate attestation fetch fails', async () => {
    const originToken = mockOriginToken(ProtocolType.Ethereum);
    const destinationToken = mockDestinationToken(ProtocolType.Ethereum);
    mockFindConnectedDestinationToken.mockReturnValue(destinationToken as unknown as Token);

    mockFetchPredicateAttestation.mockRejectedValue(new Error('attestation API unavailable'));

    const estimateTransferRemoteFees = vi.fn();
    const warpCore = {
      estimateTransferRemoteFees,
      isPredicateSupported: vi.fn().mockResolvedValue(true),
    } as unknown as WarpCore;

    const result = await fetchFeeQuotes(
      warpCore,
      originToken,
      destinationToken,
      'base',
      '0x1111111111111111111111111111111111111111',
      undefined,
      '0.01',
      '0x2222222222222222222222222222222222222222',
      false,
    );

    expect(result).toBeNull();
    expect(estimateTransferRemoteFees).not.toHaveBeenCalled();
  });

  it('pins interchainFee from attestation and passes attestation to estimateTransferRemoteFees', async () => {
    const originToken = mockOriginToken(ProtocolType.Ethereum);
    const destinationToken = mockDestinationToken(ProtocolType.Ethereum);
    mockFindConnectedDestinationToken.mockReturnValue(destinationToken as unknown as Token);

    const pinnedInterchainFee = { amount: 100n } as unknown as TokenAmount;
    const mockAttestation = { uuid: 'test-uuid' } as unknown as import('@hyperlane-xyz/sdk').PredicateAttestation;
    mockFetchPredicateAttestation.mockResolvedValue({
      attestation: mockAttestation,
      interchainFee: pinnedInterchainFee,
      tokenFeeQuote: undefined,
    });

    const driftedInterchainQuote = { amount: 200n } as unknown as TokenAmount;
    const localQuote = { amount: 5n } as unknown as TokenAmount;
    const estimateTransferRemoteFees = vi.fn().mockResolvedValue({
      interchainQuote: driftedInterchainQuote,
      localQuote,
      tokenFeeQuote: undefined,
    } as WarpCoreFeeEstimate);
    const warpCore = {
      estimateTransferRemoteFees,
      isPredicateSupported: vi.fn().mockResolvedValue(true),
    } as unknown as WarpCore;

    const result = await fetchFeeQuotes(
      warpCore,
      originToken,
      destinationToken,
      'base',
      '0x1111111111111111111111111111111111111111',
      undefined,
      '0.01',
      '0x2222222222222222222222222222222222222222',
      false,
    );

    expect(estimateTransferRemoteFees).toHaveBeenCalledWith(
      expect.objectContaining({ attestation: mockAttestation }),
    );
    // Pinned value must win over the freshly re-quoted interchainQuote
    expect(result?.interchainQuote).toBe(pinnedInterchainFee);
    expect(result?.localQuote).toBe(localQuote);
  });
});
