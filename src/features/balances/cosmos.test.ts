import { TokenStandard, type MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { connectMock, disconnectMock, getBalanceMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
  disconnectMock: vi.fn(),
  getBalanceMock: vi.fn(),
}));

vi.mock('@cosmjs/stargate', () => ({
  StargateClient: {
    connect: connectMock,
  },
}));

import { readCosmosTokenBalance } from './cosmos';

describe('readCosmosTokenBalance', () => {
  beforeEach(() => {
    connectMock.mockReset();
    disconnectMock.mockReset();
    getBalanceMock.mockReset();
    connectMock.mockResolvedValue({
      getBalance: getBalanceMock,
      disconnect: disconnectMock,
    });
    getBalanceMock.mockResolvedValue({ amount: '123456' });
  });

  test.each([
    ['celestia', 'utia', 'celestia1owner'],
    ['kyve', 'ukyve', 'kyve1owner'],
  ])(
    'reads %s native zero-address tokens through the chain native denom',
    async (chainName, denom, owner) => {
      const balance = await readCosmosTokenBalance(multiProviderWithNativeDenom(denom), {
        chainName,
        tokenAddress: '0x0000000000000000000000000000000000000000',
        isNative: true,
        owner,
        standard: TokenStandard.CosmNativeHypCollateral,
      });

      expect(balance).toBe(123456n);
      expect(connectMock).toHaveBeenCalledWith(`https://${chainName}-rpc.test`);
      expect(getBalanceMock).toHaveBeenCalledWith(owner, denom);
      expect(disconnectMock).toHaveBeenCalledOnce();
    },
  );
});

function multiProviderWithNativeDenom(denom: string): MultiProtocolProvider {
  return {
    tryGetChainMetadata: (chainName: string) => ({
      nativeToken: { denom },
      rpcUrls: [{ http: `https://${chainName}-rpc.test` }],
    }),
  } as unknown as MultiProtocolProvider;
}
