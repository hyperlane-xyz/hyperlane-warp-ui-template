import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as ChainalysisHook from '../useIsAccountChainalysisSanctioned';
import * as OfacHook from '../useIsAccountOfacSanctioned';
import { useIsAccountSanctioned } from '../useIsAccountSanctioned';

const mockUseEthereumAccount = vi.fn();
const mockUseReadContract = vi.fn();
const mockUseQuery = vi.fn();

vi.mock('@hyperlane-xyz/widgets', () => ({
  useEthereumAccount: (multiProvider: unknown) => mockUseEthereumAccount(multiProvider),
}));

vi.mock('../../../chains/hooks', () => ({
  useMultiProvider: vi.fn(() => 'mock-multi-provider'),
}));

vi.mock('wagmi', () => ({
  useReadContract: (options: unknown) => mockUseReadContract(options),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => mockUseQuery(options),
}));

beforeEach(() => {
  mockUseEthereumAccount.mockReset();
  mockUseReadContract.mockReset();
  mockUseQuery.mockReset();
});

describe('useIsAccountChainalysisSanctioned', () => {
  it('returns true when the Chainalysis oracle flags the account', () => {
    const sanctionedAddress = '0x0000000000000000000000000000000000000001';
    mockUseEthereumAccount.mockReturnValue({
      addresses: [{ address: sanctionedAddress }],
    });

    let capturedOptions: any;
    mockUseReadContract.mockImplementation((options) => {
      capturedOptions = options;
      return { data: true };
    });

    const { result } = renderHook(() => ChainalysisHook.useIsAccountChainalysisSanctioned());

    expect(result.current).toBe(true);
    expect(mockUseReadContract).toHaveBeenCalledTimes(1);
    expect(capturedOptions?.args?.[0]).toBe(sanctionedAddress);
    expect(capturedOptions?.query?.enabled).toBe(true);
  });

  it('returns false when the oracle reports the account as clear', () => {
    const clearAddress = '0x0000000000000000000000000000000000000002';
    mockUseEthereumAccount.mockReturnValue({
      addresses: [{ address: clearAddress }],
    });
    mockUseReadContract.mockReturnValue({ data: false });

    const { result } = renderHook(() => ChainalysisHook.useIsAccountChainalysisSanctioned());

    expect(result.current).toBe(false);
    expect(mockUseReadContract).toHaveBeenCalledWith(
      expect.objectContaining({
        args: [clearAddress],
        query: expect.objectContaining({ enabled: true }),
      }),
    );
  });

  it('sanitises invalid addresses before querying the oracle', () => {
    mockUseEthereumAccount.mockReturnValue({
      addresses: [{ address: 'not-an-address' }],
    });

    let capturedOptions: any;
    mockUseReadContract.mockImplementation((options) => {
      capturedOptions = options;
      return { data: undefined };
    });

    const { result } = renderHook(() => ChainalysisHook.useIsAccountChainalysisSanctioned());

    expect(result.current).toBe(false);
    expect(capturedOptions?.args?.[0]).toBe('0x');
    expect(capturedOptions?.query?.enabled).toBe(true);
  });
});

describe('useIsAccountOfacSanctioned', () => {
  it('returns true when the address is listed by OFAC', () => {
    const ofacAddress = '0x00000000000000000000000000000000000000a3';
    mockUseEthereumAccount.mockReturnValue({
      addresses: [{ address: ofacAddress }],
    });

    let capturedOptions: any;
    mockUseQuery.mockImplementation((options) => {
      capturedOptions = options;
      return { data: [ofacAddress] };
    });

    const { result } = renderHook(() => OfacHook.useIsAccountOfacSanctioned());

    expect(result.current).toBe(true);
    expect(mockUseQuery).toHaveBeenCalledTimes(1);
    expect(capturedOptions?.queryKey).toEqual(['useIsAccountOfacSanctioned', ofacAddress]);
    expect(capturedOptions?.enabled).toBe(true);
  });

  it('returns false when the address is not listed by OFAC', () => {
    const address = '0x00000000000000000000000000000000000000a4';
    mockUseEthereumAccount.mockReturnValue({
      addresses: [{ address }],
    });
    mockUseQuery.mockReturnValue({ data: ['0x00000000000000000000000000000000000000a5'] });

    const { result } = renderHook(() => OfacHook.useIsAccountOfacSanctioned());

    expect(result.current).toBe(false);
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['useIsAccountOfacSanctioned', address],
        enabled: true,
      }),
    );
  });

  it('returns false and disables the query when no address is available', () => {
    mockUseEthereumAccount.mockReturnValue({ addresses: [] });

    let capturedOptions: any;
    mockUseQuery.mockImplementation((options) => {
      capturedOptions = options;
      return { data: undefined };
    });

    const { result } = renderHook(() => OfacHook.useIsAccountOfacSanctioned());

    expect(result.current).toBe(false);
    expect(capturedOptions?.enabled).toBe(false);
    expect(mockUseQuery).toHaveBeenCalledTimes(1);
  });
});

describe('useIsAccountSanctioned', () => {
  it('returns false when neither source flags the account', () => {
    const ofacSpy = vi.spyOn(OfacHook, 'useIsAccountOfacSanctioned').mockReturnValue(false);
    const chainalysisSpy = vi
      .spyOn(ChainalysisHook, 'useIsAccountChainalysisSanctioned')
      .mockReturnValue(false);

    const { result } = renderHook(() => useIsAccountSanctioned());

    expect(result.current).toBe(false);

    ofacSpy.mockRestore();
    chainalysisSpy.mockRestore();
  });

  it('returns true when OFAC flags the address', () => {
    const ofacSpy = vi.spyOn(OfacHook, 'useIsAccountOfacSanctioned').mockReturnValue(true);
    const chainalysisSpy = vi
      .spyOn(ChainalysisHook, 'useIsAccountChainalysisSanctioned')
      .mockReturnValue(false);

    const { result } = renderHook(() => useIsAccountSanctioned());

    expect(result.current).toBe(true);

    ofacSpy.mockRestore();
    chainalysisSpy.mockRestore();
  });

  it('returns true when Chainalysis flags the address', () => {
    const ofacSpy = vi.spyOn(OfacHook, 'useIsAccountOfacSanctioned').mockReturnValue(false);
    const chainalysisSpy = vi
      .spyOn(ChainalysisHook, 'useIsAccountChainalysisSanctioned')
      .mockReturnValue(true);

    const { result } = renderHook(() => useIsAccountSanctioned());

    expect(result.current).toBe(true);

    ofacSpy.mockRestore();
    chainalysisSpy.mockRestore();
  });
});
