import { IToken } from '@hyperlane-xyz/sdk';
import { Address, ProtocolType } from '@hyperlane-xyz/utils';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useSignTypedData } from 'wagmi';
import { logger } from '../../utils/logger';
import { useMultiProvider } from '../chains/hooks';

export interface PermitSignature {
  v: number;
  r: string;
  s: string;
  deadline: number;
}

interface PermitData {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  message: {
    owner: string;
    spender: string;
    value: string;
    nonce: bigint;
    deadline: number;
  };
}

export function useSupportsPermit(token?: IToken) {
  const multiProvider = useMultiProvider();

  const { data: supportsPermit, isLoading } = useQuery({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ['supportsPermit', token?.addressOrDenom, token?.chainName, token?.protocol],
    queryFn: async () => {
      if (!token) return false;
      if (token.protocol !== ProtocolType.Ethereum) return false;

      const adapter = token.getAdapter(multiProvider);
      if (typeof (adapter as any).supportsPermit !== 'function') return false;

      return (adapter as any).supportsPermit();
    },
    enabled: !!token,
    staleTime: Infinity,
  });

  return { supportsPermit: !!supportsPermit, isLoading };
}

export function usePermitSignature() {
  const multiProvider = useMultiProvider();
  const { signTypedDataAsync } = useSignTypedData();
  const [isLoading, setIsLoading] = useState(false);

  const requestPermitSignature = useCallback(
    async (
      token: IToken,
      owner: Address,
      spender: Address,
      amount: string,
    ): Promise<PermitSignature | null> => {
      setIsLoading(true);
      try {
        const adapter = token.getAdapter(multiProvider);
        if (typeof (adapter as any).getPermitData !== 'function') return null;

        const deadline = Math.floor(Date.now() / 1000) + 3600;

        const permitData: PermitData = await (adapter as any).getPermitData({
          owner,
          spender,
          amount,
          deadline,
        });

        const signature = await signTypedDataAsync({
          domain: {
            name: permitData.domain.name,
            version: permitData.domain.version,
            chainId: permitData.domain.chainId,
            verifyingContract: permitData.domain.verifyingContract as `0x${string}`,
          },
          types: {
            Permit: [
              { name: 'owner', type: 'address' },
              { name: 'spender', type: 'address' },
              { name: 'value', type: 'uint256' },
              { name: 'nonce', type: 'uint256' },
              { name: 'deadline', type: 'uint256' },
            ],
          },
          primaryType: 'Permit',
          message: {
            owner: permitData.message.owner as `0x${string}`,
            spender: permitData.message.spender as `0x${string}`,
            value: BigInt(permitData.message.value),
            nonce: permitData.message.nonce,
            deadline: BigInt(permitData.message.deadline),
          },
        });

        const r = signature.slice(0, 66) as string;
        const s = ('0x' + signature.slice(66, 130)) as string;
        const v = parseInt(signature.slice(130, 132), 16);

        logger.debug('Permit signature obtained successfully');
        return { v, r, s, deadline: permitData.message.deadline };
      } catch (error) {
        logger.error('Failed to sign permit', error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [multiProvider, signTypedDataAsync],
  );

  return { requestPermitSignature, isLoading };
}
